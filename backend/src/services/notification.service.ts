import { NotificationModel } from "../models";
import { ApiError } from "../utils/ApiError";
import { parsePagination, pageMeta } from "../utils/pagination";
import { out } from "./serialize";
import type { AuthUser } from "../types/auth";
import type { z } from "zod";
import type { listNotificationsQuery } from "../validators/notification.validators";

export async function listNotifications(actor: AuthUser, q: z.infer<typeof listNotificationsQuery>) {
  const p = parsePagination(q as Record<string, unknown>);
  const where = { userId: actor.id, ...(q.unreadOnly ? { isRead: false } : {}) };
  const [total, rows] = await Promise.all([
    NotificationModel.countDocuments(where),
    NotificationModel.find(where).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit),
  ]);
  return { data: out(rows), meta: pageMeta(total, p) };
}
export async function unreadCount(actor: AuthUser) {
  return { unread: await NotificationModel.countDocuments({ userId: actor.id, isRead: false }) };
}
export async function markRead(actor: AuthUser, id: string) {
  const n = await NotificationModel.findById(id);
  if (!n || n.userId !== actor.id) throw ApiError.notFound("Notification not found");
  const updated = await NotificationModel.findByIdAndUpdate(id, { $set: { isRead: true } }, { new: true });
  if (!updated) throw ApiError.notFound("Notification not found");
  return out(updated);
}
export async function markAllRead(actor: AuthUser) {
  const r = await NotificationModel.updateMany({ userId: actor.id, isRead: false }, { $set: { isRead: true } });
  return { updated: r.modifiedCount };
}
export async function deleteNotification(actor: AuthUser, id: string) {
  const n = await NotificationModel.findById(id);
  if (!n || n.userId !== actor.id) throw ApiError.notFound("Notification not found");
  await NotificationModel.findByIdAndDelete(id);
  return { deleted: true };
}
