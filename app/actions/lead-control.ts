"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { LEAD_CONTROL_PATH } from "@/lib/lead-control/rules";
import { syncLeadControlSnapshot } from "@/lib/lead-control/load";
import { canAccessSalesDashboard } from "@/lib/sales-dashboard/access";
import { publicErrorText } from "@/lib/sync-log";

export async function syncLeadControl(): Promise<{ ok: boolean; error?: string; count?: number }> {
  const profile = await requireProfile();
  if (!canAccessSalesDashboard(profile)) return { ok: false, error: "אין הרשאה לסנכרון שורנס" };
  try {
    const snapshot = await syncLeadControlSnapshot();
    revalidatePath(LEAD_CONTROL_PATH);
    return { ok: true, count: snapshot.items.length };
  } catch (error) {
    const message = publicErrorText(
      error instanceof Error ? error.message : "סנכרון שורנס נכשל",
    );
    console.error("[surense-sync] sync failed", { message });
    return { ok: false, error: message };
  }
}
