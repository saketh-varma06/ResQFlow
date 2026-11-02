import { Schema, model, Types } from "mongoose";
import { NOTIFICATION_TYPES } from "./enums";
import type { NotificationType } from "../types/enums";

/** Collection: notifications — mirrors the former Prisma model `Notification` (createdAt only, no updatedAt). */
export interface Notification {
  _id: string;
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  relatedEntityType?: string;
  relatedEntityId?: string;
  isRead: boolean;
  createdAt: Date;
}

const notificationSchema = new Schema<Notification>(
  {
    _id: { type: String, default: () => new Types.ObjectId().toHexString() },
    userId: { type: String, required: true, ref: "User" },
    title: { type: String, required: true },
    body: { type: String, required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, default: "SYSTEM" },
    relatedEntityType: { type: String },
    relatedEntityId: { type: String },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, createdAt: 1 });

export const NotificationModel = model<Notification>("Notification", notificationSchema, "notifications");
