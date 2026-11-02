import { z } from "zod";
import { SOSCategory, SOSStatus, VulnerableGroup } from "../types/enums";
import { lat, lng, paginationQuery } from "./common";
export const createSosSchema = z.object({
  need: z.string().trim().min(3).max(200),
  category: z.nativeEnum(SOSCategory),
  people: z.coerce.number().int().min(1).max(500).optional().default(1),
  location: z.string().trim().min(3).max(200),
  area: z.string().trim().max(80).optional(),
  latitude: lat.optional(),
  longitude: lng.optional(),
  details: z.string().trim().max(1000).optional(),
  phone: z.string().trim().max(20).optional(),
  injuriesReported: z.coerce.number().int().min(0).max(100_000).optional().default(0),
  trapped: z.coerce.boolean().optional().default(false),
  vulnerableGroups: z.array(z.nativeEnum(VulnerableGroup)).max(5).optional().default([]),
});
export const markDuplicateSchema = z.object({ duplicateOfId: z.string().min(1) });
export const listSosQuery = paginationQuery.extend({ status: z.nativeEnum(SOSStatus).optional(), mine: z.coerce.boolean().optional() });
export const updateSosStatusSchema = z.object({ status: z.nativeEnum(SOSStatus) });
export const assignSosSchema = z.object({ responderProfileId: z.string().min(1) });
