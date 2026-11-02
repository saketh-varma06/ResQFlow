import { Router } from "express";
import { mongoPing } from "../db/mongo";
export const healthRouter = Router();
healthRouter.get("/health", async (_req, res) => {
  const database = (await mongoPing()) ? "up" : "down";
  res.status(200).json({
    status: "ok", service: "resqflow-backend", phase: 2,
    database, timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    environment: process.env.NODE_ENV ?? "development",
  });
});
