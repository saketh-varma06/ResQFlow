import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
export function notFound(_req: Request, res: Response) { res.status(404).json({ error: "Route not found" }); }
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) return res.status(err.statusCode).json({ error: err.message, ...(err.details ? { details: err.details } : {}) });
  if ((err as { code?: string })?.code === "P2002") return res.status(409).json({ error: "A record with this unique value already exists" });
  if ((err as { code?: string })?.code === "P2025") return res.status(404).json({ error: "Record not found" });
  console.error("Unhandled error:", err);
  return res.status(500).json({ error: "Internal server error" });
}
