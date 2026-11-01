import { Schema, model, Types } from "mongoose";
import {
  ALERT_STATUSES,
  SEVERITIES,
  type AlertStatus,
  type Severity,
} from "./enums";

/**
 * Collection: alerts — mirrors Prisma model `DisasterAlert`.
 * Note: Prisma `type` is a free-form string for alerts (unlike incidents),
 * so no enum is applied here.
 */
export interface Alert {
  _id: string;
  title: string;
  type: string;
  severity: Severity;
  area: string;
  instructions: string;
  source: string;
  status: AlertStatus;
  reach: number;
  /** Reference to users._id, null when the issuer was removed. */
  issuedById?: string | null;
  issuedAt: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const alertSchema = new Schema<Alert>(
  {
    _id: { type: String, default: () => new Types.ObjectId().toHexString() },
    title: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    severity: { type: String, required: true, enum: SEVERITIES },
    area: { type: String, required: true },
    instructions: { type: String, required: true },
    source: { type: String, default: "District Disaster Office" },
    status: { type: String, enum: ALERT_STATUSES, default: "DRAFT" },
    reach: { type: Number, default: 0, min: 0 },
    issuedById: { type: String, ref: "User", default: null },
    issuedAt: { type: Date, default: () => new Date() },
    expiresAt: { type: Date },
  },
  { timestamps: true },
);

alertSchema.index({ status: 1 });
alertSchema.index({ status: 1, issuedAt: -1 });
alertSchema.index({ area: 1 });
alertSchema.index({ severity: 1 });
alertSchema.index({ issuedAt: -1 });

export const AlertModel = model<Alert>("Alert", alertSchema, "alerts");
