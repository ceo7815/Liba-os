import assert from "node:assert/strict";
import test from "node:test";
import { buildControlCenterSnapshot } from "@/lib/sales-dashboard/control-center";
import {
  buildGoldenSalesWorkbook,
  buildMissingPremiumWorkbook,
} from "@/lib/sales-dashboard/golden-workbook";
import { parseSalesWorkbook } from "@/lib/sales-dashboard/parse";
import { missingPremiumColumnWarnings } from "@/lib/sales-dashboard/workbook-grid";
import golden from "@/lib/sales-dashboard/golden-sales-snapshot.json";

const SYNCED_AT = "2026-03-20T08:00:00.000Z";
const NOW = new Date("2026-03-20T12:00:00.000Z");
const FILE = "דוח-מנהלים-סינתטי.xlsx";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

test("parse and control-center snapshot match the 4cce0b1 golden workbook", () => {
  const parsed = parseSalesWorkbook(buildGoldenSalesWorkbook(), FILE, SYNCED_AT);
  const snapshot = buildControlCenterSnapshot(parsed, NOW);
  assert.deepEqual(canonical({ parsed, snapshot }), canonical(golden));
});

test("a sheet headed 64 warns and does not invent premium", () => {
  const healthy = parseSalesWorkbook(buildGoldenSalesWorkbook(), FILE, SYNCED_AT);
  assert.deepEqual(missingPremiumColumnWarnings(healthy.workbook), []);
  assert.equal(healthy.premium, 2000);

  const broken = parseSalesWorkbook(buildMissingPremiumWorkbook(), FILE, SYNCED_AT);
  assert.equal(broken.premium, 0);
  assert.equal(broken.active, healthy.active);
  assert.equal(broken.marketing?.productions.length, healthy.marketing?.productions.length);
  const warnings = missingPremiumColumnWarnings(broken.workbook);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /2026/);
  assert.match(warnings[0], /פרמיה/);
  assert.ok(broken.marketing?.productions.every((row) => row.premium === 0));
});
