import { Schema, model, Types } from "mongoose";
import {
  PRIORITY_LEVELS,
  SOS_CATEGORIES,
  SOS_STATUSES,
  type PriorityLevel,
  type SosCategory,
  type SosStatus,
} from "./enums";
import { geoPointSchema, type GeoPoint } from "./geoPoint";

/**
 * Collection: sosRequests — mirrors Prisma model `SOSRequest`.
 * The currently-assigned responder is a single optional reference
 * (`responderProfileId` → responders._id), matching PostgreSQL, where the
 * equivalent relation uses onDelete: SetNull. Full assignment history for
 * incidents lives in the separate `assignments` collection.
 */
export interface SosRequest {
  _id: string;
  /** Reference to users._id (the citizen). */
  citizenId: string;
  need: string;
  category: SosCategory;
  people: number;
  injuriesReported: number;
  trapped: boolean;
  priorityScore: number;
  priorityLevel: PriorityLevel;
  priorityReasons: string[];
  locationText: string;
  area?: string;
  latitude?: number;
  longitude?: number;
  location?: GeoPoint;
  details?: string;
  phone?: string;
  status: SosStatus;
  /** Reference to responders._id, null when unassigned. */
  responderProfileId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const sosRequestSchema = new Schema<SosRequest>(
  {
    _id: { type: String, default: () => new Types.ObjectId().toHexString() },
    citizenId: { type: String, required: true, ref: "User" },
    need: { type: String, required: true, trim: true },
    category: { type: String, enum: SOS_CATEGORIES, default: "OTHER" },
    people: { type: Number, default: 1, min: 1 },
    injuriesReported: { type: Number, default: 0, min: 0 },
    trapped: { type: Boolean, default: false },
    priorityScore: { type: Number, default: 0, min: 0, max: 100 },
    priorityLevel: {
      type: String,
      enum: PRIORITY_LEVELS,
      default: "LOW",
    },
    priorityReasons: { type: [String], default: [] },
    locationText: { type: String, required: true },
    area: { type: String },
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
    location: { type: geoPointSchema },
    details: { type: String },
    phone: { type: String, trim: true },
    status: { type: String, enum: SOS_STATUSES, default: "SUBMITTED" },
    responderProfileId: {
      type: String,
      ref: "Responder",
      default: null,
    },
  },
  { timestamps: true },
);

sosRequestSchema.index({ status: 1 });
sosRequestSchema.index({ status: 1, createdAt: -1 });
sosRequestSchema.index({ citizenId: 1 });
sosRequestSchema.index({ citizenId: 1, createdAt: -1 });
sosRequestSchema.index({ createdAt: -1 });
sosRequestSchema.index({ priorityLevel: 1 });
sosRequestSchema.index({ responderProfileId: 1 });
sosRequestSchema.index({ location: "2dsphere" });

export const SosRequestModel = model<SosRequest>(
  "SosRequest",
  sosRequestSchema,
  "sosRequests",
);
