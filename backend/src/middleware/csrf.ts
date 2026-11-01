import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { CSRF_COOKIE, SESSION_COOKIE, parseCookies } from "../utils/session";

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);
export function csrfProtection(req: Request, _res: Response, next: NextFunction) {
  if (SAFE.has(req.method)) return next();
  // Bearer-token requests are not ambient credentials → no CSRF risk → exempt.
  if (req.headers.authorization?.startsWith("Bearer ")) return next();
  const cookies = parseCookies(req.headers.cookie);
  if (!cookies[SESSION_COOKIE]) return next(); // no session cookie in play (public endpoint or unauthenticated)
  const header = req.headers["x-csrf-token"];
  if (!header || header !== cookies[CSRF_COOKIE]) {
    return next(new ApiError(403, "CSRF check failed — send the x-csrf-token header matching the resqflow_csrf cookie"));
  }
  return next();
}
