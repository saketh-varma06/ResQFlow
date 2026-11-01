import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { body, params, query } from "../middleware/validate";
import * as svc from "../services/user.service";
import type { z } from "zod";
import type { adminUpdateUserSchema, listUsersQuery, updateProfileSchema } from "../validators/user.validators";
import type { idParam } from "../validators/common";

export const list = asyncHandler(async (req: Request, res: Response) => { const r = await svc.listUsers(req.user!, query<z.infer<typeof listUsersQuery>>(req)); res.json(r); });
export const getOne = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await svc.getUser(req.user!, params<z.infer<typeof idParam>>(req).id) }); });
export const updateMe = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await svc.updateProfile(req.user!, body<z.infer<typeof updateProfileSchema>>(req)) }); });
export const adminUpdate = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await svc.adminUpdateUser(req.user!, params<z.infer<typeof idParam>>(req).id, body<z.infer<typeof adminUpdateUserSchema>>(req), req.ip) }); });
export const remove = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await svc.deleteUser(req.user!, params<z.infer<typeof idParam>>(req).id, req.ip) }); });
