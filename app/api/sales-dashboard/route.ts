import { NextResponse } from "next/server";
import { authorizeSalesDashboardRequest } from "@/lib/sales-dashboard/kiosk-auth";
import {
  forceRefreshSalesDashboard,
  getSalesDashboardSnapshot,
} from "@/lib/sales-dashboard/snapshot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const allowed = await authorizeSalesDashboardRequest(request);
  if (!allowed) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 401 });
  }

  const force =
    new URL(request.url).searchParams.get("force") === "1" ||
    new URL(request.url).searchParams.get("force") === "true";
  const data = force
    ? await forceRefreshSalesDashboard()
    : await getSalesDashboardSnapshot();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
