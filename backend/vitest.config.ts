import { defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";

function testMongoUri(): string {
  try {
    const line = readFileSync(new URL("./.env", import.meta.url), "utf8").split("\n").find((l) => l.startsWith("MONGODB_URI="));
    const uri = line?.slice("MONGODB_URI=".length).trim();
    if (uri) return uri.replace(/\/resqflow(\?|$)/, "/resqflow_test$1");
  } catch { /* fall through */ }
  return "mongodb://127.0.0.1:27017/resqflow_test";
}
// API tests run against a DEDICATED test database — the MongoDB `resqflow_test` database on the same Atlas cluster — never the dev database.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
    env: {
      NODE_ENV: "test",
      MONGODB_URI: testMongoUri(),
      MONGODB_URI_TEST: testMongoUri(),
      JWT_SECRET: "test-only-secret-do-not-use-in-production-1234567890",
      JWT_EXPIRES_IN: "1d",
      CORS_ORIGIN: "http://localhost:5173",
    },
  },
});
