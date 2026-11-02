import { AlertModel, AuditLogModel, NotificationModel, ResponderModel, ShelterModel, SosRequestModel, StatusHistoryModel, UserModel } from "../models";
import { ApiError } from "../utils/ApiError";
import { parsePagination, pageMeta } from "../utils/pagination";
import { writeAudit } from "../utils/audit";
import { ciOr } from "../utils/query";
import { publicUser } from "./serialize";
import type { AuthUser } from "../types/auth";
import type { z } from "zod";
import type { listUsersQuery, updateProfileSchema, adminUpdateUserSchema } from "../validators/user.validators";

export async function listUsers(actor: AuthUser, q: z.infer<typeof listUsersQuery>) {
  const p = parsePagination(q as Record<string, unknown>);
  const filter = {
    ...(q.role ? { role: q.role } : {}), ...(q.status ? { status: q.status } : {}), ...(q.area ? { area: q.area } : {}),
    ...(q.search ? ciOr(["name", "email"], q.search) : {}),
  };
  const [total, users] = await Promise.all([
    UserModel.countDocuments(filter),
    UserModel.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).populate("responderProfile"),
  ]);
  void actor;
  return { data: users.map((u) => publicUser(u as any)), meta: pageMeta(total, p) };
}

export async function getUser(actor: AuthUser, id: string) {
  if (actor.role === "CITIZEN" && actor.id !== id) throw ApiError.forbidden("Citizens can only view their own profile");
  const user = await UserModel.findById(id).populate("responderProfile");
  if (!user) throw ApiError.notFound("User not found");
  return publicUser(user as any);
}

export async function updateProfile(actor: AuthUser, input: z.infer<typeof updateProfileSchema>) {
  const user = await UserModel.findByIdAndUpdate(actor.id, { $set: input }, { new: true });
  if (!user) throw ApiError.notFound("User not found");
  return publicUser(user as any);
}

export async function adminUpdateUser(actor: AuthUser, id: string, input: z.infer<typeof adminUpdateUserSchema>, ip?: string) {
  const target = await UserModel.findById(id);
  if (!target) throw ApiError.notFound("User not found");
  const user = await UserModel.findByIdAndUpdate(id, { $set: input }, { new: true });
  if (!user) throw ApiError.notFound("User not found");
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "user.update", targetType: "User", targetId: id, details: input, ipAddress: ip });
  return publicUser(user as any);
}

export async function deleteUser(actor: AuthUser, id: string, ip?: string) {
  if (actor.id === id) throw ApiError.badRequest("You cannot delete your own account");
  const target = await UserModel.findById(id);
  if (!target) throw ApiError.notFound("User not found");
  // Replicate the former relational FK behaviour (cascades / SetNull) explicitly.
  await ResponderModel.deleteOne({ userId: id });
  await NotificationModel.deleteMany({ userId: id });
  const sosRequests = await SosRequestModel.find({ citizenId: id });
  const sosIds = sosRequests.map((s) => s.id);
  await StatusHistoryModel.deleteMany({ entityType: "SOS", entityId: { $in: sosIds } });
  await SosRequestModel.deleteMany({ citizenId: id });
  await AlertModel.updateMany({ issuedById: id }, { $set: { issuedById: null } });
  await ShelterModel.updateMany({ createdById: id }, { $set: { createdById: null } });
  await AuditLogModel.updateMany({ actorId: id }, { $set: { actorId: null } });
  await UserModel.findByIdAndDelete(id);
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "user.delete", targetType: "User", targetId: id, details: { email: target.email }, ipAddress: ip });
  return { deleted: true };
}
