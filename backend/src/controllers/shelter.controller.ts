import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { body, params, query } from "../middleware/validate";
import * as svc from "../services/shelter.service";
import type { z } from "zod";
import type { createShelterSchema, listSheltersQuery, updateShelterSchema } from "../validators/shelter.validators";
import type { idParam } from "../validators/common";

export const list = asyncHandler(async (req: Request, res: Response) => { res.json(await svc.listShelters(query<z.infer<typeof listSheltersQuery>>(req))); });
export const getOne = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await svc.getShelter(params<z.infer<typeof idParam>>(req).id) }); });
export const create = asyncHandler(async (req: Request, res: Response) => { res.status(201).json({ data: await svc.createShelter(req.user!, body<z.infer<typeof createShelterSchema>>(req), req.ip) }); });
export const update = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await svc.updateShelter(req.user!, params<z.infer<typeof idParam>>(req).id, body<z.infer<typeof updateShelterSchema>>(req), req.ip) }); });
export const remove = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await svc.deleteShelter(req.user!, params<z.infer<typeof idParam>>(req).id, req.ip) }); });
