import { Router } from "express";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { idParam } from "../validators/common";
import { createAlertSchema, createAlertSubscriptionSchema, listAlertsQuery, updateAlertSchema } from "../validators/alert.validators";
import * as c from "../controllers/alert.controller";
export const alertRouter = Router();
// Stage B routes are registered before /:id so literals win over the parameter route.
alertRouter.get("/cap.xml", c.capFeed);
alertRouter.get("/subscriptions", requireAuth, c.listSubscriptions);
alertRouter.post("/subscriptions", requireAuth, validate({ body: createAlertSubscriptionSchema }), c.createSubscription);
alertRouter.delete("/subscriptions/:id", requireAuth, validate({ params: idParam }), c.deleteSubscription);
alertRouter.get("/", optionalAuth, validate({ query: listAlertsQuery }), c.list);
alertRouter.get("/:id/cap.xml", optionalAuth, validate({ params: idParam }), c.capOne);
alertRouter.get("/:id", optionalAuth, validate({ params: idParam }), c.getOne);
alertRouter.post("/", requireAuth, requireRole("ADMIN"), validate({ body: createAlertSchema }), c.create);
alertRouter.patch("/:id", requireAuth, requireRole("ADMIN"), validate({ params: idParam, body: updateAlertSchema }), c.update);
alertRouter.delete("/:id", requireAuth, requireRole("ADMIN"), validate({ params: idParam }), c.remove);
