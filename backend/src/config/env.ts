import { z } from "zod";
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  // Comma-separated allowlist of browser origins (scheme required), e.g.
  // "http://localhost:5173,http://localhost:4173" for dev + preview servers.
  CORS_ORIGIN: z.string().default("http://localhost:5173").transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean)),
  // MongoDB Atlas connection string (see .env.example). Required before the
  // server can serve data; optional at import time so tests/tooling can load
  // configuration first (vitest injects the test-database URI).
  MONGODB_URI: z.string().min(1).optional(),
  // Optional dedicated test-database URI (defaults to MONGODB_URI in tests).
  MONGODB_URI_TEST: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
});
export const env = EnvSchema.parse(process.env);
export type Env = z.infer<typeof EnvSchema>;
