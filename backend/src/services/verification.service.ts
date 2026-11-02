import { ApiError } from "../utils/ApiError";
import { writeAudit } from "../utils/audit";
import { notifyUser } from "../utils/notify";
import { emitToRole, emitToUser } from "../utils/realtime";
import { out } from "./serialize";
import { IncidentModel, SosRequestModel } from "../models";
import type { AuthUser } from "../types/auth";

/**
 * Verification + duplicate detection (Stage A).
 *
 * Verification is deliberately separate from the workflow status: a report can be
 * ACKNOWLEDGED by the control room while still UNVERIFIED. Duplicate detection is
 * deterministic (geo distance + time window + area + text overlap + same reporter /
 * phone) and only ever *suggests* candidates — a human responder or admin confirms
 * the merge. Nothing is auto-merged or auto-deleted.
 */

export type EntityKind = "INCIDENT" | "SOS";

const WINDOW_MS = 12 * 60 * 60 * 1000;

function tokenize(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2));
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

interface SourceShape {
  id: string;
  category: string;
  text: string;
  area?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  reporterKey: string;
  phone?: string | null;
  createdAt: Date;
}

function incidentShape(d: InstanceType<typeof IncidentModel>): SourceShape {
  return { id: d.id, category: d.type, text: `${d.title} ${d.description}`, area: d.area, latitude: d.latitude, longitude: d.longitude, reporterKey: d.reporterId, createdAt: d.createdAt };
}
function sosShape(d: InstanceType<typeof SosRequestModel>): SourceShape {
  return { id: d.id, category: d.category, text: `${d.need} ${d.details ?? ""} ${d.location}`, area: d.area, latitude: d.latitude, longitude: d.longitude, reporterKey: d.citizenId, phone: d.phone, createdAt: d.createdAt };
}

export async function duplicateCandidates(kind: EntityKind, id: string) {
  const from = new Date(Date.now() - WINDOW_MS);
  const to = new Date(Date.now() + WINDOW_MS);
  let source: SourceShape;
  let pool: SourceShape[];
  let summaries: Map<string, Record<string, unknown>>;
  if (kind === "INCIDENT") {
    const doc = await IncidentModel.findById(id);
    if (!doc) throw ApiError.notFound("Incident not found");
    source = incidentShape(doc);
    const rows = await IncidentModel.find({ _id: { $ne: id }, type: doc.type, verificationStatus: { $ne: "FLAGGED_DUPLICATE" }, status: { $ne: "CLOSED" }, createdAt: { $gte: from, $lte: to } }).sort({ createdAt: -1 }).limit(50);
    pool = rows.map(incidentShape);
    summaries = new Map(rows.map((r) => [r.id, { id: r.id, title: r.title, location: r.location, area: r.area, status: r.status, priorityLevel: r.priorityLevel, verificationStatus: r.verificationStatus, createdAt: r.createdAt }]));
  } else {
    const doc = await SosRequestModel.findById(id);
    if (!doc) throw ApiError.notFound("SOS request not found");
    source = sosShape(doc);
    const rows = await SosRequestModel.find({ _id: { $ne: id }, category: doc.category, verificationStatus: { $ne: "FLAGGED_DUPLICATE" }, status: { $nin: ["CLOSED", "CANCELLED"] }, createdAt: { $gte: from, $lte: to } }).sort({ createdAt: -1 }).limit(50);
    pool = rows.map(sosShape);
    summaries = new Map(rows.map((r) => [r.id, { id: r.id, need: r.need, location: r.location, area: r.area ?? null, status: r.status, priorityLevel: r.priorityLevel, verificationStatus: r.verificationStatus, createdAt: r.createdAt }]));
  }
  const sourceTokens = tokenize(source.text);
  const scored = pool.map((c) => {
    let score = 0;
    const reasons: string[] = [];
    if (source.latitude != null && source.longitude != null && c.latitude != null && c.longitude != null) {
      const km = distanceKm(source.latitude, source.longitude, c.latitude, c.longitude);
      if (km <= 1.5) { score += 4; reasons.push(`Very close by (${km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`})`); }
      else if (km <= 5) { score += 2; reasons.push(`Nearby (${km.toFixed(1)} km)`); }
    }
    if (source.area && c.area && source.area.trim().toLowerCase() === c.area.trim().toLowerCase()) { score += 2; reasons.push(`Same area (${c.area})`); }
    const sim = jaccard(sourceTokens, tokenize(c.text));
    if (sim >= 0.3) { const pts = Math.max(1, Math.round(3 * sim)); score += pts; reasons.push("Similar description"); }
    if (kind === "SOS" && source.phone && c.phone && source.phone === c.phone) { score += 4; reasons.push("Same contact phone"); }
    if (source.reporterKey === c.reporterKey) { score += 2; reasons.push("Same reporter"); }
    const mins = Math.abs(source.createdAt.getTime() - c.createdAt.getTime()) / 60000;
    if (mins <= 60) { score += 1; reasons.push("Reported within the same hour"); }
    return { ...(summaries.get(c.id) ?? { id: c.id }), matchScore: score, matchReasons: reasons };
  }).filter((c) => c.matchScore >= 3).sort((a, b) => b.matchScore - a.matchScore).slice(0, 5);
  return scored;
}

async function loadDoc(kind: EntityKind, id: string) {
  const doc = kind === "INCIDENT" ? await IncidentModel.findById(id) : await SosRequestModel.findById(id);
  if (!doc) throw ApiError.notFound(kind === "INCIDENT" ? "Incident not found" : "SOS request not found");
  return doc;
}

function reporterIdOf(kind: EntityKind, doc: Awaited<ReturnType<typeof loadDoc>>): string {
  return kind === "INCIDENT" ? (doc as InstanceType<typeof IncidentModel>).reporterId : (doc as InstanceType<typeof SosRequestModel>).citizenId;
}

export async function verifyEntity(actor: AuthUser, kind: EntityKind, id: string, ip?: string) {
  const doc = await loadDoc(kind, id);
  const updated = kind === "INCIDENT"
    ? await IncidentModel.findByIdAndUpdate(id, { $set: { verificationStatus: "VERIFIED", duplicateOfId: null } }, { new: true })
    : await SosRequestModel.findByIdAndUpdate(id, { $set: { verificationStatus: "VERIFIED", duplicateOfId: null } }, { new: true });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: kind === "INCIDENT" ? "incident.verify" : "sos.verify", targetType: kind === "INCIDENT" ? "Incident" : "SOSRequest", targetId: id, ipAddress: ip });
  emitToRole("RESPONDER", kind === "INCIDENT" ? "incident:updated" : "sos:updated", out(updated));
  emitToRole("ADMIN", kind === "INCIDENT" ? "incident:updated" : "sos:updated", out(updated));
  void doc;
  return out(updated);
}

export async function markDuplicate(actor: AuthUser, kind: EntityKind, id: string, duplicateOfId: string, ip?: string) {
  if (duplicateOfId === id) throw ApiError.badRequest("A report cannot be a duplicate of itself");
  const doc = await loadDoc(kind, id);
  await loadDoc(kind, duplicateOfId);
  const updated = kind === "INCIDENT"
    ? await IncidentModel.findByIdAndUpdate(id, { $set: { verificationStatus: "FLAGGED_DUPLICATE", duplicateOfId } }, { new: true })
    : await SosRequestModel.findByIdAndUpdate(id, { $set: { verificationStatus: "FLAGGED_DUPLICATE", duplicateOfId } }, { new: true });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: kind === "INCIDENT" ? "incident.mark_duplicate" : "sos.mark_duplicate", targetType: kind === "INCIDENT" ? "Incident" : "SOSRequest", targetId: id, details: { duplicateOfId }, ipAddress: ip });
  const reporterId = reporterIdOf(kind, doc);
  if (reporterId !== actor.id) {
    await notifyUser(reporterId, "Report merged with an earlier report", "Your report describes the same event as an earlier report, so responders merged them to avoid duplicate effort. You can keep tracking the original report.", kind === "INCIDENT" ? "INCIDENT_UPDATE" : "SOS_UPDATE", { type: kind === "INCIDENT" ? "Incident" : "SOSRequest", id: duplicateOfId });
  }
  emitToRole("RESPONDER", kind === "INCIDENT" ? "incident:updated" : "sos:updated", out(updated));
  return out(updated);
}

export async function unflagDuplicate(actor: AuthUser, kind: EntityKind, id: string, ip?: string) {
  await loadDoc(kind, id);
  const updated = kind === "INCIDENT"
    ? await IncidentModel.findByIdAndUpdate(id, { $set: { verificationStatus: "UNVERIFIED", duplicateOfId: null } }, { new: true })
    : await SosRequestModel.findByIdAndUpdate(id, { $set: { verificationStatus: "UNVERIFIED", duplicateOfId: null } }, { new: true });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: kind === "INCIDENT" ? "incident.unflag_duplicate" : "sos.unflag_duplicate", targetType: kind === "INCIDENT" ? "Incident" : "SOSRequest", targetId: id, ipAddress: ip });
  emitToRole("RESPONDER", kind === "INCIDENT" ? "incident:updated" : "sos:updated", out(updated));
  void emitToUser;
  return out(updated);
}
