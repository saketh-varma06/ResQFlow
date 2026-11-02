import { UserModel, IncidentModel, SosRequestModel, ShelterModel, AlertModel, AssignmentModel, ResponderModel, StatusHistoryModel } from "../models";

function dayKey(d: Date) { return d.toISOString().slice(0, 10); }
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Average minutes from record creation to the FIRST history entry reaching `toStatus`. */
function avgMinutesToFirst(history: { recordId: string; toStatus: string; createdAt: Date }[], created: Map<string, Date>, toStatus: string): number | null {
  const first = new Map<string, Date>();
  for (const h of history) {
    if (h.toStatus !== toStatus) continue;
    const prev = first.get(h.recordId);
    if (!prev || h.createdAt < prev) first.set(h.recordId, h.createdAt);
  }
  const diffs: number[] = [];
  for (const [id, at] of first) {
    const start = created.get(id);
    if (start) diffs.push((at.getTime() - start.getTime()) / 60000);
  }
  if (diffs.length === 0) return null;
  return round1(diffs.reduce((a, b) => a + b, 0) / diffs.length);
}

export async function overview() {
  const now = Date.now();
  const since14 = new Date(now - 14 * 24 * 3600 * 1000);
  const [usersByRole, incidentsTotal, incidentsActive, byStatus, bySeverity, byType, sosByStatus, shelterRows, alertsActive, assignments,
    incidentRowsRaw, sosRowsRaw, incidentHistoryRaw, sosHistoryRaw, profileRows, assignmentRows, sosByUnit, incidentStatusRows] = await Promise.all([
    UserModel.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
    IncidentModel.countDocuments(),
    IncidentModel.countDocuments({ status: { $nin: ["RESOLVED", "CLOSED"] } }),
    IncidentModel.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    IncidentModel.aggregate([{ $group: { _id: "$severity", count: { $sum: 1 } } }]),
    IncidentModel.aggregate([{ $group: { _id: "$type", count: { $sum: 1 } } }]),
    SosRequestModel.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    ShelterModel.find().select("name area capacity occupied status").lean(),
    AlertModel.countDocuments({ status: "ACTIVE" }),
    AssignmentModel.countDocuments(),
    IncidentModel.find().select("createdAt").lean(),
    SosRequestModel.find().select("createdAt status").lean(),
    StatusHistoryModel.find({ entityType: "INCIDENT" }).select("entityId toStatus createdAt").lean(),
    StatusHistoryModel.find({ entityType: "SOS" }).select("entityId toStatus createdAt").lean(),
    ResponderModel.find().select("unitName unitType readiness members").lean(),
    AssignmentModel.find().select("responderProfileId status incidentId").lean(),
    SosRequestModel.find({ responderProfileId: { $ne: null } }).select("responderProfileId status").lean(),
    IncidentModel.find().select("status").lean(),
  ]);

  const shelters = shelterRows.map((s) => ({ id: s._id, name: s.name, area: s.area, capacity: s.capacity, occupied: s.occupied, status: s.status }));
  const incidentRows = incidentRowsRaw.map((r) => ({ id: r._id, createdAt: r.createdAt }));
  const sosRows = sosRowsRaw.map((r) => ({ id: r._id, createdAt: r.createdAt, status: r.status }));
  const incidentHistory = incidentHistoryRaw.map((h) => ({ incidentId: h.entityId, toStatus: h.toStatus, createdAt: h.createdAt }));
  const sosHistory = sosHistoryRaw.map((h) => ({ sosId: h.entityId, toStatus: h.toStatus, createdAt: h.createdAt }));
  const profiles = profileRows.map((p) => ({ id: p._id, unitName: p.unitName, unitType: p.unitType, readiness: p.readiness, members: p.members }));
  const incidentStatusById = new Map<string, string>(incidentStatusRows.map((r) => [r._id, r.status as string] as [string, string]));
  const assignmentsByUnit = assignmentRows.map((a) => ({ responderProfileId: a.responderProfileId, status: a.status, incidentId: a.incidentId, incident: { status: incidentStatusById.get(a.incidentId) as string } }));

  // Trends: last 14 days, real timestamps from records + status history
  const trends: { day: string; incidents: number; incidentsResolved: number; sos: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const key = dayKey(new Date(now - i * 24 * 3600 * 1000));
    trends.push({
      day: key,
      incidents: incidentRows.filter((r) => r.createdAt >= since14 && dayKey(r.createdAt) === key).length,
      incidentsResolved: incidentHistory.filter((h) => h.toStatus === "RESOLVED" && dayKey(h.createdAt) === key).length,
      sos: sosRows.filter((r) => r.createdAt >= since14 && dayKey(r.createdAt) === key).length,
    });
  }

  const incidentCreated = new Map(incidentRows.map((r) => [r.id, r.createdAt]));
  const sosCreated = new Map(sosRows.map((r) => [r.id, r.createdAt]));
  const incHist = incidentHistory.map((h) => ({ recordId: h.incidentId, toStatus: h.toStatus as string, createdAt: h.createdAt }));
  const sosHist = sosHistory.map((h) => ({ recordId: h.sosId, toStatus: h.toStatus as string, createdAt: h.createdAt }));

  const pendingSosRows = sosRows.filter((r) => r.status === "SUBMITTED" || r.status === "ACKNOWLEDGED");
  const oldestPending = pendingSosRows.length ? Math.min(...pendingSosRows.map((r) => r.createdAt.getTime())) : null;

  const totalCapacity = shelters.reduce((a, s) => a + s.capacity, 0);
  const totalOccupied = shelters.reduce((a, s) => a + s.occupied, 0);

  const responderWorkload = profiles.map((p) => {
    const mine = assignmentsByUnit.filter((a) => a.responderProfileId === p.id);
    const mySos = sosByUnit.filter((s) => s.responderProfileId === p.id);
    return {
      profileId: p.id, unitName: p.unitName, unitType: p.unitType, readiness: p.readiness, members: p.members,
      activeAssignments: mine.filter((a) => (a.status === "PENDING" || a.status === "ACCEPTED") && !["RESOLVED", "CLOSED"].includes(a.incident.status)).length,
      completedAssignments: mine.filter((a) => a.status === "COMPLETED").length,
      activeSos: mySos.filter((s) => !["RESOLVED", "CLOSED", "CANCELLED"].includes(s.status)).length,
      resolvedSos: mySos.filter((s) => s.status === "RESOLVED" || s.status === "CLOSED").length,
    };
  }).sort((a, b) => b.activeAssignments + b.activeSos - (a.activeAssignments + a.activeSos));

  const incResolutionMin = avgMinutesToFirst(incHist, incidentCreated, "RESOLVED");
  const toMap = (rows: { _id: unknown; count: number }[]) => Object.fromEntries(rows.map((r) => [String(r._id), r.count]));
  return {
    users: { total: usersByRole.reduce((a, r) => a + r.count, 0), byRole: toMap(usersByRole) },
    incidents: {
      total: incidentsTotal, active: incidentsActive,
      byStatus: toMap(byStatus), bySeverity: toMap(bySeverity), byType: toMap(byType),
      reportedLast7Days: trends.slice(7).map((t) => ({ day: t.day, reported: t.incidents })),
      trends14Days: trends,
    },
    sos: {
      total: sosByStatus.reduce((a, r) => a + r.count, 0), byStatus: toMap(sosByStatus),
      pending: pendingSosRows.length,
      oldestPendingMinutes: oldestPending ? Math.round((now - oldestPending) / 60000) : null,
    },
    shelters: {
      count: shelters.length, totalCapacity, totalOccupied,
      occupancyPercent: totalCapacity ? round1((totalOccupied / totalCapacity) * 100) : 0,
      utilizationPercent: totalCapacity ? round1((totalOccupied / totalCapacity) * 100) : 0,
      perShelter: shelters.map((s) => ({ id: s.id, name: s.name, area: s.area, capacity: s.capacity, occupied: s.occupied, available: s.capacity - s.occupied, utilizationPercent: s.capacity ? round1((s.occupied / s.capacity) * 100) : 0, status: s.status })),
    },
    alerts: { active: alertsActive },
    assignments: { total: assignments },
    responderWorkload,
    response: {
      avgAcknowledgementMinutes: { incidents: avgMinutesToFirst(incHist, incidentCreated, "ACKNOWLEDGED"), sos: avgMinutesToFirst(sosHist, sosCreated, "ACKNOWLEDGED") },
      avgResolutionMinutes: { incidents: incResolutionMin, sos: avgMinutesToFirst(sosHist, sosCreated, "RESOLVED") },
      resolvedCount: incidentHistory.filter((h) => h.toStatus === "RESOLVED").length,
      avgResolutionHours: incResolutionMin !== null ? round1(incResolutionMin / 60) : null,
    },
    generatedAt: new Date().toISOString(),
  };
}
