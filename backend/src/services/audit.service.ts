import { AuditLogModel } from "../models";
import { ApiError } from "../utils/ApiError";
import { parsePagination, pageMeta } from "../utils/pagination";
import { ci, ciOr } from "../utils/query";
import { out } from "./serialize";
import type { z } from "zod";
import type { listAuditQuery } from "../validators/audit.validators";

export async function listAudit(q: z.infer<typeof listAuditQuery>) {
  const p = parsePagination(q as Record<string, unknown>);
  const filter = { ...(q.result ? { result: q.result } : {}), ...(q.action ? { action: q.action } : {}), ...(q.actorId ? { actorId: q.actorId } : {}), ...(q.actorEmail ? ci("actorEmail", q.actorEmail) : {}),
    ...(q.search ? ciOr(["action", "actorEmail", "targetType"], q.search) : {}) };
  const [total, rows] = await Promise.all([
    AuditLogModel.countDocuments(filter),
    AuditLogModel.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).populate({ path: "actor", select: "name role" }),
  ]);
  return { data: out(rows), meta: pageMeta(total, p) };
}
export async function getAudit(id: string) {
  const row = await AuditLogModel.findById(id).populate({ path: "actor", select: "name role" });
  if (!row) throw ApiError.notFound("Audit entry not found");
  return out(row);
}
