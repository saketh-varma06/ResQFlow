import { Schema, model, Types } from "mongoose";
import { INCIDENT_STATUSES, SOS_STATUSES, STATUS_HISTORY_ENTITY_TYPES } from "./enums";

export type StatusHistoryEntityType = (typeof STATUS_HISTORY_ENTITY_TYPES)[number];

/**
 * Collection: statusHistory — unifies the former Prisma tables
 * `IncidentStatusHistory` and `SOSStatusHistory` via `entityType` + `entityId`.
 * The API serialiser maps entityId back to `incidentId` / `sosId`.
 */
export interface StatusHistory {
  _id: string;
  entityType: StatusHistoryEntityType;
  entityId: string;
  fromStatus?: string | null;
  toStatus: string;
  changedById: string;
  note?: string;
  createdAt: Date;
}

const ALL_WORKFLOW_STATUSES = Array.from(new Set<string>([...INCIDENT_STATUSES, ...SOS_STATUSES]));

const statusHistorySchema = new Schema<StatusHistory>(
  {
    _id: { type: String, default: () => new Types.ObjectId().toHexString() },
    entityType: { type: String, required: true, enum: STATUS_HISTORY_ENTITY_TYPES },
    entityId: { type: String, required: true },
    fromStatus: { type: String, enum: [...ALL_WORKFLOW_STATUSES, null], default: null },
    toStatus: { type: String, required: true, enum: ALL_WORKFLOW_STATUSES },
    changedById: { type: String, required: true, ref: "User" },
    note: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

statusHistorySchema.index({ entityType: 1, entityId: 1, createdAt: 1 });
statusHistorySchema.index({ changedById: 1 });

statusHistorySchema.virtual("changedBy", {
  ref: "User",
  localField: "changedById",
  foreignField: "_id",
  justOne: true,
});

export const StatusHistoryModel = model<StatusHistory>("StatusHistory", statusHistorySchema, "statusHistory");
