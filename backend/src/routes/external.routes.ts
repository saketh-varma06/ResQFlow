import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { query, validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { geocodePlaces, getExternalOverview } from "../services/external.service";

const router = Router();
const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
});
router.get("/overview", requireAuth, validate({ query: querySchema }), asyncHandler(async (req, res) => {
  const { lat, lon } = query<{ lat?: number; lon?: number }>(req);
  res.json({ data: await getExternalOverview(lat, lon) });
}));
const geocodeQuery = z.object({ q: z.string().trim().min(2).max(80) });
router.get("/geocode", requireAuth, validate({ query: geocodeQuery }), asyncHandler(async (req, res) => {
  const { q } = query<{ q: string }>(req);
  res.json({ data: await geocodePlaces(q) });
}));
export default router;
