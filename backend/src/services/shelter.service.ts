import type { ShelterStatus } from "../types/enums";
import { ShelterModel } from "../models";
import { ApiError } from "../utils/ApiError";
import { parsePagination, pageMeta } from "../utils/pagination";
import { writeAudit } from "../utils/audit";
import { ciOr } from "../utils/query";
import { out } from "./serialize";
import { emitToRole } from "../utils/realtime";
import type { AuthUser } from "../types/auth";
import type { z } from "zod";
import type { createShelterSchema, listSheltersQuery, updateShelterSchema } from "../validators/shelter.validators";

const withAvailable = <T extends { capacity: number; occupied: number }>(s: T) => ({ ...s, available: Math.max(0, s.capacity - s.occupied) });

type ShelterPlain = { capacity: number; occupied: number } & Record<string, unknown>;
const toShelterOut = (doc: unknown) => withAvailable(out(doc) as unknown as ShelterPlain);

export function deriveStatus(capacity: number, occupied: number, requested?: ShelterStatus): ShelterStatus {
  if (requested === "CLOSED") return "CLOSED";
  if (occupied >= capacity) return "FULL";
  if (occupied / capacity >= 0.9) return "NEARLY_FULL";
  return "OPEN";
}

export async function listShelters(q: z.infer<typeof listSheltersQuery>) {
  const p = parsePagination(q as Record<string, unknown>);
  const where = { ...(q.area ? { area: q.area } : {}), ...(q.status ? { status: q.status } : {}),
    ...(q.search ? ciOr(["name", "address"], q.search) : {}) };
  const [total, rows] = await Promise.all([
    ShelterModel.countDocuments(where),
    ShelterModel.find(where).sort({ name: 1 }).skip(p.skip).limit(p.limit),
  ]);
  const filtered = q.withSpace ? rows.filter((s) => s.occupied < s.capacity) : rows;
  return { data: (out(filtered) as unknown as ShelterPlain[]).map(withAvailable), meta: pageMeta(q.withSpace ? filtered.length : total, p) };
}

export async function getShelter(id: string) {
  const shelter = await ShelterModel.findById(id);
  if (!shelter) throw ApiError.notFound("Shelter not found");
  return toShelterOut(shelter);
}

export async function createShelter(actor: AuthUser, input: z.infer<typeof createShelterSchema>, ip?: string) {
  const occupied = input.occupied ?? 0;
  if (occupied > input.capacity) throw ApiError.badRequest("occupied cannot exceed capacity");
  const shelter = await ShelterModel.create({ ...input, occupied, status: deriveStatus(input.capacity, occupied, input.status), createdById: actor.id });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "shelter.create", targetType: "Shelter", targetId: shelter.id, details: { name: shelter.name }, ipAddress: ip });
  const result = toShelterOut(shelter);
  for (const role of ["CITIZEN", "RESPONDER", "ADMIN"]) emitToRole(role, "shelter:created", result);
  return result;
}

export async function updateShelter(actor: AuthUser, id: string, input: z.infer<typeof updateShelterSchema>, ip?: string) {
  const existing = await ShelterModel.findById(id);
  if (!existing) throw ApiError.notFound("Shelter not found");
  const capacity = input.capacity ?? existing.capacity;
  const occupied = input.occupied ?? existing.occupied;
  if (occupied > capacity) throw ApiError.badRequest("occupied cannot exceed capacity");
  const shelter = await ShelterModel.findByIdAndUpdate(id, { $set: { ...input, status: deriveStatus(capacity, occupied, input.status ?? existing.status) } }, { new: true });
  if (!shelter) throw ApiError.notFound("Shelter not found");
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "shelter.update", targetType: "Shelter", targetId: id, details: input, ipAddress: ip });
  const result = toShelterOut(shelter);
  for (const role of ["CITIZEN", "RESPONDER", "ADMIN"]) emitToRole(role, "shelter:updated", result);
  return result;
}

export async function deleteShelter(actor: AuthUser, id: string, ip?: string) {
  const existing = await ShelterModel.findById(id);
  if (!existing) throw ApiError.notFound("Shelter not found");
  await ShelterModel.findByIdAndDelete(id);
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "shelter.delete", targetType: "Shelter", targetId: id, details: { name: existing.name }, ipAddress: ip });
  for (const role of ["CITIZEN", "RESPONDER", "ADMIN"]) emitToRole(role, "shelter:deleted", { id });
  return { deleted: true };
}
