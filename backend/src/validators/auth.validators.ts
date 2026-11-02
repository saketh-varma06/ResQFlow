import { z } from "zod";
import { UserRole } from "../types/enums";
export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().min(7).max(20).optional(),
  password: z.string().min(8).max(72),
  role: z.nativeEnum(UserRole).optional().default("CITIZEN"),
  area: z.string().trim().max(80).optional(),
  address: z.string().trim().max(200).optional(),
});
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(72),
});
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(72),
});
