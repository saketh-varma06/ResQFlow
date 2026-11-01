import { Schema, model, Types, type Mixed } from "mongoose";
import { AUDIT_RESULTS, type AuditResult } from "./enums";

/**
 * Collection: auditLogs — mirrors Prisma model `AuditLog`.
 * Append-only. `actorId` is nullable (anonymous / system actions and
 * actors deleted later keep their entry, with `actorEmail` denormalised at
 * write time exactly as in PostgreSQL, so the trail survives user deletion).
 * Prisma `details Json?` maps to a free-form Mixed field.
 */
export interface AuditLog {
  _id: string;
  /** Reference to users._id, null when anonymous or the actor was removed. */
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
auditLogSchema.index({ actorEmail: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ result: 1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1 });

export const AuditLogModel = model<AuditLog>(
  "AuditLog",
  auditLogSchema,
  "auditLogs",
);
