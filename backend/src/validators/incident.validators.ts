import { z } from "zod";
import { IncidentStatus, IncidentType, Severity, VulnerableGroup } from "../types/enums";
import { lat, lng, paginationQuery } from "./common";
export const createIncidentSchema = z.object({
  title: z.string().trim().min(5).max(160),
  type: z.nativeEnum(IncidentType),
  severity: z.nativeEnum(Severity),
  description: z.string().trim().min(10).max(2000),
  location: z.string().trim().min(3).max(200),
  area: z.string().trim().min(2).max(80),
  latitude: lat.optional(),
  longitude: lng.optional(),
  peopleAffected: z.coerce.number().int().min(0).max(10_000_000).optional().default(0),
  injuriesReported: z.coerce.number().int().min(0).max(100_000).optional().default(0),
  clientRequestId: z.string().trim().max(64).optional(),
  trapped: z.coerce.boolean().optional().default(false),
  vulnerableGroups: z.array(z.nativeEnum(VulnerableGroup)).max(5).optional().default([]),
});
export const markDuplicateSchema = z.object({ duplicateOfId: z.string().min(1) });
export const updateIncidentSchema = createIncidentSchema.partial();
export const listIncidentsQuery = paginationQuery.extend({
  status: z.nativeEnum(IncidentStatus).optional(),
  severity: z.nativeEnum(Severity).optional(),
  type: z.nativeEnum(IncidentType).optional(),
  area: z.string().optional(),
  mine: z.coerce.boolean().optional(),
});
export const updateIncidentStatusSchema = z.object({
  status: z.nativeEnum(IncidentStatus),
  note: z.string().trim().max(500).optional(),
});
export const assignIncidentSchema = z.object({
  responderProfileId: z.string().min(1),
  notes: z.string().trim().max(500).optional(),
});
export const addNoteSchema = z.object({ note: z.string().trim().min(1).max(1000) });
export const checklistPatchSchema = z.object({ checkedKeys: z.array(z.string().max(60)).max(30) });
export const fieldReportSchema = z.object({
  situation: z.string().trim().min(5).max(2000),
  peopleCount: z.coerce.number().int().min(0).max(1_000_000).optional(),
  injuriesCount: z.coerce.number().int().min(0).max(100_000).optional(),
  needsSummary: z.string().trim().max(1000).optional(),
  risks: z.string().trim().max(1000).optional(),
});
