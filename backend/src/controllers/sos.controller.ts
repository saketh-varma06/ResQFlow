import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { body, params, query } from "../middleware/validate";
import * as svc from "../services/sos.service";
import type { z } from "zod";
import type { assignSosSchema, createSosSchema, listSosQuery, updateSosStatusSchema } from "../validators/sos.validators";
import type { idParam } from "../validators/common";

export const create = asyncHandler(async (req: Request, res: Response) => { res.status(201).json({ data: await svc.createSos(req.user!, body<z.infer<typeof createSosSchema>>(req), req.ip) }); });
export const list = asyncHandler(async (req: Request, res: Response) => { res.json(await svc.listSos(req.user!, query<z.infer<typeof listSosQuery>>(req))); });
export const getOne = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await svc.getSos(req.user!, params<z.infer<typeof idParam>>(req).id) }); });
export const updateStatus = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await svc.updateSosStatus(req.user!, params<z.infer<typeof idParam>>(req).id, body<z.infer<typeof updateSosStatusSchema>>(req), req.ip) }); });
export const assign = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await svc.assignSos(req.user!, params<z.infer<typeof idParam>>(req).id, body<z.infer<typeof assignSosSchema>>(req), req.ip) }); });
