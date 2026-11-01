import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { body } from "../middleware/validate";
import { clearSessionCookies, setSessionCookies } from "../utils/session";
import * as svc from "../services/auth.service";
import type { registerSchema, loginSchema, changePasswordSchema } from "../validators/auth.validators";
import type { z } from "zod";

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.register(body<z.infer<typeof registerSchema>>(req), req.ip);
  if (result.token) setSessionCookies(res, result.token); // citizens get a session immediately; pending roles do not
  res.status(201).json({ data: result });
});
export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.login(body<z.infer<typeof loginSchema>>(req), req.ip);
  setSessionCookies(res, result.token);
  res.json({ data: result });
});
export const me = asyncHandler(async (req: Request, res: Response) => { res.json({ data: await svc.me(req.user!.id) }); });
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.changePassword(req.user!.id, body<z.infer<typeof changePasswordSchema>>(req));
  setSessionCookies(res, result.token);
  res.json({ data: { changed: result.changed, user: result.user, token: result.token } });
});
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.logout(req.user!.id, req.ip);
  clearSessionCookies(res);
  res.json({ data: result });
});
