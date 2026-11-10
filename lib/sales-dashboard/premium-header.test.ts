import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import { COL, PROCESS, STATUS } from "@/lib/sales-dashboard/columns";
import { buildControlCenterSnapshot } from "@/lib/sales-dashboard/control-center";
import {
  buildGoldenSalesWorkbook,
  buildMissingPremiumWorkbook,
} from "@/lib/sales-dashboard/golden-workbook";
import { parseSalesWorkbook } from "@/lib/sales-dashboard/parse";
import {
  missingPremiumColumnWarnings,
  premiumColumnIndex,
  premiumHeaderNotices,
} from "@/lib/sales-dashboard/workbook-grid";
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

test("a sheet headed 64 warns and does not invent premium when the column is not between product and start", () => {
  const healthy = parseSalesWorkbook(buildGoldenSalesWorkbook(), FILE, SYNCED_AT);
  assert.deepEqual(premiumHeaderNotices(healthy.workbook), []);
  assert.equal(healthy.premium, 2000);

  const broken = parseSalesWorkbook(buildMissingPremiumWorkbook(), FILE, SYNCED_AT);
  assert.equal(broken.premium, 0);
  assert.equal(broken.active, healthy.active);
  assert.equal(broken.marketing?.productions.length, healthy.marketing?.productions.length);
  const notices = premiumHeaderNotices(broken.workbook);
  assert.equal(notices.length, 1);
  assert.equal(notices[0]?.kind, "missing");
  assert.match(notices[0]?.message ?? "", /2026/);
  assert.match(missingPremiumColumnWarnings(broken.workbook)[0] ?? "", /נספרת 0/);
  assert.ok(broken.marketing?.productions.every((row) => row.premium === 0));
});

/** Live sheet shape: B transfer date, I product, J premium, K «תחילת ביטוח». */
function liveLayoutWorkbook(premiumHeader: string | number): Uint8Array {
  const headers = [
    "הערות",
    COL.transferDate,
    COL.process,
    COL.client,
    COL.agent,
    COL.company,
    COL.source,
    COL.status,
    COL.product,
    premiumHeader,
    "תחילת ביטוח",
  ];
  const line = (
    premium: number | "",
    client: string,
    agent: string,
    source: string,
  ) => [
    "",
    "2026-03-05",
    PROCESS.sale,
    client,
    agent,
    "הראל",
    source,
    STATUS.active,
    "חיים",
    premium,
    "2026-03-04",
  ];
  const rows = [
    line("", "לקוח א", "ניב קובי", "שיחות נכנסות"),
    line("", "לקוח ב", "ניב קובי", "שיחות נכנסות"),
    line(143, "לקוח ג", "שמש", "קמפיין שמש"),
    line(86, "לקוח ג", "שמש", "קמפיין שמש"),
    line("", "לקוח ה", "ניב - שמש", "לידים קרים"),
    line(143, "לקוח ג", "שמש", "קמפיין שמש"),
  ];
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "2026");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;
}

function withoutWorkbook(data: ReturnType<typeof parseSalesWorkbook>) {
  const { workbook: _workbook, ...rest } = data;
  return rest;
}

test("header 64 between product and start matches a correctly headed workbook", () => {
  const headed = parseSalesWorkbook(liveLayoutWorkbook(COL.premium), FILE, SYNCED_AT);
  const numbered = parseSalesWorkbook(liveLayoutWorkbook(64), FILE, SYNCED_AT);
  const headedSnap = buildControlCenterSnapshot(headed, NOW);
  const numberedSnap = buildControlCenterSnapshot(numbered, NOW);

  assert.deepEqual(canonical(withoutWorkbook(numbered)), canonical(withoutWorkbook(headed)));
  assert.deepEqual(canonical(numberedSnap), canonical(headedSnap));
  assert.equal(numbered.premium, headed.premium);
  assert.equal(numbered.premium, 229);
  assert.equal(numbered.marketing?.productions.length, headed.marketing?.productions.length);
  assert.equal(numbered.marketing?.productions.length, 5);
  const premiums = (numbered.marketing?.productions ?? []).map((row) => row.premium).sort((a, b) => a - b);
  assert.deepEqual(premiums, [0, 0, 0, 86, 143]);

  const sheet = numbered.workbook?.sheets.find((item) => item.name === "2026");
  assert.ok(sheet);
  assert.equal(sheet.headers[9], "64");
  assert.equal(premiumColumnIndex(sheet.headers), 9);
  const notices = premiumHeaderNotices(numbered.workbook);
  assert.equal(notices.length, 1);
  assert.equal(notices[0]?.kind, "fallback");
  assert.match(notices[0]?.message ?? "", /64/);
  assert.doesNotMatch(notices[0]?.message ?? "", /נספרת 0/);
  assert.deepEqual(premiumHeaderNotices(headed.workbook), []);
});

test("a text column between product and start is not treated as premium", () => {
  const parsed = parseSalesWorkbook(liveLayoutWorkbook("הערות מוצר"), FILE, SYNCED_AT);
  assert.equal(parsed.premium, 0);
  const notices = premiumHeaderNotices(parsed.workbook);
  assert.equal(notices.length, 1);
  assert.equal(notices[0]?.kind, "missing");
});
