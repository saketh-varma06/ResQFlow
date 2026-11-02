import { z } from "zod";
import { AuditResult } from "../types/enums";
import { paginationQuery } from "./common";
export const listAuditQuery = paginationQuery.extend({
  result: z.nativeEnum(AuditResult).optional(),
  action: z.string().optional(),
  actorId: z.string().optional(),
  actorEmail: z.string().optional(),
});
