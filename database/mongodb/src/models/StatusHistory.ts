import { Schema, model, Types } from "mongoose";
import {
  INCIDENT_STATUSES,
  SOS_STATUSES,
  STATUS_HISTORY_ENTITY_TYPES,
  type StatusHistoryEntityType,
} from "./enums";

/**
 * Collection: statusHistory — UNIFIES Prisma models `IncidentStatusHistory`
 * and `SOSStatusHistory`, which have identical shapes. The discriminator is
 * `entityType` ("INCIDENT" | "SOS") + `entityId` (the incident's or SOS
 * request's _id). `fromStatus`/`toStatus` are validated at the application
 * layer against the entity's own enum (incident statuses exclude CANCELLED,
 * SOS statuses include it) because a single schema-level enum cannot express
 * both; the allowed value set below is the union of the two Prisma enums.
 *
 * DESIGN DECISION: a SEPARATE referenced collection, NOT an embedded array
 * on incidents/sosRequests. Justification: history is append-only and
 * unbounded — embedding it would grow the parent document on every status
 * change, cause write contention on hot incident documents, and approach
 * the 16 MB document limit on long-lived incidents. Timeline queries
 * ("full history of X, oldest first"; "average time to acknowledge" across
 * all entities — the analytics the app already computes) are collection
 * scans/aggregations, not document reads. See docs/DATABASE_DESIGN.md §2.3.
 */
export interface StatusHistory {
  _id: string;
  entityType: StatusHistoryEntityType;
  /** _id of the incident or SOS request this entry belongs to. */
  entityId: string;
  /** Null on the creation entry. */
  fromStatus?: string | null;
  toStatus: string;
  /** Reference to users._id (who made the change). */
  changedById: string;
  note?: string;
  createdAt: Date;
}

const ALL_WORKFLOW_STATUSES = Array.from(
  new Set<string>([...INCIDENT_STATUSES, ...SOS_STATUSES]),
);

const statusHistorySchema = new Schema<StatusHistory>(
  {
    _id: { type: String, default: () => new Types.ObjectId().toHexString() },
    entityType: {
      type: String,
      required: true,
      enum: STATUS_HISTORY_ENTITY_TYPES,
    },
    entityId: { type: String, required: true },
    fromStatus: {
      type: String,
      enum: [...ALL_WORKFLOW_STATUSES, null],
      default: null,
    },
    toStatus: {
      type: String,
      required: true,
      enum: ALL_WORKFLOW_STATUSES,
    },
    changedById: { type: String, required: true, ref: "User" },
    note: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

statusHistorySchema.index({ entityType: 1, entityId: 1, createdAt: 1 });
statusHistorySchema.index({ changedById: 1 });
statusHistorySchema.index({ entityId: 1, createdAt: 1 });

export const StatusHistoryModel = model<StatusHistory>(
  "StatusHistory",
  statusHistorySchema,
  "statusHistory",
);
