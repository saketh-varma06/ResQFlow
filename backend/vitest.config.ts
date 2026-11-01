import { defineConfig } from "vitest/config";
// API tests run against a DEDICATED test database (resqflow_test), never the dev database.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://resqflow:resqflow_dev_password@localhost:5432/resqflow_test?schema=public",
      JWT_SECRET: "test-only-secret-do-not-use-in-production-1234567890",
      JWT_EXPIRES_IN: "1d",
      CORS_ORIGIN: "http://localhost:5173",
    },
  },
});
