import { z } from "zod";
import { paginationQuery } from "./common";
export const createDonationSchema = z.object({
  amount: z.coerce.number().int().min(1).max(10_000_000),
  targetType: z.enum(["GENERAL", "SHELTER", "INCIDENT"]).optional().default("GENERAL"),
  targetId: z.string().trim().min(1).max(64).optional(),
  message: z.string().trim().max(300).optional(),
  paymentRef: z.string().trim().max(80).optional(),
  anonymous: z.coerce.boolean().optional().default(false),
}).refine((d) => d.targetType === "GENERAL" || !!d.targetId, { message: "targetId is required when donating to a specific shelter or incident", path: ["targetId"] });
export const updateDonationStatusSchema = z.object({ status: z.enum(["RECEIVED", "CANCELLED"]) });
export const listDonationsQuery = paginationQuery.extend({
  status: z.enum(["PLEDGED", "RECEIVED", "CANCELLED"]).optional(),
  targetType: z.enum(["GENERAL", "SHELTER", "INCIDENT"]).optional(),
  mine: z.coerce.boolean().optional(),
});
