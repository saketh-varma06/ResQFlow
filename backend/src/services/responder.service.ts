import { prisma } from "../database/prisma";
import { ApiError } from "../utils/ApiError";
import { parsePagination, pageMeta } from "../utils/pagination";
import { hashPassword } from "../utils/security";
import { writeAudit } from "../utils/audit";
import { stripUserDeep } from "./serialize";
import type { AuthUser } from "../types/auth";
import type { z } from "zod";
import type { createResponderSchema, listRespondersQuery, updateResponderSchema } from "../validators/responder.validators";

const include = { user: { select: { id: true, name: true, email: true, phone: true, role: true, status: true, area: true } }, _count: { select: { assignments: true, sosAssignments: true } } };

export async function listResponders(q: z.infer<typeof listRespondersQuery>) {
  const p = parsePagination(q as Record<string, unknown>);
  const where = { ...(q.readiness ? { readiness: q.readiness } : {}), ...(q.unitType ? { unitType: q.unitType } : {}),
    ...(q.search ? { OR: [{ unitName: { contains: q.search, mode: "insensitive" as const } }, { base: { contains: q.search, mode: "insensitive" as const } }] } : {}) };
  const [total, rows] = await Promise.all([
    prisma.responderProfile.count({ where }),
    prisma.responderProfile.findMany({ where, skip: p.skip, take: p.limit, orderBy: { createdAt: "desc" }, include }),
  ]);
  return { data: stripUserDeep(rows), meta: pageMeta(total, p) };
}

export async function getResponder(id: string) {
  const profile = await prisma.responderProfile.findUnique({ where: { id }, include });
  if (!profile) throw ApiError.notFound("Responder unit not found");
  return stripUserDeep(profile);
}

export async function myResponderProfile(actor: AuthUser) {
  const profile = await prisma.responderProfile.findUnique({ where: { userId: actor.id }, include });
  if (!profile) throw ApiError.notFound("You do not have a responder profile");
  return stripUserDeep(profile);
}

export async function createResponder(actor: AuthUser, input: z.infer<typeof createResponderSchema>, ip?: string) {
  let userId = input.userId;
  if (!userId) {
    const existing = await prisma.user.findUnique({ where: { email: input.email! }, include: { responderProfile: true } });
    if (existing) {
      if (existing.responderProfile) throw ApiError.conflict("That account already has a responder profile");
      userId = existing.id;
      await prisma.user.update({ where: { id: userId }, data: { role: "RESPONDER", status: "ACTIVE" } });
    } else {
      if (!input.name || !input.password) throw ApiError.badRequest("name and password are required to create a new responder account");
      const created = await prisma.user.create({ data: { email: input.email!, name: input.name, passwordHash: await hashPassword(input.password), role: "RESPONDER", status: "ACTIVE" } });
      userId = created.id;
    }
  } else {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { responderProfile: true } });
    if (!user) throw ApiError.notFound("User not found");
    if (user.responderProfile) throw ApiError.conflict("That user already has a responder profile");
    await prisma.user.update({ where: { id: userId }, data: { role: "RESPONDER" } });
  }
  const profile = await prisma.responderProfile.create({ data: {
    userId, unitName: input.unitName, unitType: input.unitType, base: input.base,
    members: input.members ?? 1, serviceArea: input.serviceArea, readiness: input.readiness ?? "STANDBY",
  }, include });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "responder.create", targetType: "ResponderProfile", targetId: profile.id, details: { unitName: input.unitName }, ipAddress: ip });
  return stripUserDeep(profile);
}

export async function updateResponder(actor: AuthUser, id: string, input: z.infer<typeof updateResponderSchema>, ip?: string) {
  const profile = await prisma.responderProfile.findUnique({ where: { id } });
  if (!profile) throw ApiError.notFound("Responder unit not found");
  if (actor.role !== "ADMIN" && profile.userId !== actor.id) throw ApiError.forbidden("You can only update your own unit profile");
  if (actor.role !== "ADMIN" && input.rating !== undefined) throw ApiError.forbidden("Only administrators can set ratings");
  const updated = await prisma.responderProfile.update({ where: { id }, data: input, include });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "responder.update", targetType: "ResponderProfile", targetId: id, details: input, ipAddress: ip });
  return stripUserDeep(updated);
}

export async function deleteResponder(actor: AuthUser, id: string, ip?: string) {
  const profile = await prisma.responderProfile.findUnique({ where: { id } });
  if (!profile) throw ApiError.notFound("Responder unit not found");
  await prisma.responderProfile.delete({ where: { id } });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "responder.delete", targetType: "ResponderProfile", targetId: id, details: { unitName: profile.unitName }, ipAddress: ip });
  return { deleted: true };
}

export async function setMyAvailability(actor: AuthUser, readiness: "AVAILABLE" | "DEPLOYED" | "STANDBY" | "OFF_DUTY") {
  const profile = await prisma.responderProfile.findUnique({ where: { userId: actor.id } });
  if (!profile) throw ApiError.notFound("You do not have a responder profile");
  const updated = await prisma.responderProfile.update({ where: { id: profile.id }, data: { readiness }, include });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "responder.availability", targetType: "ResponderProfile", targetId: profile.id, details: { readiness } });
  return stripUserDeep(updated);
}
