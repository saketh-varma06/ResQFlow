import { AlertModel, AlertSubscriptionModel, UserModel, type Alert } from "../models";
import { ApiError } from "../utils/ApiError";
import { parsePagination, pageMeta } from "../utils/pagination";
import { writeAudit } from "../utils/audit";
import { notifyUsers } from "../utils/notify";
import { emitToAll } from "../utils/realtime";
import { ci } from "../utils/query";
import { out } from "./serialize";
import type { AuthUser } from "../types/auth";
import type { z } from "zod";
import type { createAlertSchema, createAlertSubscriptionSchema, listAlertsQuery, updateAlertSchema } from "../validators/alert.validators";

type AlertDoc = InstanceType<typeof AlertModel>;

const SEVERITY_RANK: Record<string, number> = { LOW: 0, MODERATE: 1, HIGH: 2, CRITICAL: 3 };

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Who receives a published alert (Stage B matching):
 *  1. the pre-Stage-B rule — citizens whose profile district equals the alert area
 *     (or every citizen for "All districts"), and
 *  2. citizens with a matching subscription: DISTRICT (same area / all-districts alert)
 *     or RADIUS (alert centre within subscription radius + the alert's own radius),
 *     honouring each subscription's minimum severity.
 * The union is deduplicated — nobody loses alerts they used to get.
 */
export async function matchedCitizenIds(alert: AlertDoc): Promise<string[]> {
  const ids = new Set<string>();
  const base = await UserModel.find({ role: "CITIZEN", status: "ACTIVE", ...(alert.area === "All districts" ? {} : { area: alert.area }) }).select("_id").limit(5000);
  for (const u of base) ids.add(u.id);
  const subs = await AlertSubscriptionModel.find({}).limit(10000);
  if (subs.length > 0) {
    const subUserIds = [...new Set(subs.map((s) => s.userId))];
    const activeUsers = new Set((await UserModel.find({ _id: { $in: subUserIds }, role: "CITIZEN", status: "ACTIVE" }).select("_id")).map((u) => u.id));
    for (const s of subs) {
      if (!activeUsers.has(s.userId)) continue;
      if (s.minSeverity && SEVERITY_RANK[alert.severity] < SEVERITY_RANK[s.minSeverity]) continue;
      if (s.mode === "DISTRICT") {
        if (alert.area === "All districts" || (s.area && s.area === alert.area)) ids.add(s.userId);
      } else if (s.mode === "RADIUS") {
        if (alert.centerLat != null && alert.centerLng != null && s.centerLat != null && s.centerLng != null && s.radiusKm != null) {
          const km = distanceKm(s.centerLat, s.centerLng, alert.centerLat, alert.centerLng);
          if (km <= s.radiusKm + (alert.radiusKm ?? 0)) ids.add(s.userId);
        }
      }
    }
  }
  return [...ids];
}

async function publishAlert(alert: AlertDoc): Promise<void> {
  const citizens = await matchedCitizenIds(alert);
  await notifyUsers(citizens, alert.title, alert.instructions, "ALERT", { type: "DisasterAlert", id: alert.id });
  await AlertModel.findByIdAndUpdate(alert.id, { $set: { reach: citizens.length } });
  alert.reach = citizens.length;
  emitToAll("alert:created", out(alert));
}

export async function listAlerts(actor: AuthUser | undefined, q: z.infer<typeof listAlertsQuery>) {
  const p = parsePagination(q as Record<string, unknown>);
  const isAdmin = actor?.role === "ADMIN";
  const where = {
    ...(!isAdmin ? { status: "ACTIVE" as const } : q.status ? { status: q.status } : {}),
    ...(q.activeOnly ? { status: "ACTIVE" as const } : {}),
    ...(q.severity ? { severity: q.severity } : {}), ...(q.area ? { area: q.area } : {}),
    ...(q.search ? ci("title", q.search) : {}),
  };
  const [total, rows] = await Promise.all([
    AlertModel.countDocuments(where),
    AlertModel.find(where).sort({ issuedAt: -1 }).skip(p.skip).limit(p.limit),
  ]);
  return { data: out(rows), meta: pageMeta(total, p) };
}

export async function getAlert(id: string) {
  const alert = await AlertModel.findById(id);
  if (!alert) throw ApiError.notFound("Alert not found");
  return out(alert);
}

export async function createAlert(actor: AuthUser, input: z.infer<typeof createAlertSchema>, ip?: string) {
  const alert = await AlertModel.create({ ...input, issuedById: actor.id });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "alert.create", targetType: "DisasterAlert", targetId: alert.id, details: { title: alert.title, status: alert.status }, ipAddress: ip });
  if (alert.status === "ACTIVE") await publishAlert(alert);
  return out(alert);
}

export async function updateAlert(actor: AuthUser, id: string, input: z.infer<typeof updateAlertSchema>, ip?: string) {
  const existing = await AlertModel.findById(id);
  if (!existing) throw ApiError.notFound("Alert not found");
  const alert = await AlertModel.findByIdAndUpdate(id, { $set: { ...input } }, { new: true });
  if (!alert) throw ApiError.notFound("Alert not found");
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "alert.update", targetType: "DisasterAlert", targetId: id, details: input, ipAddress: ip });
  if (existing.status !== "ACTIVE" && alert.status === "ACTIVE") await publishAlert(alert);
  else emitToAll("alert:updated", out(alert));
  return out(alert);
}

/* ---------------- Alert subscriptions (Stage B) ---------------- */

export async function listMySubscriptions(actor: AuthUser) {
  const rows = await AlertSubscriptionModel.find({ userId: actor.id }).sort({ createdAt: -1 });
  return out(rows);
}

export async function createSubscription(actor: AuthUser, input: z.infer<typeof createAlertSubscriptionSchema>, ip?: string) {
  const count = await AlertSubscriptionModel.countDocuments({ userId: actor.id });
  if (count >= 10) throw ApiError.badRequest("You already have 10 alert subscriptions — remove one before adding another");
  const sub = await AlertSubscriptionModel.create({ ...input, userId: actor.id });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "alert_subscription.create", targetType: "AlertSubscription", targetId: sub.id, details: { mode: input.mode, area: input.area }, ipAddress: ip });
  return out(sub);
}

export async function deleteSubscription(actor: AuthUser, id: string, ip?: string) {
  const sub = await AlertSubscriptionModel.findById(id);
  if (!sub) throw ApiError.notFound("Subscription not found");
  if (sub.userId !== actor.id && actor.role !== "ADMIN") throw ApiError.forbidden("You can only remove your own subscriptions");
  await AlertSubscriptionModel.findByIdAndDelete(id);
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "alert_subscription.delete", targetType: "AlertSubscription", targetId: id, ipAddress: ip });
  return { deleted: true };
}

/* ---------------- CAP 1.2 export (Stage B) ---------------- */

const CAP_SEVERITY: Record<string, string> = { CRITICAL: "Extreme", HIGH: "Severe", MODERATE: "Moderate", LOW: "Minor" };

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function iso(d: Date | string): string { return new Date(d).toISOString().replace(/\.\d{3}Z$/, "+00:00"); }

/** One alert as a CAP 1.2 document. Status maps ACTIVE→Actual/Test never occurs here; drafts export as Draft per CAP. */
export function alertToCapXml(a: AlertDoc): string {
  const capStatus = a.status === "ACTIVE" ? "Actual" : a.status === "DRAFT" ? "Draft" : "Actual";
  const circle = a.centerLat != null && a.centerLng != null ? `\n      <circle>${a.centerLat},${a.centerLng} ${a.radiusKm ?? 10}</circle>` : "";
  const expires = a.expiresAt ? `\n    <expires>${iso(a.expiresAt)}</expires>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>resqflow-${xmlEscape(a.id)}</identifier>
  <sender>alerts@resqflow.local</sender>
  <sent>${iso(a.issuedAt)}</sent>
  <status>${capStatus}</status>
  <msgType>Alert</msgType>
  <scope>Public</scope>
  <info>
    <language>en-IN</language>
    <category>${xmlEscape(a.capCategory ?? "Other")}</category>
    <event>${xmlEscape(a.type)}</event>
    <urgency>${xmlEscape(a.capUrgency ?? "Expected")}</urgency>
    <severity>${CAP_SEVERITY[a.severity] ?? "Unknown"}</severity>
    <certainty>${xmlEscape(a.capCertainty ?? "Possible")}</certainty>
    <senderName>${xmlEscape(a.source ?? "District Disaster Office")}</senderName>
    <headline>${xmlEscape(a.headline ?? a.title)}</headline>
    <description>${xmlEscape(a.instructions)}</description>${expires}
    <area>
      <areaDesc>${xmlEscape(a.area)}</areaDesc>${circle}
    </area>
  </info>
</alert>`;
}

/** Atom feed of all ACTIVE alerts, each entry embedding its CAP document (the shape real CAP aggregators publish). */
export async function capFeedXml(): Promise<string> {
  const alerts = await AlertModel.find({ status: "ACTIVE" }).sort({ issuedAt: -1 }).limit(50);
  const updated = alerts.length > 0 ? iso(alerts[0].issuedAt) : iso(new Date());
  const entries = alerts.map((a) => `  <entry>
    <id>resqflow-${xmlEscape(a.id)}</id>
    <title>${xmlEscape(a.headline ?? a.title)}</title>
    <updated>${iso(a.issuedAt)}</updated>
    <content type="application/cap+xml">${xmlEscape(alertToCapXml(a))}</content>
  </entry>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>resqflow-cap-feed</id>
  <title>ResQFlow CAP Alert Feed (academic demonstration — not an official warning source)</title>
  <updated>${updated}</updated>
${entries}
</feed>`;
}

export async function deleteAlert(actor: AuthUser, id: string, ip?: string) {
  const existing = await AlertModel.findById(id);
  if (!existing) throw ApiError.notFound("Alert not found");
  await AlertModel.findByIdAndDelete(id);
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "alert.delete", targetType: "DisasterAlert", targetId: id, details: { title: existing.title }, ipAddress: ip });
  return { deleted: true };
}
