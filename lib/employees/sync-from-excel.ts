import { revalidatePath } from "next/cache";
import { emptyPayContract } from "@/lib/employees/contract";
import {
  collectExcelSellerNames,
  excelAgentKey,
  waitCircleForImportedSeller,
  type SellerHint,
} from "@/lib/employees/excel-sellers";
import { getSalesDashboardSnapshot } from "@/lib/sales-dashboard/snapshot";
import { createAdminClient } from "@/lib/supabase/admin";

export async function applyExcelEmployeeCatalog(sellers: SellerHint[] = []): Promise<{
  error: string | null;
  added: number;
  found: number;
}> {
  const admin = createAdminClient();
  const [list, snapshot] = await Promise.all([
    admin.from("finance_employees").select("id, full_name"),
    getSalesDashboardSnapshot().catch(() => null),
  ]);
  if (list.error) return { error: list.error.message, added: 0, found: 0 };

  const existingRows = list.data ?? [];
  const existingByKey = new Map(
    existingRows.map((row) => [excelAgentKey(String(row.full_name)), row] as const),
  );
  const names = collectExcelSellerNames(snapshot, sellers);
  const excelKeys = new Set(names.map((name) => excelAgentKey(name)));
  const toAdd = names.filter((name) => !existingByKey.has(excelAgentKey(name)));
  const toRename = names.filter((name) => {
    const row = existingByKey.get(excelAgentKey(name));
    return row && String(row.full_name) !== name;
  });
  const toRemove =
    snapshot?.source === "live" && names.length >= 8
      ? existingRows.filter((row) => !excelKeys.has(excelAgentKey(String(row.full_name))))
      : [];

  if (toAdd.length === 0 && toRename.length === 0 && toRemove.length === 0) {
    return { error: null, added: 0, found: names.length };
  }

  if (toAdd.length > 0) {
    const { error } = await admin.from("finance_employees").insert(
      toAdd.map((full_name) => ({
        full_name,
        department: "מכירות",
        wait_circle: waitCircleForImportedSeller(full_name),
        pay_contract: emptyPayContract(),
      })),
    );
    if (error) return { error: error.message, added: 0, found: names.length };
  }

  for (const name of toRename) {
    const row = existingByKey.get(excelAgentKey(name));
    if (!row) continue;
    await admin
      .from("finance_employees")
      .update({ full_name: name, updated_at: new Date().toISOString() })
      .eq("id", row.id);
  }

  if (toRemove.length > 0) {
    const { error } = await admin
      .from("finance_employees")
      .delete()
      .in(
        "id",
        toRemove.map((row) => row.id),
      );
    if (error) return { error: error.message, added: toAdd.length, found: names.length };
  }
  revalidatePath("/employees");
  revalidatePath("/finance");
  return { error: null, added: toAdd.length, found: names.length };
}
