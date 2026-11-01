import { z } from "zod";
import { AlertStatus, Severity } from "@prisma/client";
import { paginationQuery } from "./common";
export const createAlertSchema = z.object({
  title: z.string().trim().min(8).max(200),
  type: z.string().trim().min(2).max(60),
  severity: z.nativeEnum(Severity),
  area: z.string().trim().min(2).max(80),
  instructions: z.string().trim().min(15).max(2000),
  source: z.string().trim().max(120).optional(),
  status: z.enum(["DRAFT", "ACTIVE"]).optional().default("ACTIVE"),
  expiresAt: z.coerce.date().optional(),
});
export const updateAlertSchema = z.object({
  title: z.string().trim().min(8).max(200).optional(),
  type: z.string().trim().min(2).max(60).optional(),
  severity: z.nativeEnum(Severity).optional(),
  area: z.string().trim().min(2).max(80).optional(),
  instructions: z.string().trim().min(15).max(2000).optional(),
  source: z.string().trim().max(120).optional(),
  status: z.nativeEnum(AlertStatus).optional(),
  expiresAt: z.coerce.date().nullable().optional(),
});
export const listAlertsQuery = paginationQuery.extend({
  status: z.nativeEnum(AlertStatus).optional(),
  severity: z.nativeEnum(Severity).optional(),
  area: z.string().optional(),
  activeOnly: z.coerce.boolean().optional(),
});
