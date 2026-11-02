import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as svc from "../services/analytics.service";
export const overview = asyncHandler(async (_req: Request, res: Response) => { res.json({ data: await svc.overview() }); });
import * as ssvc from "../services/sitrep.service";
export const sitrep = asyncHandler(async (req: Request, res: Response) => {
  const report = await ssvc.buildSitrep();
  if (req.query.format === "text") { res.type("text/plain").send(ssvc.renderSitrepText(report)); return; }
  res.json({ data: report });
});
export const replay = asyncHandler(async (req: Request, res: Response) => {
  const hours = Math.min(168, Math.max(1, Number(req.query.hours ?? 24) || 24));
  res.json({ data: await ssvc.buildReplay(hours) });
});
