import mongoose from "mongoose";

/**
 * Single shared Mongoose connection for ResQFlow (Atlas migration layer).
 *
 * STATUS: PREPARED, NOT CONNECTED. No Atlas cluster / credentials exist yet,
 * so there is deliberately no fallback URI and no hardcoded connection string
 * anywhere in this package. The running application continues to use
 * PostgreSQL via Prisma (`DATABASE_URL`); this module is only exercised
 * during the future migration / cutover described in docs/DATABASE_DESIGN.md.
 */

const NOT_SET_MESSAGE =
  "MONGODB_URI is not set — Atlas not connected (preparation only)";

let listenersAttached = false;

function attachConnectionLogging(): void {
  if (listenersAttached) return;
  listenersAttached = true;
  mongoose.connection.on("connected", () => {
    // Never log the URI itself — it contains credentials.
    console.log("[mongodb] connected");
  });
  mongoose.connection.on("disconnected", () => {
    console.warn("[mongodb] disconnected");
  });
  mongoose.connection.on("reconnected", () => {
    console.log("[mongodb] reconnected");
  });
  mongoose.connection.on("error", (err: Error) => {
    console.error("[mongodb] connection error:", err.message);
  });
}

export interface ConnectOptions {
  /** Number of connection attempts before giving up (default 3). */
  retries?: number;
  /** Base delay between attempts in ms; doubled each attempt (default 1000). */
  retryDelayMs?: number;
  /** Server selection timeout per attempt in ms (default 10000). */
  serverSelectionTimeoutMS?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Connect to MongoDB Atlas using the `MONGODB_URI` environment variable.
 *
 * Throws a clear preparation-only error when `MONGODB_URI` is unset or empty
 * — it never invents or falls back to a hardcoded URI.
 * Safe to call more than once: an already-open (or opening) connection is
 * returned instead of opening a second one. The driver maintains a single
 * connection pool; the whole app shares `mongoose.connection`.
 */
export async function connectMongo(
  options: ConnectOptions = {},
): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.trim() === "") {
    throw new Error(NOT_SET_MESSAGE);
  }

  const readyState = mongoose.connection.readyState;
  if (readyState === 1 || readyState === 2) {
    // 1 = connected, 2 = connecting — reuse the single shared connection.
    return mongoose;
  }

  attachConnectionLogging();
  mongoose.set("strictQuery", true);

  const retries = options.retries ?? 3;
  const baseDelay = options.retryDelayMs ?? 1000;
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: options.serverSelectionTimeoutMS ?? 10_000,
        // Sensible Atlas defaults: the driver retries writes once by default
        // on replica sets; majority write concern is set in the URI or here.
        retryWrites: true,
        w: "majority",
        maxPoolSize: 10,
      });
      return mongoose;
    } catch (err) {
      lastError = err;
      console.error(
        `[mongodb] connect attempt ${attempt}/${retries} failed:`,
        err instanceof Error ? err.message : String(err),
      );
      if (attempt < retries) {
        await sleep(baseDelay * 2 ** (attempt - 1));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`[mongodb] failed to connect after ${retries} attempts`);
}

/** Gracefully close the shared connection (used at shutdown / in scripts). */
export async function disconnectMongo(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export { mongoose };
