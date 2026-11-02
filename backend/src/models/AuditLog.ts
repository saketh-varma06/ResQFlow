import { Schema, model, Types, type Mixed } from "mongoose";
import { AUDIT_RESULTS } from "./enums";
import type { AuditResult } from "../types/enums";

/** Collection: auditLogs — mirrors the former Prisma model `AuditLog` (createdAt only, no updatedAt). */
export interface AuditLog {
  _id: string;
  actorId?: string | null;
  actorEmail?: string;
  action: string;
  targetType: string;
  targetId?: string;
  details?: Mixed;
  result: AuditResult;
  ipAddress?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<AuditLog>(
  {
    _id: { type: String, default: () => new Types.ObjectId().toHexString() },
    actorId: { type: String, ref: "User", default: null },
    actorEmail: { type: String },
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: { type: String },
    details: { type: Schema.Types.Mixed },
    result: { type: String, enum: AUDIT_RESULTS, default: "SUCCESS" },
    ipAddress: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ actorId: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ result: 1 });
auditLogSchema.index({ createdAt: 1 });

auditLogSchema.virtual("actor", {
  ref: "User",
  localField: "actorId",
  foreignField: "_id",
  justOne: true,
});

export const AuditLogModel = model<AuditLog>("AuditLog", auditLogSchema, "auditLogs");
