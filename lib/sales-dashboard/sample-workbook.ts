/**
 * Smoke-check that Hebrew Excel headers parse into dashboard KPIs.
 * Run: node --import tsx/esm  is not required; invoked from tsc-checked parse via next build.
 */
import { COL, PROCESS, STATUS, sourcePnlKindForProcess } from "@/lib/sales-dashboard/columns";
import { parseSalesWorkbook } from "@/lib/sales-dashboard/parse";
import { assertOperatingBrandRules } from "@/lib/finance/operating-brand";
import { assertContractWagesDoNotMix } from "@/lib/employees/contract";
import { assertHoursWorkbookParses } from "@/lib/employees/hours";
import { assertPayrollLedgerSplits } from "@/lib/employees/payroll";
import { assertReviewTiersReset, assertSplitEmploymentMonths } from "@/lib/employees/review";
import * as XLSX from "xlsx";

export function buildSampleSalesWorkbook(): Uint8Array {
  const rows = [
    {
      [COL.status]: STATUS.active,
      [COL.premium]: 1000,
      [COL.process]: PROCESS.sale,
      [COL.transferDate]: new Date(2026, 2, 12),
      [COL.startDate]: new Date(2026, 3, 1),
      [COL.client]: "לקוח א",
      [COL.agent]: "ניב קובי",
      [COL.product]: "בריאות",
      [COL.company]: "מגדל",
      [COL.source]: "שיחות נכנסות",
    },
    {
      [COL.status]: STATUS.pending,
      [COL.premium]: 500,
      [COL.process]: PROCESS.appointment,
      [COL.transferDate]: new Date(2026, 2, 15),
      [COL.startDate]: new Date(2026, 3, 1),
      [COL.client]: "לקוח ב",
      [COL.agent]: "שמש",
      [COL.product]: "משכנתא",
      [COL.company]: "הראל",
      [COL.source]: "לקוחות ליבה",
    },
    {
      [COL.status]: STATUS.cancelled,
      [COL.premium]: 200,
      [COL.process]: PROCESS.sale,
      [COL.transferDate]: new Date(2026, 1, 2),
      [COL.startDate]: new Date(2026, 2, 1),
      [COL.client]: "לקוח ג",
      [COL.agent]: "אסף בר און",
      [COL.product]: "תאונות",
      [COL.company]: "מגדל",
      [COL.source]: "לידים קרים",
    },
  ];

  const sheet = XLSX.utils.json_to_sheet(rows);
  const helper = XLSX.utils.aoa_to_sheet([
    ["מכירה", "שיחות נכנסות", "ניב קובי"],
    ["מינוי", "לקוחות ליבה", "שמש"],
    ["", "לידים קרים", "אסף בר און"],
    ["", "התפתחות מגדל", "נתן יוסיפוב"],
    ["", "התפתחות כללי", "בן סגל"],
    ["", "", "טופז - סגל"],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Report");
  XLSX.utils.book_append_sheet(wb, helper, "טבלת עזר");
  sheet["!ref"] = "A1:T1048576";
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;
}

export function assertSampleWorkbookParses() {
  assertOperatingBrandRules();
  const parsed = parseSalesWorkbook(buildSampleSalesWorkbook(), "sample.xlsx");
  if (parsed.active !== 1) throw new Error(`expected 1 active, got ${parsed.active}`);
  if (parsed.pending !== 1) throw new Error(`expected 1 pending, got ${parsed.pending}`);
  if (parsed.issues !== 1) throw new Error(`expected 1 issue, got ${parsed.issues}`);
  if (parsed.premium !== 1000) throw new Error(`expected premium 1000, got ${parsed.premium}`);
  if (parsed.agents[0]?.name !== "ניב קובי") {
    throw new Error("expected leaderboard to start with ניב קובי");
  }
  if (!parsed.marketing) throw new Error("expected marketing overview");
  if (parsed.marketing.activePremium !== 1000) {
    throw new Error(`expected marketing premium 1000, got ${parsed.marketing.activePremium}`);
  }
  if (parsed.marketing.pendingPremium !== 500) {
    throw new Error(`expected pending premium 500, got ${parsed.marketing.pendingPremium}`);
  }
  if (parsed.marketing.cancelledPremium !== 200) {
    throw new Error(`expected cancelled premium 200, got ${parsed.marketing.cancelledPremium}`);
  }
  if (parsed.marketing.productions.length !== 3) {
    throw new Error(`expected 3 productions, got ${parsed.marketing.productions.length}`);
  }
  if (!(parsed.marketing.excelHeaders ?? []).includes(COL.source)) {
    throw new Error("expected Excel source header in catalog");
  }
  if (sourcePnlKindForProcess("מכירה") !== "volume") {
    throw new Error("expected מכירה to map to volume");
  }
  if (sourcePnlKindForProcess("מינוי סוכן") !== "settled") {
    throw new Error("expected מינוי סוכן to map to settled");
  }
  if (sourcePnlKindForProcess(PROCESS.appointment) !== "settled") {
    throw new Error("expected מינוי to map to settled");
  }
  const volumeRows = parsed.marketing.productions.filter(
    (row) => sourcePnlKindForProcess(row.process) === "volume",
  );
  const settledRows = parsed.marketing.productions.filter(
    (row) => sourcePnlKindForProcess(row.process) === "settled",
  );
  if (volumeRows.length !== 2) {
    throw new Error(`expected 2 volume productions, got ${volumeRows.length}`);
  }
  if (settledRows.length !== 1) {
    throw new Error(`expected 1 settled production, got ${settledRows.length}`);
  }
  const catalog = parsed.marketing.sourceCatalog ?? [];
  if (!catalog.includes("התפתחות מגדל") || !catalog.includes("התפתחות כללי")) {
    throw new Error(`expected helper-table sources, got ${catalog.join(", ")}`);
  }
  const sellers = parsed.marketing.sellerCatalog ?? [];
  for (const name of ["ניב קובי", "שמש", "אסף בר און", "נתן יוסיפוב", "בן סגל", "טופז - סגל"]) {
    if (!sellers.includes(name)) {
      throw new Error(`expected seller ${name} in catalog, got ${sellers.join(", ")}`);
    }
  }
  assertNewSourcesParse();
  assertContractWagesDoNotMix();
  assertHoursWorkbookParses();
  assertPayrollLedgerSplits();
  assertReviewTiersReset();
  assertSplitEmploymentMonths();
  return parsed;
}

function buildNewSourcesWorkbook(): Uint8Array {
  const aoa = [
    ["דוח מנהלים", "", "", "", "", "", "", "", "", ""],
    [
      COL.status,
      COL.premium,
      COL.process,
      COL.transferDate,
      COL.startDate,
      COL.client,
      COL.agent,
      COL.product,
      COL.company,
      "מקור הפניה",
    ],
    [
      "פעיל",
      800,
      PROCESS.sale,
      "15/08/2026",
      "01/09/2026",
      "לקוח ד",
      "ניב קובי",
      "בריאות",
      "מגדל",
      "\u200fמגדל לידים",
    ],
    [
      STATUS.active,
      400,
      PROCESS.sale,
      "31.08.2026",
      "01.09.2026",
      "לקוח ה",
      "שמש",
      "משכנתא",
      "הראל",
      "שתף מגדל",
    ],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const list = XLSX.utils.aoa_to_sheet([
    ["מקור הפנייה"],
    ["מגדל לידים"],
    ["שתף מגדל"],
    ["מקור חדש ריק א"],
    ["מקור חדש ריק ב"],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Report");
  XLSX.utils.book_append_sheet(wb, list, "מקורות");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;
}

function assertNewSourcesParse() {
  const parsed = parseSalesWorkbook(buildNewSourcesWorkbook(), "new-sources.xlsx");
  const names = (parsed.marketing?.sourceCatalog ?? []).sort();
  if (!names.includes("מגדל לידים") || !names.includes("שתף מגדל")) {
    throw new Error(`expected new Excel sources, got ${names.join(", ")}`);
  }
  if (!names.includes("מקור חדש ריק א") || !names.includes("מקור חדש ריק ב")) {
    throw new Error(`expected empty dropdown sources, got ${names.join(", ")}`);
  }
  const productions = parsed.marketing?.productions ?? [];
  if (productions.length !== 2) {
    throw new Error(`expected 2 productions from new sources, got ${productions.length}`);
  }
  if (productions.some((row) => row.transferDate === "—" || !row.transferDate.startsWith("2026-08"))) {
    throw new Error(
      `expected Israeli transfer dates, got ${productions.map((row) => row.transferDate).join(", ")}`,
    );
  }
  if (!productions[0]?.fields?.[COL.client]) {
    throw new Error("expected Excel fields on new source rows");
  }
}
