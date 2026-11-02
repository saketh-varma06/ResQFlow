import { Schema, model, Types } from "mongoose";
import { ALERT_STATUSES, CAP_CATEGORIES, CAP_CERTAINTIES, CAP_URGENCIES, SEVERITIES } from "./enums";
import type { AlertStatus, Severity } from "../types/enums";

/** Collection: alerts — mirrors the former Prisma model `DisasterAlert`. */
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
  /** CAP 1.2 fields (Stage B). headline falls back to title in the CAP export. */
  headline?: string;
  capCategory: string;
  capUrgency: string;
  capCertainty: string;
  /** Geo-target: centre + radius (km) used by RADIUS subscriptions and the CAP circle. */
  centerLat?: number;
  centerLng?: number;
  radiusKm?: number;
  issuedById?: string | null;
  issuedAt: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const alertSchema = new Schema<Alert>(
  {
    _id: { type: String, default: () => new Types.ObjectId().toHexString() },
    title: { type: String, required: true },
    type: { type: String, required: true },
    severity: { type: String, required: true, enum: SEVERITIES },
    area: { type: String, required: true },
    instructions: { type: String, required: true },
    source: { type: String, default: "District Disaster Office" },
    status: { type: String, enum: ALERT_STATUSES, default: "DRAFT" },
    reach: { type: Number, default: 0 },
    headline: { type: String },
    capCategory: { type: String, enum: CAP_CATEGORIES, default: "Other" },
    capUrgency: { type: String, enum: CAP_URGENCIES, default: "Expected" },
    capCertainty: { type: String, enum: CAP_CERTAINTIES, default: "Possible" },
    centerLat: { type: Number },
    centerLng: { type: Number },
    radiusKm: { type: Number },
    issuedById: { type: String, ref: "User", default: null },
    issuedAt: { type: Date, default: () => new Date() },
    expiresAt: { type: Date },
  },
  { timestamps: true },
);

alertSchema.index({ status: 1 });
alertSchema.index({ area: 1 });
alertSchema.index({ severity: 1 });
alertSchema.index({ issuedAt: 1 });

export const AlertModel = model<Alert>("Alert", alertSchema, "alerts");
