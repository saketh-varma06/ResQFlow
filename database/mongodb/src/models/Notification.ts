import { Schema, model, Types } from "mongoose";
import { NOTIFICATION_TYPES, type NotificationType } from "./enums";

/**
 * Collection: notifications — mirrors Prisma model `Notification`.
 * Polymorphic link to the thing the notification is about is kept as the
 * (relatedEntityType, relatedEntityId) string pair, as in PostgreSQL —
 * MongoDB references cannot point at a variable collection, so this is the
 * honest equivalent.
 */
export interface Notification {
  _id: string;
  /** Reference to users._id (the recipient). */
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
notificationSchema.index({ userId: 1, createdAt: -1 });

export const NotificationModel = model<Notification>(
  "Notification",
  notificationSchema,
  "notifications",
);
