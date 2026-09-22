"use server";

import { revalidatePath } from "next/cache";
import { requireEmployeesAccess } from "@/lib/auth";
import type { AlexanderUnproducedRow } from "@/lib/employees/lead-costs";
import { createAdminClient } from "@/lib/supabase/admin";

function monthKey(value: string): string | null {
  const match = value.trim().match(/^(\d{4}-\d{2})/);
  return match?.[1] ?? null;
}

export async function listAlexanderUnproducedLeads(employeeId?: string): Promise<{
  error: string | null;
  rows: AlexanderUnproducedRow[];
}> {
  await requireEmployeesAccess();
  const admin = createAdminClient();
  let query = admin
    .from("finance_alexander_unproduced_leads")
    .select("employee_id, month, leads")
    .order("month", { ascending: false });
  if (employeeId) query = query.eq("employee_id", employeeId);
  const { data, error } = await query;
  if (error) {
    if (/does not exist/i.test(error.message) || /schema cache/i.test(error.message)) {
      return { error: null, rows: [] };
    }
    return { error: error.message, rows: [] };
  }
  return {
    error: null,
    rows: (data ?? []).map((row) => ({
      employeeId: String(row.employee_id),
      month: String(row.month),
      leads: Math.max(0, Math.round(Number(row.leads) || 0)),
    })),
  };
}

export async function saveAlexanderUnproducedLeads(input: {
  employeeId: string;
  month: string;
  leads: number;
}): Promise<{ error: string | null }> {
  await requireEmployeesAccess();
  const month = monthKey(input.month);
  if (!input.employeeId || !month) return { error: "חסרים עובד או חודש" };
  const leads = Math.max(0, Math.round(Number(input.leads) || 0));
  const admin = createAdminClient();
  const { error } = await admin.from("finance_alexander_unproduced_leads").upsert(
    {
      employee_id: input.employeeId,
      month,
      leads,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "employee_id,month" },
  );
  if (error) return { error: error.message };
  revalidatePath("/employees");
  revalidatePath("/employees/payroll");
  return { error: null };
}
