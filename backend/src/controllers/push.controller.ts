import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { body } from "../middleware/validate";
import * as svc from "../services/push.service";
import type { z } from "zod";
import type { subscribePushSchema, unsubscribePushSchema } from "../validators/alert.validators";

export const publicKey = asyncHandler(async (_req: Request, res: Response) => { res.json({ data: svc.pushPublicKey() }); });
export const subscribe = asyncHandler(async (req: Request, res: Response) => { res.status(201).json({ data: await svc.subscribePush(req.user!, body<z.infer<typeof subscribePushSchema>>(req)) }); });
export const unsubscribe = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await svc.unsubscribePush(req.user!, body<z.infer<typeof unsubscribePushSchema>>(req)) }); });
