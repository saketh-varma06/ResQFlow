import { ApiError } from "../utils/ApiError";
import { parsePagination, pageMeta } from "../utils/pagination";
import { writeAudit } from "../utils/audit";
import { notifyUser, notifyUsers } from "../utils/notify";
import { emitToRole, emitToUser } from "../utils/realtime";
import { out } from "./serialize";
import { AssignmentModel, IncidentModel, ResponderModel, StatusHistoryModel, UserModel } from "../models";
import { ciOr } from "../utils/query";
import type { AuthUser } from "../types/auth";
import type { z } from "zod";
import type { assignIncidentSchema, createIncidentSchema, listIncidentsQuery, updateIncidentSchema, updateIncidentStatusSchema } from "../validators/incident.validators";
import type { IncidentStatus } from "../types/enums";
import { computePriority } from "../utils/priority";
import { assertTransition } from "../utils/workflow";

const incidentDetailPopulate = [
  { path: "reporter", select: "name email role area" },
  { path: "assignments", populate: { path: "responderProfile", populate: { path: "user", select: "name email" } } },
  { path: "statusHistory", options: { sort: { createdAt: -1 }, limit: 50 }, populate: { path: "changedBy", select: "name role" } },
];
const incidentListPopulate = [
  { path: "reporter", select: "name role" },
  { path: "assignments", populate: { path: "responderProfile", select: "unitName unitType" } },
];
const assignmentPopulate = [
  { path: "responderProfile", populate: { path: "user", select: "name email" } },
  { path: "incident" },
];

export async function createIncident(actor: AuthUser, input: z.infer<typeof createIncidentSchema>, ip?: string) {
  const now = new Date();
  const priority = computePriority({ severity: input.severity, category: input.type, peopleAffected: input.peopleAffected, injuriesReported: input.injuriesReported, trapped: input.trapped, submittedAt: now, now });
  const created = await IncidentModel.create({ ...input, reporterId: actor.id, priorityScore: priority.score, priorityLevel: priority.level, priorityReasons: priority.reasons });
  const incident = await IncidentModel.findById(created.id).populate(incidentDetailPopulate);
  await StatusHistoryModel.create({ entityType: "INCIDENT", entityId: created.id, fromStatus: null, toStatus: "SUBMITTED", changedById: actor.id, note: "Incident reported" });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "incident.create", targetType: "Incident", targetId: created.id, ipAddress: ip });
  emitToRole("RESPONDER", "incident:created", out(incident));
  emitToRole("ADMIN", "incident:created", out(incident));
  return out(incident);
}

export async function listIncidents(actor: AuthUser, q: z.infer<typeof listIncidentsQuery>) {
  const p = parsePagination(q as Record<string, unknown>);
  const where = {
    ...(q.status ? { status: q.status } : {}), ...(q.severity ? { severity: q.severity } : {}),
    ...(q.type ? { type: q.type } : {}), ...(q.area ? { area: q.area } : {}),
    ...(q.mine ? { reporterId: actor.id } : {}),
    ...(q.search ? ciOr(["title", "location"], q.search) : {}),
  };
  const [total, rows] = await Promise.all([
    IncidentModel.countDocuments(where),
    IncidentModel.find(where).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).populate(incidentListPopulate),
  ]);
  return { data: out(rows), meta: pageMeta(total, p) };
}

export async function getIncident(id: string) {
  const incident = await IncidentModel.findById(id).populate(incidentDetailPopulate);
  if (!incident) throw ApiError.notFound("Incident not found");
  return out(incident);
}

export async function updateIncident(actor: AuthUser, id: string, input: z.infer<typeof updateIncidentSchema>, ip?: string) {
  const existing = await IncidentModel.findById(id);
  if (!existing) throw ApiError.notFound("Incident not found");
  if (actor.role === "CITIZEN" && existing.reporterId !== actor.id) throw ApiError.forbidden("You can only edit your own reports");
  if (actor.role === "CITIZEN" && existing.status !== "SUBMITTED") throw ApiError.forbidden("This report can no longer be edited");
  const priority = computePriority({ severity: input.severity ?? existing.severity, category: input.type ?? existing.type, peopleAffected: input.peopleAffected ?? existing.peopleAffected, injuriesReported: input.injuriesReported ?? existing.injuriesReported, trapped: input.trapped ?? existing.trapped, submittedAt: existing.createdAt });
  const updated = await IncidentModel.findByIdAndUpdate(id, { $set: { ...input, priorityScore: priority.score, priorityLevel: priority.level, priorityReasons: priority.reasons } }, { new: true }).populate(incidentDetailPopulate);
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "incident.update", targetType: "Incident", targetId: id, details: input, ipAddress: ip });
  return out(updated);
}

export async function updateIncidentStatus(actor: AuthUser, id: string, input: z.infer<typeof updateIncidentStatusSchema>, ip?: string) {
  const existing = await IncidentModel.findById(id);
  if (!existing) throw ApiError.notFound("Incident not found");
  if (actor.role === "CITIZEN") throw ApiError.forbidden("Citizens cannot change incident status");
  if (actor.role === "RESPONDER") {
    const profile = await ResponderModel.findOne({ userId: actor.id });
    const assignments = await AssignmentModel.find({ incidentId: id });
    const assigned = profile && assignments.some((a) => a.responderProfileId === profile.id && a.status !== "CANCELLED" && a.status !== "DECLINED");
    if (!assigned) throw ApiError.forbidden("This incident is not assigned to your unit");
  }
  if (existing.status === input.status) return getIncident(id);
  assertTransition(existing.status, input.status);
  const updated = await IncidentModel.findByIdAndUpdate(id, { $set: { status: input.status } }, { new: true }).populate(incidentDetailPopulate);
  await StatusHistoryModel.create({ entityType: "INCIDENT", entityId: id, fromStatus: existing.status, toStatus: input.status, changedById: actor.id, note: input.note });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "incident.status_change", targetType: "Incident", targetId: id, details: { from: existing.status, to: input.status }, ipAddress: ip });
  if (existing.reporterId !== actor.id) {
    await notifyUser(existing.reporterId, "Incident status updated", `"${existing.title}" is now ${input.status.replace(/_/g, " ").toLowerCase()}.`, "INCIDENT_UPDATE", { type: "Incident", id });
  }
  emitToRole("RESPONDER", "incident:updated", out(updated));
  emitToRole("ADMIN", "incident:updated", out(updated));
  emitToUser(existing.reporterId, "incident:updated", out(updated));
  return out(updated);
}

export async function assignIncident(actor: AuthUser, id: string, input: z.infer<typeof assignIncidentSchema>, ip?: string) {
  const incident = await IncidentModel.findById(id);
  if (!incident) throw ApiError.notFound("Incident not found");
  const profile = await ResponderModel.findById(input.responderProfileId).populate("user");
  if (!profile) throw ApiError.notFound("Responder unit not found");
  const assignment = await AssignmentModel.findOneAndUpdate(
    { incidentId: id, responderProfileId: profile.id },
    { $set: { status: "PENDING", notes: input.notes, assignedById: actor.id, respondedAt: null, completedAt: null }, $setOnInsert: { incidentId: id, responderProfileId: profile.id } },
    { new: true, upsert: true },
  ).populate(assignmentPopulate);
  if (incident.status === "SUBMITTED" || incident.status === "ACKNOWLEDGED") {
    await IncidentModel.findByIdAndUpdate(id, { $set: { status: "ASSIGNED" } });
    await StatusHistoryModel.create({ entityType: "INCIDENT", entityId: id, fromStatus: incident.status, toStatus: "ASSIGNED", changedById: actor.id, note: `Assigned to ${profile.unitName}` });
  } else if (incident.status !== "ASSIGNED") {
    throw ApiError.badRequest(`Cannot assign a responder while the incident is ${incident.status}`);
  }
  await ResponderModel.findByIdAndUpdate(profile.id, { $set: { readiness: "DEPLOYED" } });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "incident.assign", targetType: "Incident", targetId: id, details: { responderProfileId: profile.id, unit: profile.unitName }, ipAddress: ip });
  await notifyUser(profile.userId, "New incident assignment", `Your unit ${profile.unitName} was assigned to "${incident.title}".`, "INCIDENT_UPDATE", { type: "Incident", id });
  if (incident.reporterId !== actor.id) await notifyUser(incident.reporterId, "Responder assigned", `A responder unit was assigned to your report "${incident.title}".`, "INCIDENT_UPDATE", { type: "Incident", id });
  emitToRole("RESPONDER", "incident:assigned", out(assignment));
  return out(assignment);
}

export async function respondToAssignment(actor: AuthUser, incidentId: string, action: "accept" | "decline" | "complete") {
  const profile = await ResponderModel.findOne({ userId: actor.id });
  if (!profile) throw ApiError.forbidden("You do not have a responder profile");
  const assignment = await AssignmentModel.findOne({ incidentId, responderProfileId: profile.id });
  if (!assignment) throw ApiError.notFound("Assignment not found for your unit");
  const map = { accept: "ACCEPTED", decline: "DECLINED", complete: "COMPLETED" } as const;
  const updated = await AssignmentModel.findByIdAndUpdate(assignment.id, { $set: {
    status: map[action],
    respondedAt: action === "complete" ? assignment.respondedAt : new Date(),
    completedAt: action === "complete" ? new Date() : assignment.completedAt,
  } }, { new: true });
  if (action === "accept") await updateIncidentStatus(actor, incidentId, { status: "IN_PROGRESS" as IncidentStatus }).catch(() => undefined);
  if (action === "complete") {
    await updateIncidentStatus(actor, incidentId, { status: "RESOLVED" as IncidentStatus, note: "Assignment completed by responder unit" });
  }
  return out(updated);
}

export async function deleteIncident(actor: AuthUser, id: string, ip?: string) {
  const existing = await IncidentModel.findById(id);
  if (!existing) throw ApiError.notFound("Incident not found");
  await AssignmentModel.deleteMany({ incidentId: id });
  await StatusHistoryModel.deleteMany({ entityType: "INCIDENT", entityId: id });
  await IncidentModel.findByIdAndDelete(id);
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "incident.delete", targetType: "Incident", targetId: id, details: { title: existing.title }, ipAddress: ip });
  return { deleted: true };
}

export async function notifyAdminsOfIncident(incidentId: string, title: string) {
  const admins = await UserModel.find({ role: "ADMIN", status: "ACTIVE" }).select("_id");
  await notifyUsers(admins.map((a) => a.id), "New incident reported", title, "INCIDENT_UPDATE", { type: "Incident", id: incidentId });
}

export async function addNote(actor: AuthUser, id: string, note: string, ip?: string) {
  const incident = await IncidentModel.findById(id);
  if (!incident) throw ApiError.notFound("Incident not found");
  if (actor.role === "CITIZEN") throw ApiError.forbidden("Citizens cannot add response notes");
  if (actor.role === "RESPONDER") {
    const profile = await ResponderModel.findOne({ userId: actor.id });
    const assignments = await AssignmentModel.find({ incidentId: id });
    const assigned = profile && assignments.some((a) => a.responderProfileId === profile.id && a.status !== "CANCELLED" && a.status !== "DECLINED");
    if (!assigned) throw ApiError.forbidden("This incident is not assigned to your unit");
  }
  const entry = await StatusHistoryModel.create({ entityType: "INCIDENT", entityId: id, fromStatus: incident.status, toStatus: incident.status, changedById: actor.id, note });
  await entry.populate({ path: "changedBy", select: "name role" });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "incident.note", targetType: "Incident", targetId: id, ipAddress: ip });
  if (incident.reporterId !== actor.id) await notifyUser(incident.reporterId, "New update on your incident", note.slice(0, 140), "INCIDENT_UPDATE", { type: "Incident", id });
  return out(entry);
}
