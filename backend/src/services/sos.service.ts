import { ApiError } from "../utils/ApiError";
import { parsePagination, pageMeta } from "../utils/pagination";
import { writeAudit } from "../utils/audit";
import { notifyUser, notifyUsers } from "../utils/notify";
import { emitToRole } from "../utils/realtime";
import { out } from "./serialize";
import { ResponderModel, SosRequestModel, StatusHistoryModel, UserModel } from "../models";
import { ciOr } from "../utils/query";
import { computePriority } from "../utils/priority";
import { assertTransition } from "../utils/workflow";
import type { AuthUser } from "../types/auth";
import type { z } from "zod";
import type { assignSosSchema, createSosSchema, listSosQuery, updateSosStatusSchema } from "../validators/sos.validators";

const sosPopulate = [
  { path: "citizen", select: "name email phone" },
  { path: "responderProfile", populate: { path: "user", select: "name email" } },
];
const sosDetailPopulate = [
  ...sosPopulate,
  { path: "statusHistory", options: { sort: { createdAt: 1 } }, populate: { path: "changedBy", select: "name role" } },
];

export async function createSos(actor: AuthUser, input: z.infer<typeof createSosSchema>, ip?: string) {
  const now = new Date();
  const priority = computePriority({ category: input.category, peopleAffected: input.people, injuriesReported: input.injuriesReported, trapped: input.trapped, vulnerableGroups: input.vulnerableGroups, submittedAt: now, now });
  const created = await SosRequestModel.create({ ...input, citizenId: actor.id, priorityScore: priority.score, priorityLevel: priority.level, priorityReasons: priority.reasons });
  const sos = await SosRequestModel.findById(created.id).populate(sosPopulate);
  await StatusHistoryModel.create({ entityType: "SOS", entityId: created.id, fromStatus: null, toStatus: "SUBMITTED", changedById: actor.id, note: "SOS submitted" });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "sos.create", targetType: "SOSRequest", targetId: created.id, ipAddress: ip });
  emitToRole("RESPONDER", "sos:created", out(sos));
  emitToRole("ADMIN", "sos:created", out(sos));
  const responders = await UserModel.find({ role: "RESPONDER", status: "ACTIVE" }).select("_id").limit(200);
  await notifyUsers(responders.map((r) => r.id), "New SOS request", `${input.need} — ${input.location}`, "SOS_UPDATE", { type: "SOSRequest", id: created.id });
  return out(sos);
}

export async function listSos(actor: AuthUser, q: z.infer<typeof listSosQuery>) {
  const p = parsePagination(q as Record<string, unknown>);
  const citizenScope = actor.role === "CITIZEN" || q.mine ? { citizenId: actor.id } : {};
  const where = { ...citizenScope, ...(q.status ? { status: q.status } : {}),
    ...(q.search ? ciOr(["need", "location"], q.search) : {}) };
  const [total, rows] = await Promise.all([
    SosRequestModel.countDocuments(where),
    SosRequestModel.find(where).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).populate(sosPopulate),
  ]);
  return { data: out(rows), meta: pageMeta(total, p) };
}

export async function getSos(actor: AuthUser, id: string) {
  const sos = await SosRequestModel.findById(id).populate(sosDetailPopulate);
  if (!sos) throw ApiError.notFound("SOS request not found");
  if (actor.role === "CITIZEN" && sos.citizenId !== actor.id) throw ApiError.forbidden("You can only view your own SOS requests");
  return out(sos);
}

export async function updateSosStatus(actor: AuthUser, id: string, input: z.infer<typeof updateSosStatusSchema>, ip?: string) {
  const sos = await SosRequestModel.findById(id);
  if (!sos) throw ApiError.notFound("SOS request not found");
  if (actor.role === "CITIZEN" && (sos.citizenId !== actor.id || input.status !== "CANCELLED")) {
    throw ApiError.forbidden("Citizens can only cancel their own SOS requests");
  }
  assertTransition(sos.status, input.status);
  const updated = await SosRequestModel.findByIdAndUpdate(id, { $set: { status: input.status } }, { new: true }).populate(sosPopulate);
  await StatusHistoryModel.create({ entityType: "SOS", entityId: id, fromStatus: sos.status, toStatus: input.status, changedById: actor.id });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "sos.status_change", targetType: "SOSRequest", targetId: id, details: { from: sos.status, to: input.status }, ipAddress: ip });
  if (sos.citizenId !== actor.id) {
    if (input.status === "ACKNOWLEDGED") await notifyUser(sos.citizenId, "SOS acknowledged", "The control room has acknowledged your SOS request. Help is being arranged.", "SOS_UPDATE", { type: "SOSRequest", id });
    else await notifyUser(sos.citizenId, "SOS status updated", `Your SOS request is now ${input.status.replace(/_/g, " ").toLowerCase()}.`, "SOS_UPDATE", { type: "SOSRequest", id });
  }
  emitToRole("RESPONDER", "sos:updated", out(updated));
  return out(updated);
}

export async function assignSos(actor: AuthUser, id: string, input: z.infer<typeof assignSosSchema>, ip?: string) {
  const sos = await SosRequestModel.findById(id);
  if (!sos) throw ApiError.notFound("SOS request not found");
  let profileId = input.responderProfileId;
  if (actor.role === "RESPONDER") {
    const own = await ResponderModel.findOne({ userId: actor.id });
    if (!own) throw ApiError.forbidden("You do not have a responder profile");
    profileId = own.id; // responders can only self-assign
  }
  const profile = await ResponderModel.findById(profileId).populate("user");
  if (!profile) throw ApiError.notFound("Responder unit not found");
  // Claim lock: once a unit holds an ASSIGNED SOS, no other unit can take it until it is released.
  if (sos.status === "ASSIGNED" && sos.responderProfileId && sos.responderProfileId !== profile.id) {
    const holder = await ResponderModel.findById(sos.responderProfileId);
    throw ApiError.conflict(`This SOS is already claimed by ${holder?.unitName ?? "another unit"}. It must be released before it can be reassigned.`);
  }
  if (!["SUBMITTED", "ACKNOWLEDGED", "ASSIGNED"].includes(sos.status)) throw ApiError.badRequest(`Cannot assign a unit while the request is ${sos.status}`);
  const updated = await SosRequestModel.findByIdAndUpdate(id, { $set: { responderProfileId: profile.id, status: "ASSIGNED" } }, { new: true }).populate(sosPopulate);
  if (sos.status !== "ASSIGNED") await StatusHistoryModel.create({ entityType: "SOS", entityId: id, fromStatus: sos.status, toStatus: "ASSIGNED", changedById: actor.id, note: `Assigned to ${profile.unitName}` });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "sos.assign", targetType: "SOSRequest", targetId: id, details: { responderProfileId: profile.id, unit: profile.unitName }, ipAddress: ip });
  await notifyUser(profile.userId, "SOS assigned to your unit", `${sos.need} — ${sos.location}`, "SOS_UPDATE", { type: "SOSRequest", id });
  if (sos.citizenId !== actor.id) await notifyUser(sos.citizenId, "Help is on the way", `Unit ${profile.unitName} was assigned to your SOS request.`, "SOS_UPDATE", { type: "SOSRequest", id });
  return out(updated);
}

/** Release a claim: the holding unit (or an admin) frees the SOS back to the queue. */
export async function releaseSos(actor: AuthUser, id: string, ip?: string) {
  const sos = await SosRequestModel.findById(id);
  if (!sos) throw ApiError.notFound("SOS request not found");
  if (!sos.responderProfileId) throw ApiError.badRequest("This SOS is not claimed by any unit");
  if (sos.status !== "ASSIGNED") throw ApiError.badRequest(`A claim can only be released while the request is ASSIGNED (it is ${sos.status})`);
  if (actor.role === "RESPONDER") {
    const own = await ResponderModel.findOne({ userId: actor.id });
    if (!own || own.id !== sos.responderProfileId) throw ApiError.forbidden("Only the unit holding this claim can release it");
  }
  const holder = await ResponderModel.findById(sos.responderProfileId);
  const updated = await SosRequestModel.findByIdAndUpdate(id, { $set: { responderProfileId: null, status: "ACKNOWLEDGED" } }, { new: true }).populate(sosPopulate);
  await StatusHistoryModel.create({ entityType: "SOS", entityId: id, fromStatus: "ASSIGNED", toStatus: "ACKNOWLEDGED", changedById: actor.id, note: `Claim released by ${actor.role === "ADMIN" ? "admin" : holder?.unitName ?? "responder unit"}` });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "sos.release", targetType: "SOSRequest", targetId: id, details: { releasedUnit: holder?.unitName }, ipAddress: ip });
  if (holder && holder.userId !== actor.id) await notifyUser(holder.userId, "SOS claim released", `The claim on "${sos.need}" was released and the request returned to the queue.`, "SOS_UPDATE", { type: "SOSRequest", id });
  emitToRole("RESPONDER", "sos:updated", out(updated));
  return out(updated);
}
