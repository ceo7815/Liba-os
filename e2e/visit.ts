import { expect, type Page, type Response } from "@playwright/test";
import type { SmokeRoute } from "./routes";

const ERROR_TEXT = /Application error|Unhandled Runtime Error|Internal Server Error/;

const IGNORABLE_CONSOLE = [
  /favicon\.ico/i,
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
  /\[HMR\]/i,
  /ResizeObserver loop/i,
];

export async function openRoute(page: Page, route: SmokeRoute): Promise<Response | null> {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (IGNORABLE_CONSOLE.some((pattern) => pattern.test(text))) return;
    errors.push(text);
  });
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });

  const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
  const status = response?.status() ?? 0;

  if (route.allowNotFound && status === 404) {
    expect(errors, `${route.path} console`).toEqual([]);
    return response;
  }

  expect(status, `${route.path} status`).toBeLessThan(500);
  expect(status, `${route.path} status`).not.toBe(404);

  if (route.auth) {
    expect(page.url(), `${route.path} stayed signed in`).not.toContain("/login");
  }

  await expect(page.getByText(ERROR_TEXT)).toHaveCount(0);
  const heading = page.locator("h1:visible").first();
  await expect(heading, `${route.path} heading`).toBeVisible();
  await expect(heading).toContainText(route.heading);
  expect(errors, `${route.path} console`).toEqual([]);
  return response;
}
