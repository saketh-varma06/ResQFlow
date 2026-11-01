import type { ShelterStatus } from "@prisma/client";
import { prisma } from "../database/prisma";
import { ApiError } from "../utils/ApiError";
import { parsePagination, pageMeta } from "../utils/pagination";
import { writeAudit } from "../utils/audit";
import { stripUserDeep } from "./serialize";
import { emitToRole } from "../utils/realtime";
import type { AuthUser } from "../types/auth";
import type { z } from "zod";
import type { createShelterSchema, listSheltersQuery, updateShelterSchema } from "../validators/shelter.validators";

const withAvailable = <T extends { capacity: number; occupied: number }>(s: T) => ({ ...s, available: Math.max(0, s.capacity - s.occupied) });

export function deriveStatus(capacity: number, occupied: number, requested?: ShelterStatus): ShelterStatus {
  if (requested === "CLOSED") return "CLOSED";
  if (occupied >= capacity) return "FULL";
  if (occupied / capacity >= 0.9) return "NEARLY_FULL";
  return "OPEN";
}

export async function listShelters(q: z.infer<typeof listSheltersQuery>) {
  const p = parsePagination(q as Record<string, unknown>);
  const where = { ...(q.area ? { area: q.area } : {}), ...(q.status ? { status: q.status } : {}),
    ...(q.search ? { OR: [{ name: { contains: q.search, mode: "insensitive" as const } }, { address: { contains: q.search, mode: "insensitive" as const } }] } : {}) };
  const [total, rows] = await Promise.all([
    prisma.shelter.count({ where }),
    prisma.shelter.findMany({ where, skip: p.skip, take: p.limit, orderBy: { name: "asc" } }),
  ]);
  const filtered = q.withSpace ? rows.filter((s) => s.occupied < s.capacity) : rows;
  return { data: stripUserDeep(filtered.map(withAvailable)), meta: pageMeta(q.withSpace ? filtered.length : total, p) };
}

export async function getShelter(id: string) {
  const shelter = await prisma.shelter.findUnique({ where: { id } });
  if (!shelter) throw ApiError.notFound("Shelter not found");
  return stripUserDeep(withAvailable(shelter));
}

export async function createShelter(actor: AuthUser, input: z.infer<typeof createShelterSchema>, ip?: string) {
  const occupied = input.occupied ?? 0;
  if (occupied > input.capacity) throw ApiError.badRequest("occupied cannot exceed capacity");
  const shelter = await prisma.shelter.create({ data: { ...input, occupied, status: deriveStatus(input.capacity, occupied, input.status), createdById: actor.id } });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "shelter.create", targetType: "Shelter", targetId: shelter.id, details: { name: shelter.name }, ipAddress: ip });
  const out = stripUserDeep(withAvailable(shelter));
  for (const role of ["CITIZEN", "RESPONDER", "ADMIN"]) emitToRole(role, "shelter:created", out);
  return out;
}

export async function updateShelter(actor: AuthUser, id: string, input: z.infer<typeof updateShelterSchema>, ip?: string) {
  const existing = await prisma.shelter.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Shelter not found");
  const capacity = input.capacity ?? existing.capacity;
  const occupied = input.occupied ?? existing.occupied;
  if (occupied > capacity) throw ApiError.badRequest("occupied cannot exceed capacity");
  const shelter = await prisma.shelter.update({ where: { id }, data: { ...input, status: deriveStatus(capacity, occupied, input.status ?? existing.status) } });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "shelter.update", targetType: "Shelter", targetId: id, details: input, ipAddress: ip });
  const out = stripUserDeep(withAvailable(shelter));
  for (const role of ["CITIZEN", "RESPONDER", "ADMIN"]) emitToRole(role, "shelter:updated", out);
  return out;
}

export async function deleteShelter(actor: AuthUser, id: string, ip?: string) {
  const existing = await prisma.shelter.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Shelter not found");
  await prisma.shelter.delete({ where: { id } });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "shelter.delete", targetType: "Shelter", targetId: id, details: { name: existing.name }, ipAddress: ip });
  for (const role of ["CITIZEN", "RESPONDER", "ADMIN"]) emitToRole(role, "shelter:deleted", { id });
  return { deleted: true };
}
