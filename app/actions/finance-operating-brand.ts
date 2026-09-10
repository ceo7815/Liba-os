"use server";

import { requireFinanceAccess } from "@/lib/auth";
import { employeeLooksLikeShemesh } from "@/lib/finance/operating-brand";
import { createAdminClient } from "@/lib/supabase/admin";

export async function listShemeshEmployeeNames(): Promise<{
  error: string | null;
  names: string[];
}> {
  await requireFinanceAccess();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("finance_employees")
    .select("full_name, wait_circle, notes, is_active")
    .eq("is_active", true);
  if (error) return { error: error.message, names: [] };
  const names = (data ?? [])
    .filter((row) =>
      employeeLooksLikeShemesh({
        fullName: row.full_name as string | null,
        waitCircle: row.wait_circle as string | null,
        notes: row.notes as string | null,
      }),
    )
    .map((row) => String(row.full_name ?? "").trim())
    .filter(Boolean);
  return { error: null, names };
}
