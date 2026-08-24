import { NextResponse } from "next/server";
import { authorizeSalesDashboardRequest } from "@/lib/sales-dashboard/kiosk-auth";
import { getSalesDashboardSnapshot } from "@/lib/sales-dashboard/snapshot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const allowed = await authorizeSalesDashboardRequest(request);
  if (!allowed) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 401 });
  }

  const data = await getSalesDashboardSnapshot();
  return NextResponse.json(data);
}
