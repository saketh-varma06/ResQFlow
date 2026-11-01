import { z } from "zod";
import { UserRole, UserStatus } from "@prisma/client";
import { paginationQuery } from "./common";
export const listUsersQuery = paginationQuery.extend({
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  area: z.string().optional(),
});
export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().min(7).max(20).nullable().optional(),
  area: z.string().trim().max(80).nullable().optional(),
  address: z.string().trim().max(200).nullable().optional(),
  bloodGroup: z.string().trim().max(6).nullable().optional(),
  medicalNotes: z.string().trim().max(500).nullable().optional(),
});
export const adminUpdateUserSchema = updateProfileSchema.extend({
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
});
