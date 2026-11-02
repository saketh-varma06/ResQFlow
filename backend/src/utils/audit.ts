import type { AuditResult } from "../types/enums";
import { AuditLogModel } from "../models";
export interface AuditInput { actorId?: string | null; actorEmail?: string | null; action: string; targetType: string; targetId?: string | null; details?: unknown; result?: AuditResult; ipAddress?: string | null; }
export async function writeAudit(input: AuditInput) {
  try {
    await AuditLogModel.create({
      actorId: input.actorId ?? null, actorEmail: input.actorEmail ?? null, action: input.action,
      targetType: input.targetType, targetId: input.targetId ?? null,
      details: input.details ?? undefined, result: input.result ?? "SUCCESS", ipAddress: input.ipAddress ?? null,
    });
  } catch { /* auditing must never break the request */ }
}
