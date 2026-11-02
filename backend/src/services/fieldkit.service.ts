import { ApiError } from "../utils/ApiError";
import { writeAudit } from "../utils/audit";
import { notifyUser } from "../utils/notify";
import { out } from "./serialize";
import { AssignmentModel, ChecklistStateModel, FieldReportModel, IncidentModel, ResponderModel, SosRequestModel } from "../models";
import { checklistFor } from "../utils/checklists";
import type { AuthUser } from "../types/auth";
import type { z } from "zod";
import type { checklistPatchSchema, fieldReportSchema } from "../validators/incident.validators";

export type EntityKind = "INCIDENT" | "SOS";

async function loadEntity(kind: EntityKind, id: string) {
  const doc = kind === "INCIDENT" ? await IncidentModel.findById(id) : await SosRequestModel.findById(id);
  if (!doc) throw ApiError.notFound(kind === "INCIDENT" ? "Incident not found" : "SOS request not found");
  return doc;
}
function categoryOf(kind: EntityKind, doc: Awaited<ReturnType<typeof loadEntity>>): string {
  return kind === "INCIDENT" ? (doc as InstanceType<typeof IncidentModel>).type : (doc as InstanceType<typeof SosRequestModel>).category;
}
function ownerIdOf(kind: EntityKind, doc: Awaited<ReturnType<typeof loadEntity>>): string {
  return kind === "INCIDENT" ? (doc as InstanceType<typeof IncidentModel>).reporterId : (doc as InstanceType<typeof SosRequestModel>).citizenId;
}

/** Write permission mirrors the notes rule: ADMIN always; RESPONDER when assigned
 *  (for an unassigned SOS, any responder may work the checklist while triaging). */
async function assertCanWork(actor: AuthUser, kind: EntityKind, doc: Awaited<ReturnType<typeof loadEntity>>) {
  if (actor.role === "ADMIN") return;
  if (actor.role !== "RESPONDER") throw ApiError.forbidden("Only responders and admins can do this");
  const profile = await ResponderModel.findOne({ userId: actor.id });
  if (!profile) throw ApiError.forbidden("You do not have a responder profile");
  if (kind === "INCIDENT") {
    const assignments = await AssignmentModel.find({ incidentId: doc.id });
    const assigned = assignments.some((a) => a.responderProfileId === profile.id && a.status !== "CANCELLED" && a.status !== "DECLINED");
    if (!assigned) throw ApiError.forbidden("This incident is not assigned to your unit");
  } else {
    const assignedTo = (doc as InstanceType<typeof SosRequestModel>).responderProfileId;
    if (assignedTo && assignedTo !== profile.id) throw ApiError.forbidden("This SOS is assigned to another unit");
  }
}

export async function getChecklist(actor: AuthUser, kind: EntityKind, id: string) {
  const doc = await loadEntity(kind, id);
  if (actor.role === "CITIZEN" && ownerIdOf(kind, doc) !== actor.id) throw ApiError.forbidden("You can only view your own reports");
  const category = categoryOf(kind, doc);
  const items = checklistFor(category);
  const state = await ChecklistStateModel.findOne({ entityType: kind, entityId: id }).populate("updatedBy", "name role");
  const checked = new Set(state?.checkedKeys ?? []);
  return {
    category,
    items: items.map((i) => ({ ...i, checked: checked.has(i.key) })),
    completedCount: items.filter((i) => checked.has(i.key)).length,
    totalCount: items.length,
    updatedBy: state ? out((state as unknown as { updatedBy?: unknown }).updatedBy ?? null) : null,
    updatedAt: state?.updatedAt ?? null,
  };
}

export async function updateChecklist(actor: AuthUser, kind: EntityKind, id: string, input: z.infer<typeof checklistPatchSchema>, ip?: string) {
  const doc = await loadEntity(kind, id);
  await assertCanWork(actor, kind, doc);
  const category = categoryOf(kind, doc);
  const validKeys = new Set(checklistFor(category).map((i) => i.key));
  const checkedKeys = input.checkedKeys.filter((k) => validKeys.has(k));
  await ChecklistStateModel.findOneAndUpdate(
    { entityType: kind, entityId: id },
    { $set: { category, checkedKeys, updatedById: actor.id }, $setOnInsert: { entityType: kind, entityId: id } },
    { new: true, upsert: true },
  );
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: kind === "INCIDENT" ? "incident.checklist" : "sos.checklist", targetType: kind === "INCIDENT" ? "Incident" : "SOSRequest", targetId: id, details: { completed: checkedKeys.length }, ipAddress: ip });
  return getChecklist(actor, kind, id);
}

export async function listFieldReports(actor: AuthUser, kind: EntityKind, id: string) {
  const doc = await loadEntity(kind, id);
  if (actor.role === "CITIZEN" && ownerIdOf(kind, doc) !== actor.id) throw ApiError.forbidden("You can only view your own reports");
  const rows = await FieldReportModel.find({ entityType: kind, entityId: id }).sort({ createdAt: -1 }).limit(50).populate("author", "name role");
  return out(rows);
}

export async function createFieldReport(actor: AuthUser, kind: EntityKind, id: string, input: z.infer<typeof fieldReportSchema>, ip?: string) {
  const doc = await loadEntity(kind, id);
  await assertCanWork(actor, kind, doc);
  const report = await FieldReportModel.create({ entityType: kind, entityId: id, authorId: actor.id, ...input });
  const populated = await FieldReportModel.findById(report.id).populate("author", "name role");
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: kind === "INCIDENT" ? "incident.field_report" : "sos.field_report", targetType: kind === "INCIDENT" ? "Incident" : "SOSRequest", targetId: id, ipAddress: ip });
  const ownerId = ownerIdOf(kind, doc);
  if (ownerId !== actor.id) await notifyUser(ownerId, "Field report filed", `A responder filed a field report: ${input.situation.slice(0, 120)}`, kind === "INCIDENT" ? "INCIDENT_UPDATE" : "SOS_UPDATE", { type: kind === "INCIDENT" ? "Incident" : "SOSRequest", id });
  return out(populated);
}
