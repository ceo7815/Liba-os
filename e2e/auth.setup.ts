import { expect, test as setup } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const statePath = path.join("e2e", ".auth", "user.json");

setup("sign in as the seeded demo user", async ({ page }) => {
  const email = process.env.E2E_EMAIL?.trim();
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Set E2E_EMAIL and E2E_PASSWORD to a seeded demo user. Do not commit the password.",
    );
  }

  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  await page.goto("/login");
  const chooser = page.getByRole("heading", { name: "בחירת מערכת" });
  if (await chooser.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: /ליבה|המערכת הקיימת/ }).click();
  }
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "התחברות" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await page.context().storageState({ path: statePath });
});
