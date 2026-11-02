import { AlertModel, AuditLogModel, DonationModel, IncidentModel, ShelterModel, SosRequestModel, StatusHistoryModel } from "../models";

/**
 * One-click Situation Report (Stage F) — a CARE/OCHA-style SitRep generated from
 * live database state only. Nothing here is estimated or written by an AI model:
 * every number is a count or an average over real records, and the plain-text
 * rendering is a mechanical formatting of the same structure.
 */
const OPEN = ["SUBMITTED", "ACKNOWLEDGED", "ASSIGNED", "IN_PROGRESS"];
const round1 = (n: number) => Math.round(n * 10) / 10;

export interface Sitrep {
  generatedAt: string;
  windowHours: 24;
  overview: { openIncidents: number; openSos: number; pendingSos: number; oldestPendingSosMinutes: number | null; activeAlerts: number };
  last24h: { newIncidents: number; newSos: number; resolvedIncidents: number; resolvedSos: number };
  openBySeverity: { severity: string; count: number }[];
  openByType: { type: string; count: number }[];
  busiestAreas: { area: string; openReports: number }[];
  shelters: { count: number; capacity: number; occupied: number; utilizationPercent: number; fullShelters: string[] };
  activeAlertTitles: string[];
  donations: { receivedTotal: number; receivedCount: number; pledgedTotal: number; pledgedCount: number };
  topPriorities: { kind: string; title: string; area: string; priorityScore: number; priorityLevel: string; status: string }[];
}

export async function buildSitrep(): Promise<Sitrep> {
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 3600_000);
  const [openIncidents, openSosDocs, pendingSos, activeAlerts, shelters] = await Promise.all([
    IncidentModel.find({ status: { $in: OPEN } }),
    SosRequestModel.find({ status: { $in: OPEN } }),
    SosRequestModel.find({ status: "SUBMITTED" }).sort({ createdAt: 1 }),
    AlertModel.find({ status: "ACTIVE" }).sort({ publishedAt: -1 }),
    ShelterModel.find({}),
  ]);
  const [newIncidents, newSos, resolvedIncidents, resolvedSos] = await Promise.all([
    IncidentModel.countDocuments({ createdAt: { $gte: since } }),
    SosRequestModel.countDocuments({ createdAt: { $gte: since } }),
    StatusHistoryModel.countDocuments({ entityType: "INCIDENT", toStatus: "RESOLVED", createdAt: { $gte: since } }),
    StatusHistoryModel.countDocuments({ entityType: "SOS", toStatus: "RESOLVED", createdAt: { $gte: since } }),
  ]);
  const sevCount = new Map<string, number>();
  const typeCount = new Map<string, number>();
  const areaCount = new Map<string, number>();
  for (const i of openIncidents) {
    sevCount.set(i.severity, (sevCount.get(i.severity) ?? 0) + 1);
    typeCount.set(i.type, (typeCount.get(i.type) ?? 0) + 1);
    areaCount.set(i.area, (areaCount.get(i.area) ?? 0) + 1);
  }
  for (const s of openSosDocs) areaCount.set(s.area ?? "Unknown", (areaCount.get(s.area ?? "Unknown") ?? 0) + 1);
  const [donReceived, donPledged] = await Promise.all([
    DonationModel.aggregate([{ $match: { status: "RECEIVED" } }, { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }]),
    DonationModel.aggregate([{ $match: { status: "PLEDGED" } }, { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }]),
  ]);
  const capacity = shelters.reduce((a, s) => a + s.capacity, 0);
  const occupied = shelters.reduce((a, s) => a + s.occupied, 0);
  const topPriorities = [...openIncidents.map((i) => ({ kind: "Incident", title: i.title, area: i.area, priorityScore: i.priorityScore, priorityLevel: i.priorityLevel as string, status: i.status as string })),
    ...openSosDocs.map((s) => ({ kind: "SOS", title: s.need, area: s.area ?? "Unknown", priorityScore: s.priorityScore, priorityLevel: s.priorityLevel as string, status: s.status as string }))]
    .sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 5);
  return {
    generatedAt: now.toISOString(),
    windowHours: 24,
    overview: {
      openIncidents: openIncidents.length,
      openSos: openSosDocs.length,
      pendingSos: pendingSos.length,
      oldestPendingSosMinutes: pendingSos.length ? Math.round((now.getTime() - pendingSos[0].createdAt.getTime()) / 60000) : null,
      activeAlerts: activeAlerts.length,
    },
    last24h: { newIncidents, newSos, resolvedIncidents, resolvedSos },
    openBySeverity: ["CRITICAL", "HIGH", "MODERATE", "LOW"].map((severity) => ({ severity, count: sevCount.get(severity) ?? 0 })).filter((x) => x.count > 0),
    openByType: [...typeCount.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    busiestAreas: [...areaCount.entries()].map(([area, openReports]) => ({ area, openReports })).sort((a, b) => b.openReports - a.openReports).slice(0, 5),
    shelters: { count: shelters.length, capacity, occupied, utilizationPercent: capacity ? round1((occupied / capacity) * 100) : 0, fullShelters: shelters.filter((s) => s.occupied >= s.capacity).map((s) => s.name) },
    activeAlertTitles: activeAlerts.slice(0, 5).map((a) => a.title),
    donations: { receivedTotal: (donReceived[0] as { total?: number } | undefined)?.total ?? 0, receivedCount: (donReceived[0] as { count?: number } | undefined)?.count ?? 0, pledgedTotal: (donPledged[0] as { total?: number } | undefined)?.total ?? 0, pledgedCount: (donPledged[0] as { count?: number } | undefined)?.count ?? 0 },
    topPriorities,
  };
}

export function renderSitrepText(r: Sitrep): string {
  const lines = [
    `RESQFLOW SITUATION REPORT — ${new Date(r.generatedAt).toUTCString()}`,
    `(Academic demonstration platform — figures are live counts from the ResQFlow database, not an official government report.)`,
    ``,
    `OVERVIEW`,
    `Open incidents: ${r.overview.openIncidents} · Open SOS: ${r.overview.openSos} · SOS awaiting acknowledgement: ${r.overview.pendingSos}${r.overview.oldestPendingSosMinutes != null ? ` (oldest ${r.overview.oldestPendingSosMinutes} min)` : ""}`,
    `Active public alerts: ${r.overview.activeAlerts}`,
    ``,
    `LAST 24 HOURS`,
    `New: ${r.last24h.newIncidents} incidents, ${r.last24h.newSos} SOS · Resolved: ${r.last24h.resolvedIncidents} incidents, ${r.last24h.resolvedSos} SOS`,
    ``,
    `OPEN CASELOAD`,
    `By severity: ${r.openBySeverity.map((s) => `${s.severity} ${s.count}`).join(", ") || "none"}`,
    `By type: ${r.openByType.map((t) => `${t.type} ${t.count}`).join(", ") || "none"}`,
    `Busiest areas: ${r.busiestAreas.map((a) => `${a.area} (${a.openReports})`).join(", ") || "none"}`,
    ``,
    `HIGHEST PRIORITY OPEN REPORTS`,
    ...(r.topPriorities.length ? r.topPriorities.map((p, i) => `${i + 1}. [${p.kind}] ${p.title} — ${p.area} · priority ${p.priorityScore} (${p.priorityLevel}) · ${p.status}`) : ["None."]),
    ``,
    `SHELTERS`,
    `${r.shelters.count} shelters · ${r.shelters.occupied}/${r.shelters.capacity} places occupied (${r.shelters.utilizationPercent}%)`,
    ...(r.shelters.fullShelters.length ? [`Full: ${r.shelters.fullShelters.join(", ")}`] : []),
    ``,
    `DONATIONS`,
    `Verified received: ₹${r.donations.receivedTotal.toLocaleString("en-IN")} (${r.donations.receivedCount} donations) · Pledged awaiting verification: ₹${r.donations.pledgedTotal.toLocaleString("en-IN")} (${r.donations.pledgedCount})`,
    ``,
    `ACTIVE ALERTS`,
    ...(r.activeAlertTitles.length ? r.activeAlertTitles.map((t) => `- ${t}`) : ["None."]),
  ];
  return lines.join("\n");
}

export interface ReplayEvent {
  at: string;
  kind: "STATUS" | "AUDIT";
  entityType: string;
  entityId: string;
  title: string;
  detail: string;
  actorEmail?: string;
  latitude?: number | null;
  longitude?: number | null;
}

/** After-action replay feed (Stage F): status transitions + audit entries in one
 *  chronological stream so an incident can be re-played step by step. */
export async function buildReplay(hours: number): Promise<{ events: ReplayEvent[]; from: string; to: string; truncated: boolean }> {
  const to = new Date();
  const from = new Date(to.getTime() - hours * 3600_000);
  const [history, audits, incidents, soss] = await Promise.all([
    StatusHistoryModel.find({ createdAt: { $gte: from } }).sort({ createdAt: 1 }).limit(1000),
    AuditLogModel.find({ createdAt: { $gte: from } }).sort({ createdAt: 1 }).limit(1000),
    IncidentModel.find({}).select("title latitude longitude"),
    SosRequestModel.find({}).select("need latitude longitude"),
  ]);
  const incMap = new Map(incidents.map((i) => [i.id, i]));
  const sosMap = new Map(soss.map((s) => [s.id, s]));
  const events: ReplayEvent[] = [];
  for (const h of history) {
    const ent = h.entityType === "INCIDENT" ? incMap.get(h.entityId) : sosMap.get(h.entityId);
    const title = h.entityType === "INCIDENT" ? (ent as { title?: string } | undefined)?.title : (ent as { need?: string } | undefined)?.need;
    events.push({
      at: h.createdAt.toISOString(), kind: "STATUS", entityType: h.entityType, entityId: h.entityId,
      title: title ?? `${h.entityType} ${h.entityId.slice(-6)}`,
      detail: `${h.fromStatus ?? "—"} → ${h.toStatus}${h.note ? ` · ${h.note}` : ""}`,
      latitude: (ent as { latitude?: number | null } | undefined)?.latitude ?? null,
      longitude: (ent as { longitude?: number | null } | undefined)?.longitude ?? null,
    });
  }
  for (const a of audits) {
    events.push({ at: a.createdAt.toISOString(), kind: "AUDIT", entityType: a.targetType, entityId: a.targetId ?? "", title: a.action, detail: a.action, actorEmail: a.actorEmail });
  }
  events.sort((x, y) => x.at.localeCompare(y.at));
  return { events: events.slice(0, 500), from: from.toISOString(), to: to.toISOString(), truncated: events.length > 500 };
}
