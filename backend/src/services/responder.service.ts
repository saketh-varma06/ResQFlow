import { ResponderModel, UserModel, AssignmentModel, SosRequestModel } from "../models";
import { ApiError } from "../utils/ApiError";
import { parsePagination, pageMeta } from "../utils/pagination";
import { hashPassword } from "../utils/security";
import { writeAudit } from "../utils/audit";
import { ciOr } from "../utils/query";
import { out } from "./serialize";
import type { AuthUser } from "../types/auth";
import type { z } from "zod";
import type { createResponderSchema, listRespondersQuery, updateResponderSchema } from "../validators/responder.validators";

const USER_POPULATE = { path: "user", select: "name email phone role status area" };

/** Attach the Prisma-era `_count: { assignments, sosAssignments }` to one converted profile. */
async function attachCount(obj: Record<string, unknown>, id: string) {
  const [assignments, sosAssignments] = await Promise.all([
    AssignmentModel.countDocuments({ responderProfileId: id }),
    SosRequestModel.countDocuments({ responderProfileId: id }),
  ]);
  obj._count = { assignments, sosAssignments };
  return obj;
}

/** Batch version of attachCount for list pages (two aggregations total). */
async function attachCounts(data: Array<Record<string, unknown>>) {
  if (data.length === 0) return data;
  const ids = data.map((d) => d.id as string);
  const [assignmentCounts, sosCounts] = await Promise.all([
    AssignmentModel.aggregate([{ $match: { responderProfileId: { $in: ids } } }, { $group: { _id: "$responderProfileId", n: { $sum: 1 } } }]),
    SosRequestModel.aggregate([{ $match: { responderProfileId: { $in: ids } } }, { $group: { _id: "$responderProfileId", n: { $sum: 1 } } }]),
  ]);
  const assignmentMap = new Map<string, number>(assignmentCounts.map((r: { _id: string; n: number }) => [r._id, r.n] as [string, number]));
  const sosMap = new Map<string, number>(sosCounts.map((r: { _id: string; n: number }) => [r._id, r.n] as [string, number]));
  for (const obj of data) {
    const id = obj.id as string;
    obj._count = { assignments: assignmentMap.get(id) ?? 0, sosAssignments: sosMap.get(id) ?? 0 };
  }
  return data;
}

export async function listResponders(q: z.infer<typeof listRespondersQuery>) {
  const p = parsePagination(q as Record<string, unknown>);
  const where = { ...(q.readiness ? { readiness: q.readiness } : {}), ...(q.unitType ? { unitType: q.unitType } : {}),
    ...(q.search ? ciOr(["unitName", "base"], q.search) : {}) };
  const [total, rows] = await Promise.all([
    ResponderModel.countDocuments(where),
    ResponderModel.find(where).populate(USER_POPULATE).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit),
  ]);
  const data = await attachCounts(out(rows) as unknown as Array<Record<string, unknown>>);
  return { data, meta: pageMeta(total, p) };
}

export async function getResponder(id: string) {
  const profile = await ResponderModel.findById(id).populate(USER_POPULATE);
  if (!profile) throw ApiError.notFound("Responder unit not found");
  return attachCount(out(profile) as unknown as Record<string, unknown>, id);
}

export async function myResponderProfile(actor: AuthUser) {
  const profile = await ResponderModel.findOne({ userId: actor.id }).populate(USER_POPULATE);
  if (!profile) throw ApiError.notFound("You do not have a responder profile");
  return attachCount(out(profile) as unknown as Record<string, unknown>, profile.id);
}

export async function createResponder(actor: AuthUser, input: z.infer<typeof createResponderSchema>, ip?: string) {
  let userId = input.userId;
  if (!userId) {
    const existing = await UserModel.findOne({ email: input.email! }).populate("responderProfile");
    if (existing) {
      if ((existing as unknown as { responderProfile?: unknown }).responderProfile) throw ApiError.conflict("That account already has a responder profile");
      userId = existing.id;
      await UserModel.findByIdAndUpdate(userId, { $set: { role: "RESPONDER", status: "ACTIVE" } });
    } else {
      if (!input.name || !input.password) throw ApiError.badRequest("name and password are required to create a new responder account");
      const created = await UserModel.create({ email: input.email!, name: input.name, passwordHash: await hashPassword(input.password), role: "RESPONDER", status: "ACTIVE" });
      userId = created.id;
    }
  } else {
    const user = await UserModel.findById(userId).populate("responderProfile");
    if (!user) throw ApiError.notFound("User not found");
    if ((user as unknown as { responderProfile?: unknown }).responderProfile) throw ApiError.conflict("That user already has a responder profile");
    await UserModel.findByIdAndUpdate(userId, { $set: { role: "RESPONDER" } });
  }
  const createdProfile = await ResponderModel.create({
    userId, unitName: input.unitName, unitType: input.unitType, base: input.base,
    baseLat: input.baseLat, baseLng: input.baseLng,
    members: input.members ?? 1, serviceArea: input.serviceArea, readiness: input.readiness ?? "STANDBY",
  });
  const profile = await ResponderModel.findById(createdProfile.id).populate(USER_POPULATE);
  if (!profile) throw ApiError.notFound("Responder unit not found");
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "responder.create", targetType: "ResponderProfile", targetId: profile.id, details: { unitName: input.unitName }, ipAddress: ip });
  return attachCount(out(profile) as unknown as Record<string, unknown>, profile.id);
}

export async function updateResponder(actor: AuthUser, id: string, input: z.infer<typeof updateResponderSchema>, ip?: string) {
  const profile = await ResponderModel.findById(id);
  if (!profile) throw ApiError.notFound("Responder unit not found");
  if (actor.role !== "ADMIN" && profile.userId !== actor.id) throw ApiError.forbidden("You can only update your own unit profile");
  if (actor.role !== "ADMIN" && input.rating !== undefined) throw ApiError.forbidden("Only administrators can set ratings");
  const updated = await ResponderModel.findByIdAndUpdate(id, { $set: { ...input } }, { new: true }).populate(USER_POPULATE);
  if (!updated) throw ApiError.notFound("Responder unit not found");
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "responder.update", targetType: "ResponderProfile", targetId: id, details: input, ipAddress: ip });
  return attachCount(out(updated) as unknown as Record<string, unknown>, id);
}

export async function deleteResponder(actor: AuthUser, id: string, ip?: string) {
  const profile = await ResponderModel.findById(id);
  if (!profile) throw ApiError.notFound("Responder unit not found");
  await ResponderModel.findByIdAndDelete(id);
  await AssignmentModel.deleteMany({ responderProfileId: id });
  await SosRequestModel.updateMany({ responderProfileId: id }, { $set: { responderProfileId: null } });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "responder.delete", targetType: "ResponderProfile", targetId: id, details: { unitName: profile.unitName }, ipAddress: ip });
  return { deleted: true };
}

export async function setMyAvailability(actor: AuthUser, readiness: "AVAILABLE" | "DEPLOYED" | "STANDBY" | "OFF_DUTY") {
  const profile = await ResponderModel.findOne({ userId: actor.id });
  if (!profile) throw ApiError.notFound("You do not have a responder profile");
  const updated = await ResponderModel.findByIdAndUpdate(profile.id, { $set: { readiness } }, { new: true }).populate(USER_POPULATE);
  if (!updated) throw ApiError.notFound("You do not have a responder profile");
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "responder.availability", targetType: "ResponderProfile", targetId: profile.id, details: { readiness } });
  return attachCount(out(updated) as unknown as Record<string, unknown>, profile.id);
}
