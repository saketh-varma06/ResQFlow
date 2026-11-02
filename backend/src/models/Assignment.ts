import { Schema, model, Types } from "mongoose";
import { ASSIGNMENT_STATUSES } from "./enums";
import type { AssignmentStatus } from "../types/enums";

/** Collection: assignments — mirrors the former Prisma model `IncidentAssignment`. */
export interface Assignment {
  _id: string;
  incidentId: string;
  responderProfileId: string;
  assignedById: string;
  status: AssignmentStatus;
  notes?: string;
  assignedAt: Date;
  respondedAt?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const assignmentSchema = new Schema<Assignment>(
  {
    _id: { type: String, default: () => new Types.ObjectId().toHexString() },
    incidentId: { type: String, required: true, ref: "Incident" },
    responderProfileId: { type: String, required: true, ref: "Responder" },
    assignedById: { type: String, required: true, ref: "User" },
    status: { type: String, enum: ASSIGNMENT_STATUSES, default: "PENDING" },
    notes: { type: String },
    assignedAt: { type: Date, default: () => new Date() },
    respondedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

assignmentSchema.index({ incidentId: 1, responderProfileId: 1 }, { unique: true });
assignmentSchema.index({ responderProfileId: 1, status: 1 });
assignmentSchema.index({ incidentId: 1 });

assignmentSchema.virtual("responderProfile", {
  ref: "Responder",
  localField: "responderProfileId",
  foreignField: "_id",
  justOne: true,
});
assignmentSchema.virtual("incident", {
  ref: "Incident",
  localField: "incidentId",
  foreignField: "_id",
  justOne: true,
});

export const AssignmentModel = model<Assignment>("Assignment", assignmentSchema, "assignments");
