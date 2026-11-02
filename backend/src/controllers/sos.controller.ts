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
import * as vsvc from "../services/verification.service";
import type { markDuplicateSchema as sosMarkDup } from "../validators/sos.validators";
export const duplicates = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await vsvc.duplicateCandidates("SOS", params<z.infer<typeof idParam>>(req).id) }); });
export const verify = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await vsvc.verifyEntity(req.user!, "SOS", params<z.infer<typeof idParam>>(req).id, req.ip) }); });
export const markDuplicate = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await vsvc.markDuplicate(req.user!, "SOS", params<z.infer<typeof idParam>>(req).id, body<z.infer<typeof sosMarkDup>>(req).duplicateOfId, req.ip) }); });
export const unflagDuplicate = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await vsvc.unflagDuplicate(req.user!, "SOS", params<z.infer<typeof idParam>>(req).id, req.ip) }); });
export const release = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await svc.releaseSos(req.user!, params<z.infer<typeof idParam>>(req).id, req.ip) }); });
import * as dsvc2 from "../services/dispatch.service";
export const dispatch = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await dsvc2.dispatchForSos(params<z.infer<typeof idParam>>(req).id) }); });
export const route = asyncHandler(async (req: Request, res: Response) => {
  const unit = typeof req.query.unit === "string" ? req.query.unit : "";
  if (!unit) { res.status(400).json({ error: "Query parameter 'unit' (responder profile id) is required" }); return; }
  res.json({ data: await dsvc2.routeFor("SOS", params<z.infer<typeof idParam>>(req).id, unit) });
});
import * as fsvc2 from "../services/fieldkit.service";
import type { checklistPatchSchema as ChkSchema2, fieldReportSchema as FrSchema2 } from "../validators/incident.validators";
export const getChecklist = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await fsvc2.getChecklist(req.user!, "SOS", params<z.infer<typeof idParam>>(req).id) }); });
export const patchChecklist = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await fsvc2.updateChecklist(req.user!, "SOS", params<z.infer<typeof idParam>>(req).id, body<z.infer<typeof ChkSchema2>>(req), req.ip) }); });
export const listFieldReports = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await fsvc2.listFieldReports(req.user!, "SOS", params<z.infer<typeof idParam>>(req).id) }); });
export const createFieldReport = asyncHandler(async (req: Request, res: Response) => { res.status(201).json({ data: await fsvc2.createFieldReport(req.user!, "SOS", params<z.infer<typeof idParam>>(req).id, body<z.infer<typeof FrSchema2>>(req), req.ip) }); });
