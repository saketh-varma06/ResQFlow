import { Schema, model, Types } from "mongoose";
import { PRIORITY_LEVELS, SOS_CATEGORIES, SOS_STATUSES } from "./enums";
import type { PriorityLevel, SOSCategory, SOSStatus } from "../types/enums";

/** Collection: sosRequests — mirrors the former Prisma model `SOSRequest`. `location` stays the human-readable string (API contract). */
export interface SosRequest {
  _id: string;
  citizenId: string;
  need: string;
  category: SOSCategory;
  people: number;
  injuriesReported: number;
  trapped: boolean;
  priorityScore: number;
  priorityLevel: PriorityLevel;
  priorityReasons: string[];
  location: string;
  area?: string;
  latitude?: number;
  longitude?: number;
  details?: string;
  phone?: string;
  status: SOSStatus;
  responderProfileId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const sosRequestSchema = new Schema<SosRequest>(
  {
    _id: { type: String, default: () => new Types.ObjectId().toHexString() },
    citizenId: { type: String, required: true, ref: "User" },
    need: { type: String, required: true },
    category: { type: String, enum: SOS_CATEGORIES, default: "OTHER" },
    people: { type: Number, default: 1 },
    injuriesReported: { type: Number, default: 0 },
    trapped: { type: Boolean, default: false },
    priorityScore: { type: Number, default: 0 },
    priorityLevel: { type: String, enum: PRIORITY_LEVELS, default: "LOW" },
    priorityReasons: { type: [String], default: [] },
    location: { type: String, required: true },
    area: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
    details: { type: String },
    phone: { type: String },
    status: { type: String, enum: SOS_STATUSES, default: "SUBMITTED" },
    responderProfileId: { type: String, ref: "Responder", default: null },
  },
  { timestamps: true },
);

sosRequestSchema.index({ status: 1 });
sosRequestSchema.index({ citizenId: 1 });
sosRequestSchema.index({ createdAt: 1 });
sosRequestSchema.index({ priorityLevel: 1 });

sosRequestSchema.virtual("citizen", {
  ref: "User",
  localField: "citizenId",
  foreignField: "_id",
  justOne: true,
});
sosRequestSchema.virtual("responderProfile", {
  ref: "Responder",
  localField: "responderProfileId",
  foreignField: "_id",
  justOne: true,
});
sosRequestSchema.virtual("statusHistory", {
  ref: "StatusHistory",
  localField: "_id",
  foreignField: "entityId",
  match: { entityType: "SOS" },
});

export const SosRequestModel = model<SosRequest>("SosRequest", sosRequestSchema, "sosRequests");
