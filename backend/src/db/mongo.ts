import mongoose from "mongoose";
import { env } from "../config/env";
import { ALL_MODELS } from "../models";

/**
 * Single shared Mongoose connection to MongoDB Atlas.
 * In tests (NODE_ENV=test) MONGODB_URI_TEST takes precedence when set;
 * vitest.config.ts points MONGODB_URI itself at the test database.
 */
export function mongoUri(): string {
  const uri = env.NODE_ENV === "test" && env.MONGODB_URI_TEST ? env.MONGODB_URI_TEST : env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set — the backend requires a MongoDB Atlas connection string (see .env.example)");
  return uri;
}

let connectPromise: Promise<typeof mongoose> | null = null;
let indexesEnsured = false;

async function ensureIndexesOnce(): Promise<void> {
  if (indexesEnsured) return;
  indexesEnsured = true;
  await Promise.all(ALL_MODELS.map((m) => m.syncIndexes()));
}

export function connectMongo(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose);
  if (!connectPromise) {
    connectPromise = (async () => {
      await mongoose.connect(mongoUri(), { serverSelectionTimeoutMS: 15000 });
      await ensureIndexesOnce();
      return mongoose;
    })().catch((err) => {
      connectPromise = null;
      indexesEnsured = false;
      throw err;
    });
  }
  return connectPromise;
}

/** Real liveness check used by /api/health — an actual admin ping, not socket state. */
export async function mongoPing(): Promise<boolean> {
  try {
    if (mongoose.connection.readyState !== 1) await connectMongo();
    const db = mongoose.connection.db;
    if (!db) return false;
    await db.admin().ping();
    return true;
  } catch {
    return false;
  }
}

export async function disconnectMongo(): Promise<void> {
  connectPromise = null;
  await mongoose.disconnect();
}

export { mongoose };
