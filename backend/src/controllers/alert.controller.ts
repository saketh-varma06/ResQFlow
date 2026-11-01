import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { body, params, query } from "../middleware/validate";
import * as svc from "../services/alert.service";
import type { z } from "zod";
import type { createAlertSchema, listAlertsQuery, updateAlertSchema } from "../validators/alert.validators";
import type { idParam } from "../validators/common";

export const list = asyncHandler(async (req: Request, res: Response) => { res.json(await svc.listAlerts(req.user, query<z.infer<typeof listAlertsQuery>>(req))); });
export const getOne = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await svc.getAlert(params<z.infer<typeof idParam>>(req).id) }); });
export const create = asyncHandler(async (req: Request, res: Response) => { res.status(201).json({ data: await svc.createAlert(req.user!, body<z.infer<typeof createAlertSchema>>(req), req.ip) }); });
export const update = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await svc.updateAlert(req.user!, params<z.infer<typeof idParam>>(req).id, body<z.infer<typeof updateAlertSchema>>(req), req.ip) }); });
export const remove = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await svc.deleteAlert(req.user!, params<z.infer<typeof idParam>>(req).id, req.ip) }); });
