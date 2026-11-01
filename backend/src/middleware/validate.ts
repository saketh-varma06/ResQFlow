import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { ApiError } from "../utils/ApiError";
interface Schemas { body?: ZodSchema; query?: ZodSchema; params?: ZodSchema }
export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const out: { body?: unknown; query?: unknown; params?: unknown } = {};
      if (schemas.body) out.body = schemas.body.parse(req.body);
      if (schemas.query) out.query = schemas.query.parse(req.query);
      if (schemas.params) out.params = schemas.params.parse(req.params);
      req.validated = out;
      if (out.body !== undefined) req.body = out.body;
      next();
    } catch (err) {
      const issues = (err as { issues?: unknown })?.issues;
      next(ApiError.badRequest("Validation failed", issues ?? String(err)));
    }
  };
}
export function body<T>(req: Request): T { return (req.validated?.body ?? req.body) as T; }
export function query<T>(req: Request): T { return (req.validated?.query ?? req.query) as T; }
export function params<T>(req: Request): T { return (req.validated?.params ?? req.params) as T; }
