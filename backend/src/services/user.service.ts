import { prisma } from "../database/prisma";
import { ApiError } from "../utils/ApiError";
import { parsePagination, pageMeta } from "../utils/pagination";
import { writeAudit } from "../utils/audit";
import { publicUser } from "./serialize";
import type { AuthUser } from "../types/auth";
import type { z } from "zod";
import type { listUsersQuery, updateProfileSchema, adminUpdateUserSchema } from "../validators/user.validators";

export async function listUsers(actor: AuthUser, q: z.infer<typeof listUsersQuery>) {
  const p = parsePagination(q as Record<string, unknown>);
  const where = {
    ...(q.role ? { role: q.role } : {}), ...(q.status ? { status: q.status } : {}), ...(q.area ? { area: q.area } : {}),
    ...(q.search ? { OR: [{ name: { contains: q.search, mode: "insensitive" as const } }, { email: { contains: q.search, mode: "insensitive" as const } }] } : {}),
  };
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, skip: p.skip, take: p.limit, orderBy: { createdAt: "desc" }, include: { responderProfile: true } }),
  ]);
  void actor;
  return { data: users.map(publicUser), meta: pageMeta(total, p) };
}

export async function getUser(actor: AuthUser, id: string) {
  if (actor.role === "CITIZEN" && actor.id !== id) throw ApiError.forbidden("Citizens can only view their own profile");
  const user = await prisma.user.findUnique({ where: { id }, include: { responderProfile: true } });
  if (!user) throw ApiError.notFound("User not found");
  return publicUser(user);
}

export async function updateProfile(actor: AuthUser, input: z.infer<typeof updateProfileSchema>) {
  const user = await prisma.user.update({ where: { id: actor.id }, data: input });
  return publicUser(user);
}

export async function adminUpdateUser(actor: AuthUser, id: string, input: z.infer<typeof adminUpdateUserSchema>, ip?: string) {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw ApiError.notFound("User not found");
  const user = await prisma.user.update({ where: { id }, data: input });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "user.update", targetType: "User", targetId: id, details: input, ipAddress: ip });
  return publicUser(user);
}

export async function deleteUser(actor: AuthUser, id: string, ip?: string) {
  if (actor.id === id) throw ApiError.badRequest("You cannot delete your own account");
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw ApiError.notFound("User not found");
  await prisma.user.delete({ where: { id } });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "user.delete", targetType: "User", targetId: id, details: { email: target.email }, ipAddress: ip });
  return { deleted: true };
}
