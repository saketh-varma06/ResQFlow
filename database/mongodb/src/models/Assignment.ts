import { Schema, model, Types } from "mongoose";
import { ASSIGNMENT_STATUSES, type AssignmentStatus } from "./enums";

/**
 * Collection: assignments — mirrors Prisma model `IncidentAssignment`.
 *
 * DESIGN DECISION: a SEPARATE referenced collection, NOT an embedded array
 * on incidents or responders. Justification: an assignment is a first-class
 * many-to-many join with its own lifecycle (PENDING → ACCEPTED / DECLINED →
 * COMPLETED / CANCELLED), its own timestamps and notes; it is queried from
 * both sides ("my assignments" for a responder, "who is on this incident"
 * for dispatch) and must enforce uniqueness of (incidentId,
 * responderProfileId) — all of which need a top-level collection with its
 * own indexes. Embedding would duplicate assignment state into two parents
 * and could not enforce the unique pair. See docs/DATABASE_DESIGN.md §2.3.
 */
export interface Assignment {
  _id: string;
  /** Reference to incidents._id. */
  incidentId: string;
  /** Reference to responders._id. */
  responderProfileId: string;
  /** Reference to users._id (the dispatcher/admin who made the assignment). */
  assignedById: string;
  status: AssignmentStatus;
  notes?: string;
  assignedAt: Date;
  respondedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const assignmentSchema = new Schema<Assignment>(
  {
    _id: { type: String, default: () => new Types.ObjectId().toHexString() },
    incidentId: { type: String, required: true, ref: "Incident" },
    responderProfileId: {
      type: String,
      required: true,
      ref: "Responder",
    },
    assignedById: { type: String, required: true, ref: "User" },
    status: {
      type: String,
      enum: ASSIGNMENT_STATUSES,
      default: "PENDING",
    },
    notes: { type: String },
    assignedAt: { type: Date, default: () => new Date() },
    respondedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

assignmentSchema.index(
  { incidentId: 1, responderProfileId: 1 },
  { unique: true },
);
assignmentSchema.index({ responderProfileId: 1, status: 1 });
assignmentSchema.index({ incidentId: 1 });

export const AssignmentModel = model<Assignment>(
  "Assignment",
  assignmentSchema,
  "assignments",
);
