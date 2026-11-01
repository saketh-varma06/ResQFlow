import { prisma } from "../database/prisma";
import { ApiError } from "../utils/ApiError";
import { parsePagination, pageMeta } from "../utils/pagination";
import { writeAudit } from "../utils/audit";
import { notifyUser, notifyUsers } from "../utils/notify";
import { emitToRole, emitToUser } from "../utils/realtime";
import { stripUserDeep } from "./serialize";
import type { AuthUser } from "../types/auth";
import type { z } from "zod";
import type { assignIncidentSchema, createIncidentSchema, listIncidentsQuery, updateIncidentSchema, updateIncidentStatusSchema } from "../validators/incident.validators";
import type { IncidentStatus } from "@prisma/client";
import { computePriority } from "../utils/priority";
import { assertTransition } from "../utils/workflow";

const include = {
  reporter: { select: { id: true, name: true, email: true, role: true, area: true } },
  assignments: { include: { responderProfile: { include: { user: { select: { id: true, name: true, email: true } } } } } },
  statusHistory: { orderBy: { createdAt: "desc" as const }, take: 50, include: { changedBy: { select: { id: true, name: true, role: true } } } },
};

export async function createIncident(actor: AuthUser, input: z.infer<typeof createIncidentSchema>, ip?: string) {
  const now = new Date();
  const priority = computePriority({ severity: input.severity, category: input.type, peopleAffected: input.peopleAffected, injuriesReported: input.injuriesReported, trapped: input.trapped, submittedAt: now, now });
  const incident = await prisma.incident.create({ data: { ...input, reporterId: actor.id, priorityScore: priority.score, priorityLevel: priority.level, priorityReasons: priority.reasons }, include });
  await prisma.incidentStatusHistory.create({ data: { incidentId: incident.id, fromStatus: null, toStatus: "SUBMITTED", changedById: actor.id, note: "Incident reported" } });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "incident.create", targetType: "Incident", targetId: incident.id, ipAddress: ip });
  emitToRole("RESPONDER", "incident:created", stripUserDeep(incident));
  emitToRole("ADMIN", "incident:created", stripUserDeep(incident));
  return stripUserDeep(incident);
}

export async function listIncidents(actor: AuthUser, q: z.infer<typeof listIncidentsQuery>) {
  const p = parsePagination(q as Record<string, unknown>);
  const where = {
    ...(q.status ? { status: q.status } : {}), ...(q.severity ? { severity: q.severity } : {}),
    ...(q.type ? { type: q.type } : {}), ...(q.area ? { area: q.area } : {}),
    ...(q.mine ? { reporterId: actor.id } : {}),
    ...(q.search ? { OR: [{ title: { contains: q.search, mode: "insensitive" as const } }, { location: { contains: q.search, mode: "insensitive" as const } }] } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.incident.count({ where }),
    prisma.incident.findMany({ where, skip: p.skip, take: p.limit, orderBy: { createdAt: "desc" }, include: { reporter: { select: { id: true, name: true, role: true } }, assignments: { include: { responderProfile: { select: { id: true, unitName: true, unitType: true } } } } } }),
  ]);
  return { data: stripUserDeep(rows), meta: pageMeta(total, p) };
}

export async function getIncident(id: string) {
  const incident = await prisma.incident.findUnique({ where: { id }, include });
  if (!incident) throw ApiError.notFound("Incident not found");
  return stripUserDeep(incident);
}

export async function updateIncident(actor: AuthUser, id: string, input: z.infer<typeof updateIncidentSchema>, ip?: string) {
  const existing = await prisma.incident.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Incident not found");
  if (actor.role === "CITIZEN" && existing.reporterId !== actor.id) throw ApiError.forbidden("You can only edit your own reports");
  if (actor.role === "CITIZEN" && existing.status !== "SUBMITTED") throw ApiError.forbidden("This report can no longer be edited");
  const priority = computePriority({ severity: input.severity ?? existing.severity, category: input.type ?? existing.type, peopleAffected: input.peopleAffected ?? existing.peopleAffected, injuriesReported: input.injuriesReported ?? existing.injuriesReported, trapped: input.trapped ?? existing.trapped, submittedAt: existing.createdAt });
  const updated = await prisma.incident.update({ where: { id }, data: { ...input, priorityScore: priority.score, priorityLevel: priority.level, priorityReasons: priority.reasons }, include });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "incident.update", targetType: "Incident", targetId: id, details: input, ipAddress: ip });
  return stripUserDeep(updated);
}

export async function updateIncidentStatus(actor: AuthUser, id: string, input: z.infer<typeof updateIncidentStatusSchema>, ip?: string) {
  const existing = await prisma.incident.findUnique({ where: { id }, include: { assignments: true } });
  if (!existing) throw ApiError.notFound("Incident not found");
  if (actor.role === "CITIZEN") throw ApiError.forbidden("Citizens cannot change incident status");
  if (actor.role === "RESPONDER") {
    const profile = await prisma.responderProfile.findUnique({ where: { userId: actor.id } });
    const assigned = profile && existing.assignments.some((a) => a.responderProfileId === profile.id && a.status !== "CANCELLED" && a.status !== "DECLINED");
    if (!assigned) throw ApiError.forbidden("This incident is not assigned to your unit");
  }
  if (existing.status === input.status) return getIncident(id);
  assertTransition(existing.status, input.status);
  const updated = await prisma.incident.update({ where: { id }, data: { status: input.status }, include });
  await prisma.incidentStatusHistory.create({ data: { incidentId: id, fromStatus: existing.status, toStatus: input.status, changedById: actor.id, note: input.note } });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "incident.status_change", targetType: "Incident", targetId: id, details: { from: existing.status, to: input.status }, ipAddress: ip });
  if (existing.reporterId !== actor.id) {
    await notifyUser(existing.reporterId, "Incident status updated", `"${existing.title}" is now ${input.status.replace(/_/g, " ").toLowerCase()}.`, "INCIDENT_UPDATE", { type: "Incident", id });
  }
  emitToRole("RESPONDER", "incident:updated", stripUserDeep(updated));
  emitToRole("ADMIN", "incident:updated", stripUserDeep(updated));
  emitToUser(existing.reporterId, "incident:updated", stripUserDeep(updated));
  return stripUserDeep(updated);
}

export async function assignIncident(actor: AuthUser, id: string, input: z.infer<typeof assignIncidentSchema>, ip?: string) {
  const incident = await prisma.incident.findUnique({ where: { id } });
  if (!incident) throw ApiError.notFound("Incident not found");
  const profile = await prisma.responderProfile.findUnique({ where: { id: input.responderProfileId }, include: { user: true } });
  if (!profile) throw ApiError.notFound("Responder unit not found");
  const assignment = await prisma.incidentAssignment.upsert({
    where: { incidentId_responderProfileId: { incidentId: id, responderProfileId: profile.id } },
    create: { incidentId: id, responderProfileId: profile.id, assignedById: actor.id, notes: input.notes, status: "PENDING" },
    update: { status: "PENDING", notes: input.notes, assignedById: actor.id, respondedAt: null, completedAt: null },
    include: { responderProfile: { include: { user: { select: { id: true, name: true, email: true } } } }, incident: true },
  });
  if (incident.status === "SUBMITTED" || incident.status === "ACKNOWLEDGED") {
    await prisma.incident.update({ where: { id }, data: { status: "ASSIGNED" } });
    await prisma.incidentStatusHistory.create({ data: { incidentId: id, fromStatus: incident.status, toStatus: "ASSIGNED", changedById: actor.id, note: `Assigned to ${profile.unitName}` } });
  } else if (incident.status !== "ASSIGNED") {
    throw ApiError.badRequest(`Cannot assign a responder while the incident is ${incident.status}`);
  }
  await prisma.responderProfile.update({ where: { id: profile.id }, data: { readiness: "DEPLOYED" } });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "incident.assign", targetType: "Incident", targetId: id, details: { responderProfileId: profile.id, unit: profile.unitName }, ipAddress: ip });
  await notifyUser(profile.userId, "New incident assignment", `Your unit ${profile.unitName} was assigned to "${incident.title}".`, "INCIDENT_UPDATE", { type: "Incident", id });
  if (incident.reporterId !== actor.id) await notifyUser(incident.reporterId, "Responder assigned", `A responder unit was assigned to your report "${incident.title}".`, "INCIDENT_UPDATE", { type: "Incident", id });
  emitToRole("RESPONDER", "incident:assigned", stripUserDeep(assignment));
  return stripUserDeep(assignment);
}

export async function respondToAssignment(actor: AuthUser, incidentId: string, action: "accept" | "decline" | "complete") {
  const profile = await prisma.responderProfile.findUnique({ where: { userId: actor.id } });
  if (!profile) throw ApiError.forbidden("You do not have a responder profile");
  const assignment = await prisma.incidentAssignment.findUnique({ where: { incidentId_responderProfileId: { incidentId, responderProfileId: profile.id } }, include: { incident: true } });
  if (!assignment) throw ApiError.notFound("Assignment not found for your unit");
  const map = { accept: "ACCEPTED", decline: "DECLINED", complete: "COMPLETED" } as const;
  const updated = await prisma.incidentAssignment.update({ where: { id: assignment.id }, data: {
    status: map[action],
    respondedAt: action === "complete" ? assignment.respondedAt : new Date(),
    completedAt: action === "complete" ? new Date() : assignment.completedAt,
  } });
  if (action === "accept") await updateIncidentStatus(actor, incidentId, { status: "IN_PROGRESS" as IncidentStatus }).catch(() => undefined);
  if (action === "complete") {
    await updateIncidentStatus(actor, incidentId, { status: "RESOLVED" as IncidentStatus, note: "Assignment completed by responder unit" });
  }
  return stripUserDeep(updated);
}

export async function deleteIncident(actor: AuthUser, id: string, ip?: string) {
  const existing = await prisma.incident.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Incident not found");
  await prisma.incident.delete({ where: { id } });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "incident.delete", targetType: "Incident", targetId: id, details: { title: existing.title }, ipAddress: ip });
  return { deleted: true };
}

export async function notifyAdminsOfIncident(incidentId: string, title: string) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { id: true } });
  await notifyUsers(admins.map((a) => a.id), "New incident reported", title, "INCIDENT_UPDATE", { type: "Incident", id: incidentId });
}

export async function addNote(actor: AuthUser, id: string, note: string, ip?: string) {
  const incident = await prisma.incident.findUnique({ where: { id }, include: { assignments: true } });
  if (!incident) throw ApiError.notFound("Incident not found");
  if (actor.role === "CITIZEN") throw ApiError.forbidden("Citizens cannot add response notes");
  if (actor.role === "RESPONDER") {
    const profile = await prisma.responderProfile.findUnique({ where: { userId: actor.id } });
    const assigned = profile && incident.assignments.some((a) => a.responderProfileId === profile.id && a.status !== "CANCELLED" && a.status !== "DECLINED");
    if (!assigned) throw ApiError.forbidden("This incident is not assigned to your unit");
  }
  const entry = await prisma.incidentStatusHistory.create({ data: { incidentId: id, fromStatus: incident.status, toStatus: incident.status, changedById: actor.id, note }, include: { changedBy: { select: { id: true, name: true, role: true } } } });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "incident.note", targetType: "Incident", targetId: id, ipAddress: ip });
  if (incident.reporterId !== actor.id) await notifyUser(incident.reporterId, "New update on your incident", note.slice(0, 140), "INCIDENT_UPDATE", { type: "Incident", id });
  return stripUserDeep(entry);
}
