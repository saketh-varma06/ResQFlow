import { z } from "zod";
import { AlertStatus, Severity } from "../types/enums";
import { lat, lng, paginationQuery } from "./common";
const CAP_CATEGORIES = ["Geo", "Met", "Safety", "Security", "Rescue", "Fire", "Health", "Env", "Transport", "Infra", "CBRNE", "Other"] as const;
const CAP_URGENCIES = ["Immediate", "Expected", "Future", "Past", "Unknown"] as const;
const CAP_CERTAINTIES = ["Observed", "Likely", "Possible", "Unlikely", "Unknown"] as const;
const capFields = {
  headline: z.string().trim().max(160).optional(),
  capCategory: z.enum(CAP_CATEGORIES).optional(),
  capUrgency: z.enum(CAP_URGENCIES).optional(),
  capCertainty: z.enum(CAP_CERTAINTIES).optional(),
  centerLat: lat.optional(),
  centerLng: lng.optional(),
  radiusKm: z.coerce.number().min(0.5).max(500).optional(),
};
export const createAlertSchema = z.object({
  title: z.string().trim().min(8).max(200),
  type: z.string().trim().min(2).max(60),
  severity: z.nativeEnum(Severity),
  area: z.string().trim().min(2).max(80),
  instructions: z.string().trim().min(15).max(2000),
  source: z.string().trim().max(120).optional(),
  status: z.enum(["DRAFT", "ACTIVE"]).optional().default("ACTIVE"),
  expiresAt: z.coerce.date().optional(),
  ...capFields,
});
export const createAlertSubscriptionSchema = z.object({
  mode: z.enum(["DISTRICT", "RADIUS"]),
  area: z.string().trim().min(2).max(80).optional(),
  centerLat: lat.optional(),
  centerLng: lng.optional(),
  radiusKm: z.coerce.number().min(1).max(200).optional(),
  minSeverity: z.nativeEnum(Severity).optional(),
}).refine((v) => (v.mode === "DISTRICT" ? !!v.area : v.centerLat !== undefined && v.centerLng !== undefined && v.radiusKm !== undefined), {
  message: "DISTRICT subscriptions need an area; RADIUS subscriptions need centre coordinates and a radius",
});
export const subscribePushSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(300), auth: z.string().min(5).max(100) }),
  userAgent: z.string().max(300).optional(),
});
export const unsubscribePushSchema = z.object({ endpoint: z.string().url().max(1000) });
export const updateAlertSchema = z.object({
  title: z.string().trim().min(8).max(200).optional(),
  type: z.string().trim().min(2).max(60).optional(),
  severity: z.nativeEnum(Severity).optional(),
  area: z.string().trim().min(2).max(80).optional(),
  instructions: z.string().trim().min(15).max(2000).optional(),
  source: z.string().trim().max(120).optional(),
  status: z.nativeEnum(AlertStatus).optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  ...capFields,
});
export const listAlertsQuery = paginationQuery.extend({
  status: z.nativeEnum(AlertStatus).optional(),
  severity: z.nativeEnum(Severity).optional(),
  area: z.string().optional(),
  activeOnly: z.coerce.boolean().optional(),
});
