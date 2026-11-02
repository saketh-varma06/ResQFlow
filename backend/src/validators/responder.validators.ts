import { z } from "zod";
import { ResponderReadiness } from "../types/enums";
import { lat, lng, paginationQuery } from "./common";
export const createResponderSchema = z.object({
  userId: z.string().min(1).optional(),
  email: z.string().email().optional(),
  name: z.string().trim().min(2).max(80).optional(),
  password: z.string().min(8).max(72).optional(),
  unitName: z.string().trim().min(2).max(100),
  unitType: z.string().trim().min(2).max(60),
  base: z.string().trim().min(2).max(120),
  baseLat: lat.optional(),
  baseLng: lng.optional(),
  members: z.coerce.number().int().min(1).max(500).optional().default(1),
  serviceArea: z.string().trim().max(80).optional(),
  readiness: z.nativeEnum(ResponderReadiness).optional(),
}).refine((d) => d.userId || d.email, { message: "Provide userId of an existing user, or email+name+password to create the responder's account" });
export const updateResponderSchema = z.object({
  unitName: z.string().trim().min(2).max(100).optional(),
  unitType: z.string().trim().min(2).max(60).optional(),
  base: z.string().trim().min(2).max(120).optional(),
  baseLat: lat.nullable().optional(),
  baseLng: lng.nullable().optional(),
  members: z.coerce.number().int().min(1).max(500).optional(),
  serviceArea: z.string().trim().max(80).nullable().optional(),
  readiness: z.nativeEnum(ResponderReadiness).optional(),
  rating: z.number().min(0).max(5).nullable().optional(),
});
export const listRespondersQuery = paginationQuery.extend({
  readiness: z.nativeEnum(ResponderReadiness).optional(),
  unitType: z.string().optional(),
});
export const availabilitySchema = z.object({ readiness: z.nativeEnum(ResponderReadiness) });
