import type { AuditResult } from "@prisma/client";
import { prisma } from "../database/prisma";
export interface AuditInput { actorId?: string | null; actorEmail?: string | null; action: string; targetType: string; targetId?: string | null; details?: unknown; result?: AuditResult; ipAddress?: string | null; }
export async function writeAudit(input: AuditInput) {
  try {
    await prisma.auditLog.create({ data: {
      actorId: input.actorId ?? null, actorEmail: input.actorEmail ?? null, action: input.action,
      targetType: input.targetType, targetId: input.targetId ?? null,
      details: (input.details ?? undefined) as never, result: input.result ?? "SUCCESS", ipAddress: input.ipAddress ?? null,
    } });
  } catch { /* auditing must never break the request */ }
}
