import { Schema, model, Types } from "mongoose";

/** Collection: pushSubscriptions — Web Push endpoints per user device (Stage B). */
export interface PushSubscription {
  _id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const pushSubscriptionSchema = new Schema<PushSubscription>(
  {
    _id: { type: String, default: () => new Types.ObjectId().toHexString() },
    userId: { type: String, required: true, ref: "User" },
    endpoint: { type: String, required: true, unique: true },
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
    userAgent: { type: String },
  },
  { timestamps: true },
);
pushSubscriptionSchema.index({ userId: 1 });

export const PushSubscriptionModel = model<PushSubscription>("PushSubscription", pushSubscriptionSchema, "pushSubscriptions");
