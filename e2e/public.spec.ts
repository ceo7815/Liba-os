import { test } from "@playwright/test";
import { routesForProfile } from "./routes";
import { openRoute } from "./visit";

for (const route of routesForProfile().filter((item) => !item.auth)) {
  test(`${route.path} renders`, async ({ page }) => {
    await openRoute(page, route);
  });
}
