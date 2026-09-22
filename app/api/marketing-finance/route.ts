import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { canAccessSourcePnl } from "@/lib/finance/access";
import { canAccessSalesDashboard } from "@/lib/sales-dashboard/access";
import { readMarketingFinanceBundle } from "@/lib/sales-dashboard/marketing-finance-bundle";
import type { DateRange } from "@/lib/sales-dashboard/campaign-math";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  const canPnl = Boolean(profile && canAccessSourcePnl(profile));
  const canSales = Boolean(profile && canAccessSalesDashboard(profile));
  if (!profile || (!canPnl && !canSales)) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 401 });
  }

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const range: DateRange | undefined =
    from || to
      ? { from: from || null, to: to || null }
      : undefined;

  const data = await readMarketingFinanceBundle(range);
  const body = canPnl
    ? data
    : {
        ...data,
        payProfiles: [],
        rates: [],
        expenses: [],
        flags: [],
      };
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
