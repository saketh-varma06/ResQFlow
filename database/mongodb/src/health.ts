import mongoose from "mongoose";

export interface MongoHealth {
  connected: boolean;
  /** Raw Mongoose readyState: 0 disconnected, 1 connected, 2 connecting, 3 disconnecting. */
  readyState: number;
  message: string;
}

const READY_STATE_LABELS: Record<number, string> = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

/**
 * Report MongoDB health without ever throwing.
 *
 * When connected, liveness is confirmed with an admin `ping` command
 * (`connection.db.admin().ping()`), not just the socket state. When not
 * connected (the normal state until Atlas credentials are provided), it
 * reports `connected: false` with an explanatory message.
 *
 * Intended backing implementation for a future `GET /api/health/db`-style
 * endpoint alongside the existing PostgreSQL health check — see
 * docs/DATABASE_DESIGN.md §2.9. It is NOT wired into the running backend.
 */
export async function mongoHealth(): Promise<MongoHealth> {
  const readyState = mongoose.connection.readyState;
  const label = READY_STATE_LABELS[readyState] ?? `unknown (${readyState})`;

  if (readyState !== 1) {
    return {
      connected: false,
      readyState,
      message:
        readyState === 0 && !process.env.MONGODB_URI
          ? "MONGODB_URI is not set — Atlas not connected (preparation only)"
          : `MongoDB not connected (readyState: ${label})`,
    };
  }

  try {
    const db = mongoose.connection.db;
    if (!db) {
      return {
        connected: false,
        readyState,
        message: "MongoDB connection has no active database handle",
      };
    }
    const result = await db.admin().ping();
    const ok = (result as { ok?: number }).ok === 1;
    return {
      connected: ok,
      readyState,
      message: ok
        ? "MongoDB reachable (admin ping ok)"
        : "MongoDB admin ping did not return ok: 1",
    };
  } catch (err) {
    return {
      connected: false,
      readyState,
      message: `MongoDB ping failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
