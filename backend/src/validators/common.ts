import { z } from "zod";
export const idParam = z.object({ id: z.string().min(1) });
export const paginationQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().max(120).optional(),
});
export const lat = z.number().min(-90).max(90);
export const lng = z.number().min(-180).max(180);
