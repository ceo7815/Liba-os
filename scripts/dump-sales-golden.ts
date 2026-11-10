import { buildControlCenterSnapshot } from "@/lib/sales-dashboard/control-center";
import { buildGoldenSalesWorkbook } from "@/lib/sales-dashboard/golden-workbook";
import { parseSalesWorkbook } from "@/lib/sales-dashboard/parse";

const SYNCED_AT = "2026-03-20T08:00:00.000Z";
const NOW = new Date("2026-03-20T12:00:00.000Z");

const parsed = parseSalesWorkbook(buildGoldenSalesWorkbook(), "דוח-מנהלים-סינתטי.xlsx", SYNCED_AT);
const snapshot = buildControlCenterSnapshot(parsed, NOW);
process.stdout.write(JSON.stringify({ parsed, snapshot }));
