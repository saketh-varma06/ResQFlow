import { Schema, model, Types } from "mongoose";
import { ALERT_SUB_MODES, SEVERITIES } from "./enums";

/**
 * Collection: alertSubscriptions — a citizen's geo-targeted alert subscription (Stage B).
 * DISTRICT: match alerts whose area equals `area` (or "All districts").
 * RADIUS: match alerts whose centre falls within `radiusKm` of the subscription centre
 * (expanded by the alert's own radius). minSeverity filters out weaker alerts.
 */
export interface AlertSubscription {
  _id: string;
  userId: string;
  mode: string;
  area?: string;
  centerLat?: number;
  centerLng?: number;
  radiusKm?: number;
  minSeverity?: string;
  createdAt: Date;
  updatedAt: Date;
}

const alertSubscriptionSchema = new Schema<AlertSubscription>(
  {
    _id: { type: String, default: () => new Types.ObjectId().toHexString() },
    userId: { type: String, required: true, ref: "User" },
    mode: { type: String, required: true, enum: ALERT_SUB_MODES },
    area: { type: String },
    centerLat: { type: Number },
    centerLng: { type: Number },
    radiusKm: { type: Number },
    minSeverity: { type: String, enum: SEVERITIES },
  },
  { timestamps: true },
);
alertSubscriptionSchema.index({ userId: 1 });
alertSubscriptionSchema.index({ mode: 1, area: 1 });

export const AlertSubscriptionModel = model<AlertSubscription>("AlertSubscription", alertSubscriptionSchema, "alertSubscriptions");
