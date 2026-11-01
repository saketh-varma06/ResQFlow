import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@prisma/client";
import { prisma } from "../database/prisma";
import { ApiError } from "../utils/ApiError";
import { verifyToken } from "../utils/security";
import { SESSION_COOKIE, parseCookies } from "../utils/session";

export function extractToken(req: Request): { token: string; via: "cookie" | "bearer" } | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return { token: header.slice(7), via: "bearer" };
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[SESSION_COOKIE]) return { token: cookies[SESSION_COOKIE], via: "cookie" };
  return null;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const found = extractToken(req);
    if (!found) throw ApiError.unauthorized("Not signed in");
    const payload = verifyToken(found.token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw ApiError.unauthorized("Account no longer exists");
    // Session invalidation: logout / password change bumps tokenVersion, killing every earlier token.
    if (payload.tv !== user.tokenVersion) throw ApiError.unauthorized("Session has been invalidated — sign in again");
    if (user.status === "SUSPENDED") throw ApiError.forbidden("This account is suspended");
    if (user.status === "PENDING") throw ApiError.forbidden("This account is pending approval");
    req.user = { id: user.id, email: user.email, name: user.name, role: user.role };
    (req as Request & { authVia?: string }).authVia = found.via;
    next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    return next(ApiError.unauthorized("Invalid or expired session"));
  }
}
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden(`Requires role: ${roles.join(" or ")}`));
    return next();
  };
}
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  if (!extractToken(req)) return next();
  return requireAuth(req, _res, next);
}
