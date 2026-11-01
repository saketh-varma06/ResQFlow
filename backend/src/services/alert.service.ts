import { prisma } from "../database/prisma";
import { ApiError } from "../utils/ApiError";
import { parsePagination, pageMeta } from "../utils/pagination";
import { writeAudit } from "../utils/audit";
import { notifyUsers } from "../utils/notify";
import { emitToAll } from "../utils/realtime";
import { stripUserDeep } from "./serialize";
import type { AuthUser } from "../types/auth";
import type { z } from "zod";
import type { createAlertSchema, listAlertsQuery, updateAlertSchema } from "../validators/alert.validators";

export async function listAlerts(actor: AuthUser | undefined, q: z.infer<typeof listAlertsQuery>) {
  const p = parsePagination(q as Record<string, unknown>);
  const isAdmin = actor?.role === "ADMIN";
  const where = {
    ...(!isAdmin ? { status: "ACTIVE" as const } : q.status ? { status: q.status } : {}),
    ...(q.activeOnly ? { status: "ACTIVE" as const } : {}),
    ...(q.severity ? { severity: q.severity } : {}), ...(q.area ? { area: q.area } : {}),
    ...(q.search ? { title: { contains: q.search, mode: "insensitive" as const } } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.disasterAlert.count({ where }),
    prisma.disasterAlert.findMany({ where, skip: p.skip, take: p.limit, orderBy: { issuedAt: "desc" } }),
  ]);
  return { data: stripUserDeep(rows), meta: pageMeta(total, p) };
}

export async function getAlert(id: string) {
  const alert = await prisma.disasterAlert.findUnique({ where: { id } });
  if (!alert) throw ApiError.notFound("Alert not found");
  return stripUserDeep(alert);
}

export async function createAlert(actor: AuthUser, input: z.infer<typeof createAlertSchema>, ip?: string) {
  const alert = await prisma.disasterAlert.create({ data: { ...input, issuedById: actor.id } });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "alert.create", targetType: "DisasterAlert", targetId: alert.id, details: { title: alert.title, status: alert.status }, ipAddress: ip });
  if (alert.status === "ACTIVE") {
    const citizens = await prisma.user.findMany({ where: { role: "CITIZEN", status: "ACTIVE", ...(alert.area === "All districts" ? {} : { area: alert.area }) }, select: { id: true }, take: 5000 });
    await notifyUsers(citizens.map((c) => c.id), alert.title, alert.instructions, "ALERT", { type: "DisasterAlert", id: alert.id });
    await prisma.disasterAlert.update({ where: { id: alert.id }, data: { reach: citizens.length } });
    alert.reach = citizens.length;
    emitToAll("alert:created", stripUserDeep(alert));
  }
  return stripUserDeep(alert);
}

export async function updateAlert(actor: AuthUser, id: string, input: z.infer<typeof updateAlertSchema>, ip?: string) {
  const existing = await prisma.disasterAlert.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Alert not found");
  const alert = await prisma.disasterAlert.update({ where: { id }, data: input });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "alert.update", targetType: "DisasterAlert", targetId: id, details: input, ipAddress: ip });
  emitToAll("alert:updated", stripUserDeep(alert));
  return stripUserDeep(alert);
}

export async function deleteAlert(actor: AuthUser, id: string, ip?: string) {
  const existing = await prisma.disasterAlert.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Alert not found");
  await prisma.disasterAlert.delete({ where: { id } });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "alert.delete", targetType: "DisasterAlert", targetId: id, details: { title: existing.title }, ipAddress: ip });
  return { deleted: true };
}
