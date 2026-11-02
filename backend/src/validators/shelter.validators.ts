import { z } from "zod";
import { ShelterStatus } from "../types/enums";
import { lat, lng, paginationQuery } from "./common";
const capacityRule = (d: { capacity?: number; occupied?: number }) => d.capacity === undefined || d.occupied === undefined || d.occupied <= d.capacity;
export const createShelterSchema = z.object({
  name: z.string().trim().min(3).max(120),
  address: z.string().trim().min(3).max(200),
  area: z.string().trim().min(2).max(80),
  capacity: z.coerce.number().int().min(1).max(1_000_000),
  occupied: z.coerce.number().int().min(0).optional().default(0),
  facilities: z.array(z.string().trim().min(1).max(40)).max(20).optional().default([]),
  accessibility: z.string().trim().max(500).optional(),
  contact: z.string().trim().max(40).optional(),
  latitude: lat.optional(),
  longitude: lng.optional(),
  status: z.nativeEnum(ShelterStatus).optional(),
}).refine(capacityRule, { message: "occupied cannot exceed capacity" });
export const updateShelterSchema = z.object({
  name: z.string().trim().min(3).max(120).optional(),
  address: z.string().trim().min(3).max(200).optional(),
  area: z.string().trim().min(2).max(80).optional(),
  capacity: z.coerce.number().int().min(1).max(1_000_000).optional(),
  occupied: z.coerce.number().int().min(0).optional(),
  facilities: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  accessibility: z.string().trim().max(500).nullable().optional(),
  contact: z.string().trim().max(40).nullable().optional(),
  latitude: lat.nullable().optional(),
  longitude: lng.nullable().optional(),
  status: z.nativeEnum(ShelterStatus).optional(),
}).refine(capacityRule, { message: "occupied cannot exceed capacity" });
export const listSheltersQuery = paginationQuery.extend({
  area: z.string().optional(),
  status: z.nativeEnum(ShelterStatus).optional(),
  withSpace: z.coerce.boolean().optional(),
});
