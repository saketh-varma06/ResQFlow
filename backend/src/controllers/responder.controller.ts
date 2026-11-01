import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { body, params, query } from "../middleware/validate";
import * as svc from "../services/responder.service";
import type { z } from "zod";
import type { availabilitySchema, createResponderSchema, listRespondersQuery, updateResponderSchema } from "../validators/responder.validators";
import type { idParam } from "../validators/common";

export const list = asyncHandler(async (req: Request, res: Response) => { res.json(await svc.listResponders(query<z.infer<typeof listRespondersQuery>>(req))); });
export const getOne = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await svc.getResponder(params<z.infer<typeof idParam>>(req).id) }); });
export const me = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await svc.myResponderProfile(req.user!) }); });
export const create = asyncHandler(async (req: Request, res: Response) => { res.status(201).json({ data: await svc.createResponder(req.user!, body<z.infer<typeof createResponderSchema>>(req), req.ip) }); });
export const update = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await svc.updateResponder(req.user!, params<z.infer<typeof idParam>>(req).id, body<z.infer<typeof updateResponderSchema>>(req), req.ip) }); });
export const remove = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await svc.deleteResponder(req.user!, params<z.infer<typeof idParam>>(req).id, req.ip) }); });
export const availability = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await svc.setMyAvailability(req.user!, body<z.infer<typeof availabilitySchema>>(req).readiness) }); });
