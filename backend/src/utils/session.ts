import { randomBytes } from "node:crypto";
import type { Response } from "express";
import { env } from "../config/env";

export const SESSION_COOKIE = "resqflow_session";
export const CSRF_COOKIE = "resqflow_csrf";
const isProd = env.NODE_ENV === "production";

/** httpOnly JWT session cookie + readable CSRF cookie (double-submit pattern). */
export function setSessionCookies(res: Response, token: string) {
  const maxAge = 7 * 24 * 3600 * 1000;
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: isProd, path: "/", maxAge });
  const csrf = randomBytes(32).toString("hex");
  res.cookie(CSRF_COOKIE, csrf, { httpOnly: false, sameSite: "lax", secure: isProd, path: "/", maxAge });
  return csrf;
}
export function clearSessionCookies(res: Response) {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.clearCookie(CSRF_COOKIE, { path: "/" });
}
export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
