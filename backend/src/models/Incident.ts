import { Schema, model, Types } from "mongoose";
import { INCIDENT_TYPES, INCIDENT_STATUSES, PRIORITY_LEVELS, SEVERITIES, VERIFICATION_STATUSES, VULNERABLE_GROUPS } from "./enums";
import type { IncidentStatus, IncidentType, PriorityLevel, Severity, VerificationStatus, VulnerableGroup } from "../types/enums";

/** Collection: incidents — mirrors the former Prisma model `Incident`. `location` stays the human-readable string (API contract). */
export interface Incident {
  _id: string;
  title: string;
  type: IncidentType;
  severity: Severity;
  status: IncidentStatus;
  description: string;
  location: string;
  area: string;
  latitude?: number;
  longitude?: number;
  peopleAffected: number;
  injuriesReported: number;
  trapped: boolean;
  priorityScore: number;
  priorityLevel: PriorityLevel;
  priorityReasons: string[];
  verificationStatus: VerificationStatus;
  duplicateOfId?: string | null;
  vulnerableGroups: VulnerableGroup[];
  reporterId: string;
  createdAt: Date;
  updatedAt: Date;
}

const incidentSchema = new Schema<Incident>(
  {
    _id: { type: String, default: () => new Types.ObjectId().toHexString() },
    title: { type: String, required: true },
    type: { type: String, required: true, enum: INCIDENT_TYPES },
    severity: { type: String, required: true, enum: SEVERITIES },
    status: { type: String, enum: INCIDENT_STATUSES, default: "SUBMITTED" },
    description: { type: String, required: true },
    location: { type: String, required: true },
    area: { type: String, required: true },
    latitude: { type: Number },
    longitude: { type: Number },
    peopleAffected: { type: Number, default: 0 },
    injuriesReported: { type: Number, default: 0 },
    trapped: { type: Boolean, default: false },
    priorityScore: { type: Number, default: 0 },
    priorityLevel: { type: String, enum: PRIORITY_LEVELS, default: "LOW" },
    priorityReasons: { type: [String], default: [] },
    verificationStatus: { type: String, enum: VERIFICATION_STATUSES, default: "UNVERIFIED" },
    duplicateOfId: { type: String, default: null },
    vulnerableGroups: { type: [String], enum: VULNERABLE_GROUPS, default: [] },
    reporterId: { type: String, required: true, ref: "User" },
  },
  { timestamps: true },
);

incidentSchema.index({ status: 1 });
incidentSchema.index({ severity: 1 });
incidentSchema.index({ type: 1 });
incidentSchema.index({ area: 1 });
incidentSchema.index({ reporterId: 1 });
incidentSchema.index({ createdAt: 1 });
incidentSchema.index({ priorityLevel: 1 });

incidentSchema.virtual("reporter", {
  ref: "User",
  localField: "reporterId",
  foreignField: "_id",
  justOne: true,
});
incidentSchema.virtual("assignments", {
  ref: "Assignment",
  localField: "_id",
  foreignField: "incidentId",
});
incidentSchema.virtual("statusHistory", {
  ref: "StatusHistory",
  localField: "_id",
  foreignField: "entityId",
  match: { entityType: "INCIDENT" },
});

export const IncidentModel = model<Incident>("Incident", incidentSchema, "incidents");
