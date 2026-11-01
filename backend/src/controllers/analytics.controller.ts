import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as svc from "../services/analytics.service";
export const overview = asyncHandler(async (_req: Request, res: Response) => { res.json({ data: await svc.overview() }); });
