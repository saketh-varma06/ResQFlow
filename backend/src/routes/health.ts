import { Router } from "express";
import { prisma } from "../database/prisma";
export const healthRouter = Router();
healthRouter.get("/health", async (_req, res) => {
  let database = "down";
  try { await prisma.$queryRaw`SELECT 1`; database = "up"; } catch { database = "down"; }
  res.status(200).json({
    status: "ok", service: "resqflow-backend", phase: 2,
    database, timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    environment: process.env.NODE_ENV ?? "development",
  });
});
