import { prisma } from "../database/prisma";
import { ApiError } from "../utils/ApiError";
import { parsePagination, pageMeta } from "../utils/pagination";
import { stripUserDeep } from "./serialize";
import type { z } from "zod";
import type { listAuditQuery } from "../validators/audit.validators";

export async function listAudit(q: z.infer<typeof listAuditQuery>) {
  const p = parsePagination(q as Record<string, unknown>);
  const where = { ...(q.result ? { result: q.result } : {}), ...(q.action ? { action: q.action } : {}), ...(q.actorId ? { actorId: q.actorId } : {}), ...(q.actorEmail ? { actorEmail: { contains: q.actorEmail, mode: "insensitive" as const } } : {}),
    ...(q.search ? { OR: [{ action: { contains: q.search, mode: "insensitive" as const } }, { actorEmail: { contains: q.search, mode: "insensitive" as const } }, { targetType: { contains: q.search, mode: "insensitive" as const } }] } : {}) };
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, skip: p.skip, take: p.limit, orderBy: { createdAt: "desc" }, include: { actor: { select: { id: true, name: true, role: true } } } }),
  ]);
  return { data: stripUserDeep(rows), meta: pageMeta(total, p) };
}
export async function getAudit(id: string) {
  const row = await prisma.auditLog.findUnique({ where: { id }, include: { actor: { select: { id: true, name: true, role: true } } } });
  if (!row) throw ApiError.notFound("Audit entry not found");
  return stripUserDeep(row);
}
