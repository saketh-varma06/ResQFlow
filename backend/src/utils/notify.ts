import type { NotificationType } from "@prisma/client";
import { prisma } from "../database/prisma";
import { emitToUser } from "./realtime";
export async function notifyUser(userId: string, title: string, body: string, type: NotificationType = "SYSTEM", related?: { type: string; id: string }) {
  const n = await prisma.notification.create({ data: { userId, title, body, type, relatedEntityType: related?.type, relatedEntityId: related?.id } });
  emitToUser(userId, "notification:new", n);
  return n;
}
export async function notifyUsers(userIds: string[], title: string, body: string, type: NotificationType = "SYSTEM", related?: { type: string; id: string }) {
  if (userIds.length === 0) return;
  await prisma.notification.createMany({ data: userIds.map((userId) => ({ userId, title, body, type, relatedEntityType: related?.type, relatedEntityId: related?.id })) });
  for (const id of userIds) emitToUser(id, "notification:new", { title, body, type });
}
