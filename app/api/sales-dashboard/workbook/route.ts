import { NextResponse } from "next/server";
import { authorizeSalesDashboardRequest } from "@/lib/sales-dashboard/kiosk-auth";
import { getSalesDashboardSnapshot } from "@/lib/sales-dashboard/snapshot";
import { workbookFromDashboard } from "@/lib/sales-dashboard/workbook-grid";
import { resolveSalesExcelWorkbook } from "@/lib/sales-dashboard/workbook-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" };

export async function GET(request: Request) {
  const allowed = await authorizeSalesDashboardRequest(request);
  if (!allowed) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 401 });
  }

  const snapshot = await getSalesDashboardSnapshot().catch(() => null);
  const workbook = await resolveSalesExcelWorkbook(snapshot);
  if (workbook.sheets.length) {
    return NextResponse.json(workbook, { headers: NO_STORE });
  }

  const fallback = snapshot ? workbookFromDashboard(snapshot) : null;
  return NextResponse.json(
    fallback?.sheets.length
      ? {
          fileName: fallback.fileName,
          sheets: fallback.sheets,
          syncedAt: snapshot?.syncedAt ?? null,
          stored: false,
        }
      : { fileName: null, sheets: [], syncedAt: null, stored: false },
    { headers: NO_STORE },
  );
}
