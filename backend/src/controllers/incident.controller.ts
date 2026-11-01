import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { body, params, query } from "../middleware/validate";
import * as svc from "../services/incident.service";
import type { z } from "zod";
import type { addNoteSchema, assignIncidentSchema, createIncidentSchema, listIncidentsQuery, updateIncidentSchema, updateIncidentStatusSchema } from "../validators/incident.validators";
import type { idParam } from "../validators/common";

export const create = asyncHandler(async (req: Request, res: Response) => { res.status(201).json({ data: await svc.createIncident(req.user!, body<z.infer<typeof createIncidentSchema>>(req), req.ip) }); });
export const list = asyncHandler(async (req: Request, res: Response) => { res.json(await svc.listIncidents(req.user!, query<z.infer<typeof listIncidentsQuery>>(req))); });
export const getOne = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await svc.getIncident(params<z.infer<typeof idParam>>(req).id) }); });
export const update = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await svc.updateIncident(req.user!, params<z.infer<typeof idParam>>(req).id, body<z.infer<typeof updateIncidentSchema>>(req), req.ip) }); });
export const updateStatus = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await svc.updateIncidentStatus(req.user!, params<z.infer<typeof idParam>>(req).id, body<z.infer<typeof updateIncidentStatusSchema>>(req), req.ip) }); });
export const assign = asyncHandler(async (req: Request, res: Response) => { res.status(201).json({ data: await svc.assignIncident(req.user!, params<z.infer<typeof idParam>>(req).id, body<z.infer<typeof assignIncidentSchema>>(req), req.ip) }); });
export const accept = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await svc.respondToAssignment(req.user!, params<z.infer<typeof idParam>>(req).id, "accept") }); });
export const decline = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await svc.respondToAssignment(req.user!, params<z.infer<typeof idParam>>(req).id, "decline") }); });
export const complete = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await svc.respondToAssignment(req.user!, params<z.infer<typeof idParam>>(req).id, "complete") }); });
export const remove = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await svc.deleteIncident(req.user!, params<z.infer<typeof idParam>>(req).id, req.ip) }); });
export const addNote = asyncHandler(async (req: Request, res: Response) => { res.status(201).json({ data: await svc.addNote(req.user!, params<z.infer<typeof idParam>>(req).id, body<z.infer<typeof addNoteSchema>>(req).note, req.ip) }); });
