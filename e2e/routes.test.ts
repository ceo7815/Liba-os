import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { SMOKE_ROUTES, routesForProfile } from "./routes";

function pageFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...pageFiles(full));
    else if (entry === "page.tsx") found.push(full);
  }
  return found;
}

function routeFromPage(file: string): string {
  const rel = path.relative(path.join("app"), file).replaceAll("\\", "/");
  const url = rel
    .replace(/^\(authenticated\)\//, "")
    .replace(/\/page\.tsx$/, "")
    .replace(/^page\.tsx$/, "");
  return `/${url}`.replace(/\/$/, "") || "/";
}

test("smoke catalog covers every static Liba and Shemesh page on main", () => {
  const covered = new Set(SMOKE_ROUTES.map((route) => route.path));
  const missing = pageFiles("app")
    .map(routeFromPage)
    .filter((route) => !route.includes("["))
    .filter((route) => !covered.has(route));
  assert.deepEqual(missing, []);
  assert.ok(routesForProfile("main").every((route) => !route.profile));
  assert.ok(routesForProfile("shemesh").some((route) => route.path === "/shemesh/clients"));
  assert.ok(routesForProfile("design").some((route) => route.path === "/design-lab"));
  assert.equal(routesForProfile("main").some((route) => route.path === "/shemesh/clients"), false);
});
