import { prisma } from "../database/prisma";
import { ApiError } from "../utils/ApiError";
import { parsePagination, pageMeta } from "../utils/pagination";
import type { AuthUser } from "../types/auth";
import type { z } from "zod";
import type { listNotificationsQuery } from "../validators/notification.validators";

export async function listNotifications(actor: AuthUser, q: z.infer<typeof listNotificationsQuery>) {
  const p = parsePagination(q as Record<string, unknown>);
  const where = { userId: actor.id, ...(q.unreadOnly ? { isRead: false } : {}) };
  const [total, rows] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({ where, skip: p.skip, take: p.limit, orderBy: { createdAt: "desc" } }),
  ]);
  return { data: rows, meta: pageMeta(total, p) };
}
export async function unreadCount(actor: AuthUser) {
  return { unread: await prisma.notification.count({ where: { userId: actor.id, isRead: false } }) };
}
export async function markRead(actor: AuthUser, id: string) {
  const n = await prisma.notification.findUnique({ where: { id } });
  if (!n || n.userId !== actor.id) throw ApiError.notFound("Notification not found");
  return prisma.notification.update({ where: { id }, data: { isRead: true } });
}
export async function markAllRead(actor: AuthUser) {
  const r = await prisma.notification.updateMany({ where: { userId: actor.id, isRead: false }, data: { isRead: true } });
  return { updated: r.count };
}
export async function deleteNotification(actor: AuthUser, id: string) {
  const n = await prisma.notification.findUnique({ where: { id } });
  if (!n || n.userId !== actor.id) throw ApiError.notFound("Notification not found");
  await prisma.notification.delete({ where: { id } });
  return { deleted: true };
}
