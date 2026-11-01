import { defineConfig } from "@playwright/test";

/** Browser smoke tests — require the app running locally (backend :4000, frontend :5173). */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 0,
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173" },
  reporter: [["list"]],
});
