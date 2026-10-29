import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://127.0.0.1:3456";
const OUT = "/workspace/sh-mobile";
fs.mkdirSync(OUT, { recursive: true });

const ROUTES = [
  "dashboard",
  "cases",
  "gviya",
  "reports",
  "marketing",
  "costs",
  "settlement",
  "sources",
  "tax-refunds",
  "insurance",
  "payroll",
  "sales",
  "clients",
  "alerts",
  "finance",
  "revenue",
  "bank",
  "leads",
  "formulas",
  "settings",
  "agency",
  "expenses",
  "receipts",
  "revival",
  "commercial",
  "commissions",
  "income",
  "access",
  "accountant",
  "ad-receipts",
  "permissions",
  "portfolio-report",
  "system",
];

const results = [];

const browser = await chromium.launch({ headless: true });

async function shoot(page, name, viewport) {
  const url = `${BASE}/design-lab/shemesh-routes?r=${encodeURIComponent(name)}`;
  const tag = viewport.width <= 500 ? "m" : "d";
  const file = path.join(OUT, `${tag}-${name}.png`);
  let overflow = null;
  let status = "ok";
  try {
    const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    if (!resp || resp.status() >= 400) status = `http-${resp?.status()}`;
    await page.waitForTimeout(400);
    overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return {
        scrollWidth: doc.scrollWidth,
        innerWidth: window.innerWidth,
        ok: doc.scrollWidth <= window.innerWidth + 1,
        bodyScroll: document.body.scrollWidth,
      };
    });
    await page.screenshot({ path: file, fullPage: true });
  } catch (err) {
    status = String(err?.message || err).slice(0, 200);
  }
  results.push({ name, viewport: `${viewport.width}x${viewport.height}`, status, overflow, file });
  console.log(JSON.stringify(results[results.length - 1]));
}

const mobile = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const desktop = { width: 1440, height: 900, deviceScaleFactor: 1 };

for (const vp of [mobile, desktop]) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.deviceScaleFactor,
    isMobile: !!vp.isMobile,
    hasTouch: !!vp.hasTouch,
    locale: "he-IL",
  });
  const page = await context.newPage();
  for (const route of ROUTES) {
    await shoot(page, route, vp);
  }
  await context.close();
}

await browser.close();
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
const mobileFails = results.filter((r) => r.viewport.startsWith("390") && (!r.overflow || !r.overflow.ok || r.status !== "ok"));
console.log("MOBILE_FAILS", mobileFails.length);
console.log(JSON.stringify(mobileFails, null, 2));
