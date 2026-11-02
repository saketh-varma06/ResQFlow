import { Schema, model, Types } from "mongoose";
import {
  INCIDENT_TYPES,
  INCIDENT_STATUSES,
  PRIORITY_LEVELS,
  SEVERITIES,
  type IncidentStatus,
  type IncidentType,
  type PriorityLevel,
  type Severity,
} from "./enums";

/**
 * Collection: incidents — mirrors the backend model (backend/src/models).
 * `location` is the human-readable place string (the API contract);
 * coordinates live in the scalar latitude/longitude pair. (An earlier
 * preparation draft stored a GeoJSON point in `location` and the string in
 * `locationText`; that collided with the API contract on the shared
 * collection and was aligned during the cutover — see docs/TEST_REPORT.md.)
 */
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
  /** Explainable rule-based score 0–100 (see backend priority util) — a sorting aid, not triage. */
  priorityScore: number;
  priorityLevel: PriorityLevel;
  priorityReasons: string[];
  /** Reference to users._id (the reporter). */
  reporterId: string;
  createdAt: Date;
  updatedAt: Date;
}

const incidentSchema = new Schema<Incident>(
  {
    _id: { type: String, default: () => new Types.ObjectId().toHexString() },
    title: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: INCIDENT_TYPES },
    severity: { type: String, required: true, enum: SEVERITIES },
    status: {
      type: String,
      enum: INCIDENT_STATUSES,
      default: "SUBMITTED",
    },
    description: { type: String, required: true },
    location: { type: String, required: true },
    area: { type: String, required: true },
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
    peopleAffected: { type: Number, default: 0, min: 0 },
    injuriesReported: { type: Number, default: 0, min: 0 },
    trapped: { type: Boolean, default: false },
    priorityScore: { type: Number, default: 0, min: 0, max: 100 },
    priorityLevel: {
      type: String,
      enum: PRIORITY_LEVELS,
      default: "LOW",
    },
    priorityReasons: { type: [String], default: [] },
    reporterId: { type: String, required: true, ref: "User" },
  },
  { timestamps: true },
);

incidentSchema.index({ status: 1 });
incidentSchema.index({ status: 1, createdAt: -1 });
incidentSchema.index({ severity: 1 });
incidentSchema.index({ type: 1 });
incidentSchema.index({ area: 1 });
incidentSchema.index({ reporterId: 1 });
incidentSchema.index({ createdAt: -1 });
incidentSchema.index({ priorityLevel: 1 });
incidentSchema.index({ priorityLevel: 1, priorityScore: -1, createdAt: 1 });

export const IncidentModel = model<Incident>(
  "Incident",
  incidentSchema,
  "incidents",
);
