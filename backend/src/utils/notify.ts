import type { NotificationType } from "../types/enums";
import { NotificationModel } from "../models";
import { toApi } from "../services/serialize";
import { emitToUser } from "./realtime";
import { sendPushToUsers } from "./push";
export async function notifyUser(userId: string, title: string, body: string, type: NotificationType = "SYSTEM", related?: { type: string; id: string }) {
  const n = await NotificationModel.create({ userId, title, body, type, relatedEntityType: related?.type, relatedEntityId: related?.id });
  emitToUser(userId, "notification:new", toApi(n));
  void sendPushToUsers([userId], { title, body });
  return n;
}
export async function notifyUsers(userIds: string[], title: string, body: string, type: NotificationType = "SYSTEM", related?: { type: string; id: string }) {
  if (userIds.length === 0) return;
  await NotificationModel.insertMany(userIds.map((userId) => ({ userId, title, body, type, relatedEntityType: related?.type, relatedEntityId: related?.id })));
  for (const id of userIds) emitToUser(id, "notification:new", { title, body, type });
  void sendPushToUsers(userIds, { title, body });
}
