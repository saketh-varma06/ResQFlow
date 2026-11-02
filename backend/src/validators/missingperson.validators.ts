import { z } from "zod";
import { lat, lng, paginationQuery } from "./common";
export const createMissingPersonSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  ageApprox: z.coerce.number().int().min(0).max(120).optional(),
  gender: z.string().trim().max(30).optional(),
  description: z.string().trim().max(1000).optional(),
  lastSeenLocation: z.string().trim().min(3).max(200),
  area: z.string().trim().min(2).max(80).optional(),
  latitude: lat.optional(),
  longitude: lng.optional(),
  lastSeenAt: z.coerce.date().optional(),
  circumstances: z.string().trim().max(1000).optional(),
  reporterRelationship: z.string().trim().min(2).max(80),
  reporterPhone: z.string().trim().min(7).max(20),
});
export const updateMissingPersonStatusSchema = z.object({
  status: z.enum(["SEARCHING", "FOUND_ALIVE", "FOUND_DECEASED", "CLOSED"]),
  resolutionNote: z.string().trim().max(1000).optional(),
});
export const listMissingPersonsQuery = paginationQuery.extend({
  status: z.enum(["REPORTED", "SEARCHING", "FOUND_ALIVE", "FOUND_DECEASED", "CLOSED"]).optional(),
  area: z.string().optional(),
  q: z.string().trim().max(80).optional(),
  mine: z.coerce.boolean().optional(),
});
