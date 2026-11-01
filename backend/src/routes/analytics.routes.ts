import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import * as c from "../controllers/analytics.controller";
export const analyticsRouter = Router();
analyticsRouter.get("/overview", requireAuth, requireRole("ADMIN", "RESPONDER"), c.overview);
