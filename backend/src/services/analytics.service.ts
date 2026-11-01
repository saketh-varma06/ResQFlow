import { prisma } from "../database/prisma";

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
  const [usersByRole, incidentsTotal, incidentsActive, byStatus, bySeverity, byType, sosByStatus, shelters, alertsActive, assignments,
    incidentRows, sosRows, incidentHistory, sosHistory, profiles, assignmentsByUnit, sosByUnit] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], _count: true }),
    prisma.incident.count(),
    prisma.incident.count({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    prisma.incident.groupBy({ by: ["status"], _count: true }),
    prisma.incident.groupBy({ by: ["severity"], _count: true }),
    prisma.incident.groupBy({ by: ["type"], _count: true }),
    prisma.sOSRequest.groupBy({ by: ["status"], _count: true }),
    prisma.shelter.findMany({ select: { id: true, name: true, area: true, capacity: true, occupied: true, status: true } }),
    prisma.disasterAlert.count({ where: { status: "ACTIVE" } }),
    prisma.incidentAssignment.count(),
    prisma.incident.findMany({ select: { id: true, createdAt: true } }),
    prisma.sOSRequest.findMany({ select: { id: true, createdAt: true, status: true } }),
    prisma.incidentStatusHistory.findMany({ select: { incidentId: true, toStatus: true, createdAt: true } }),
    prisma.sOSStatusHistory.findMany({ select: { sosId: true, toStatus: true, createdAt: true } }),
    prisma.responderProfile.findMany({ select: { id: true, unitName: true, unitType: true, readiness: true, members: true } }),
    prisma.incidentAssignment.findMany({ select: { responderProfileId: true, status: true, incident: { select: { status: true } } } }),
    prisma.sOSRequest.findMany({ where: { responderProfileId: { not: null } }, select: { responderProfileId: true, status: true } }),
  ]);

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
  const toMap = (rows: { _count: number }[], key: string) => Object.fromEntries(rows.map((r) => [(r as unknown as Record<string, unknown>)[key], r._count]));
  return {
    users: { total: usersByRole.reduce((a, r) => a + r._count, 0), byRole: toMap(usersByRole, "role") },
    incidents: {
      total: incidentsTotal, active: incidentsActive,
      byStatus: toMap(byStatus, "status"), bySeverity: toMap(bySeverity, "severity"), byType: toMap(byType, "type"),
      reportedLast7Days: trends.slice(7).map((t) => ({ day: t.day, reported: t.incidents })),
      trends14Days: trends,
    },
    sos: {
      total: sosByStatus.reduce((a, r) => a + r._count, 0), byStatus: toMap(sosByStatus, "status"),
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
