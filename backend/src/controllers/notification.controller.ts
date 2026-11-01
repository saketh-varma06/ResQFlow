import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { params, query } from "../middleware/validate";
import * as svc from "../services/notification.service";
import type { z } from "zod";
import type { listNotificationsQuery } from "../validators/notification.validators";
import type { idParam } from "../validators/common";

export const list = asyncHandler(async (req: Request, res: Response) => { res.json(await svc.listNotifications(req.user!, query<z.infer<typeof listNotificationsQuery>>(req))); });
export const unreadCount = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await svc.unreadCount(req.user!) }); });
export const markRead = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await svc.markRead(req.user!, params<z.infer<typeof idParam>>(req).id) }); });
export const markAllRead = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await svc.markAllRead(req.user!) }); });
export const remove = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await svc.deleteNotification(req.user!, params<z.infer<typeof idParam>>(req).id) }); });
