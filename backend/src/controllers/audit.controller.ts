import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { params, query } from "../middleware/validate";
import * as svc from "../services/audit.service";
import type { z } from "zod";
import type { listAuditQuery } from "../validators/audit.validators";
import type { idParam } from "../validators/common";

export const list = asyncHandler(async (req: Request, res: Response) => { res.json(await svc.listAudit(query<z.infer<typeof listAuditQuery>>(req))); });
export const getOne = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await svc.getAudit(params<z.infer<typeof idParam>>(req).id) }); });
