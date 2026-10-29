import {
  assignOperatingBrand,
  matchesOperatingBrand,
  type OperatingBrandId,
} from "@/lib/finance/operating-brand";
import { parsePremiumCell } from "@/lib/sales-dashboard/workbook-grid";

/**
 * Liba's sales report and Excel keep every row, including Shemesh.
 * Dashboards, campaigns, finance, leads, and expenses use productionsForLibaKpi.
 */
export function includeInLibaSalesReport(row: {
  agent?: string | null;
  source?: string | null;
}): boolean {
  void row.agent;
  void row.source;
  return true;
}

export function productionsForSalesReport<
  T extends { agent?: string | null; source?: string | null },
>(rows: T[]): T[] {
  return rows.filter((row) => includeInLibaSalesReport(row));
}

export function productionsForLibaKpi<
  T extends { agent?: string | null; source?: string | null },
>(
  rows: T[],
  scope: { brand: OperatingBrandId; shemeshEmployeeNames?: Iterable<string> },
): T[] {
  if (scope.brand === "all") return rows;
  return rows.filter((row) =>
    matchesOperatingBrand(
      assignOperatingBrand({
        agent: row.agent,
        source: row.source,
        shemeshEmployeeNames: scope.shemeshEmployeeNames,
      }),
      scope.brand,
    ),
  );
}

export function salesReportPremium(
  rows: { agent?: string | null; source?: string | null; premium: number }[],
): number {
  return productionsForSalesReport(rows).reduce((sum, row) => sum + row.premium, 0);
}

export function salesExcelPremium(
  rows: { cells: string[] }[],
  premiumCol: number,
  agentCol: number,
  sourceCol: number,
): number {
  return rows
    .filter((row) =>
      includeInLibaSalesReport({
        agent: agentCol >= 0 ? row.cells[agentCol] : "",
        source: sourceCol >= 0 ? row.cells[sourceCol] : "",
      }),
    )
    .reduce((sum, row) => sum + parsePremiumCell(premiumCol >= 0 ? row.cells[premiumCol] ?? "" : ""), 0);
}

export function assertShemeshRowStaysInLibaSalesReport(): void {
  const peer = { agent: "ניב קובי", source: "שיחות נכנסות", premium: 1000 };
  const shemesh = { agent: "שמש", source: "קמפיין שמש", premium: 800 };
  const shemeshEmployee = { agent: "שי בר און", source: "לידים קרים", premium: 400 };
  const lines = [peer, shemesh, shemeshEmployee];
  const names = ["שי בר און"];

  if (assignOperatingBrand(shemesh) !== "shemesh") {
    throw new Error("קמפיין שמש should be the Shemesh row the separation filter would drop");
  }
  if (assignOperatingBrand({ ...shemeshEmployee, shemeshEmployeeNames: names }) !== "shemesh") {
    throw new Error("listed Shemesh employee should be Shemesh for KPIs");
  }
  if (assignOperatingBrand(peer) !== "liba") {
    throw new Error("peer row should stay Liba");
  }

  const report = productionsForSalesReport(lines);
  if (report.length !== lines.length) {
    throw new Error("Liba sales report dropped a row");
  }
  const kept = report.find((row) => row.agent === "שמש" && row.source === "קמפיין שמש");
  const keptPeer = report.find((row) => row.agent === "ניב קובי");
  if (!kept || !keptPeer) throw new Error("Shemesh sales row missing from Liba sales report");
  if (Object.keys(kept).join(",") !== Object.keys(keptPeer).join(",")) {
    throw new Error("Shemesh must stay in the sales report like any עצמאי, with the same columns");
  }
  if (kept.premium !== 800 || keptPeer.premium !== 1000) {
    throw new Error("Shemesh premium was not kept with the same calculation");
  }
  if (salesReportPremium(lines) !== 2200) {
    throw new Error(`sales report premium should include Shemesh, got ${salesReportPremium(lines)}`);
  }

  const kpi = productionsForLibaKpi(lines, { brand: "liba", shemeshEmployeeNames: names });
  if (kpi.some((row) => row.source === "קמפיין שמש" || row.agent === "שי בר און")) {
    throw new Error("Liba KPI should exclude Shemesh-internal rows");
  }
  if (!kpi.some((row) => row.agent === "ניב קובי") || salesReportPremium(kpi) !== 1000) {
    throw new Error("Liba KPI should keep the other agent");
  }

  const headers = ["משווק", "מקור", "פרמיה"];
  const excelRows = lines.map((row, index) => ({
    id: String(index),
    cells: [row.agent, row.source, String(row.premium)],
  }));
  if (excelRows.some((row) => row.cells.length !== headers.length)) {
    throw new Error("Excel rows must share columns");
  }
  const excelPremium = salesExcelPremium(excelRows, 2, 0, 1);
  if (excelPremium !== 2200) {
    throw new Error(`Excel premium should include Shemesh, got ${excelPremium}`);
  }
}

assertShemeshRowStaysInLibaSalesReport();
