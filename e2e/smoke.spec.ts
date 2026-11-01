import { expect, test } from "@playwright/test";

test("landing page loads with the emergency disclaimer", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/ResQFlow/);
  await expect(page.getByText("academic demonstration project")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Shelters with space/ })).toBeVisible();
});

test("protected citizen route redirects anonymous users to login", async ({ page }) => {
  await page.goto("/citizen/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("citizen can log in and reach the dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill("citizen@resqflow.local");
  await page.getByLabel(/password/i).fill("Citizen@12345");
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await expect(page).toHaveURL(/\/citizen\/dashboard/, { timeout: 10_000 });
});

test("admin analytics page renders for the admin account", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill("admin@resqflow.local");
  await page.getByLabel(/password/i).fill("Admin@12345");
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10_000 });
  await page.goto("/admin/analytics");
  await expect(page.getByRole("heading", { name: /analytics/i })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Pending SOS/i)).toBeVisible();
});
