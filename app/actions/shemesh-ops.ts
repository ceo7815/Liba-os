"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { canManageShemesh } from "@/lib/permissions/access";
import {
  addCaseChild,
  insertCase,
  insertLedger,
  insertRule,
  patchCase,
  patchLedgerStatus,
  patchRuleActive,
  saveFeeSettings,
} from "@/lib/shemesh/ops";
import { rateOrNull } from "@/lib/shemesh/fees";

async function actor() {
  const profile = await getCurrentProfile();
  if (!profile || !canManageShemesh(profile)) return null;
  return profile.full_name || profile.email || profile.id;
}

function refresh() {
  revalidatePath("/shemesh/cases");
  revalidatePath("/shemesh/gviya");
  revalidatePath("/shemesh/tax-refunds");
  revalidatePath("/shemesh/costs");
  revalidatePath("/shemesh/payroll");
  revalidatePath("/shemesh/commissions");
  revalidatePath("/shemesh/debts");
  revalidatePath("/shemesh/income");
}

export async function createShemeshCase(_state: { error: string | null }, formData: FormData) {
  const name = await actor();
  if (!name) return { error: "אין הרשאה" };
  const result = await insertCase(
    {
      clientName: String(formData.get("clientName") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      stage: String(formData.get("stage") ?? "lead"),
      status: String(formData.get("status") ?? "open"),
      handler: String(formData.get("handler") ?? ""),
      openedOn: String(formData.get("openedOn") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    },
    name,
  );
  if (!result.error) refresh();
  return result;
}

export async function updateShemeshCase(_state: { error: string | null }, formData: FormData) {
  const name = await actor();
  if (!name) return { error: "אין הרשאה" };
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "חסר תיק" };
  const patch: Record<string, string> = {};
  for (const key of ["status", "stage", "handler", "notes"] as const) {
    const value = formData.get(key);
    if (typeof value === "string") patch[key] = value;
  }
  const result = await patchCase(id, patch, name);
  if (!result.error) refresh();
  return result;
}

export async function createShemeshLedger(_state: { error: string | null }, formData: FormData) {
  const name = await actor();
  if (!name) return { error: "אין הרשאה" };
  const kind = String(formData.get("kind") ?? "");
  if (kind !== "redemption" && kind !== "tax_refund") return { error: "סוג לא מוכר" };
  const result = await insertLedger(
    {
      kind,
      clientName: String(formData.get("clientName") ?? ""),
      day: String(formData.get("day") ?? ""),
      gross: Number(formData.get("gross")),
      status: String(formData.get("status") ?? "open"),
      notes: String(formData.get("notes") ?? ""),
    },
    name,
  );
  if (!result.error) refresh();
  return result;
}

export async function setShemeshLedgerStatus(_state: { error: string | null }, formData: FormData) {
  const name = await actor();
  if (!name) return { error: "אין הרשאה" };
  const result = await patchLedgerStatus(String(formData.get("id") ?? ""), String(formData.get("status") ?? ""), name);
  if (!result.error) refresh();
  return result;
}

export async function createShemeshRule(_state: { error: string | null }, formData: FormData) {
  const name = await actor();
  if (!name) return { error: "אין הרשאה" };
  const amountRaw = String(formData.get("amount") ?? "");
  const dayRaw = String(formData.get("dayOfMonth") ?? "");
  const result = await insertRule(
    {
      kind: String(formData.get("kind") ?? ""),
      title: String(formData.get("title") ?? ""),
      amount: amountRaw === "" ? null : Number(amountRaw),
      cadence: String(formData.get("cadence") ?? "monthly"),
      dayOfMonth: dayRaw === "" ? null : Number(dayRaw),
      startsOn: String(formData.get("startsOn") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    },
    name,
  );
  if (!result.error) refresh();
  return result;
}

export async function setShemeshRuleActive(_state: { error: string | null }, formData: FormData) {
  const name = await actor();
  if (!name) return { error: "אין הרשאה" };
  const status = String(formData.get("status") ?? "");
  const result = await patchRuleActive(String(formData.get("id") ?? ""), status === "open" || status === "waiting", name);
  if (!result.error) refresh();
  return result;
}

export async function saveShemeshFees(_state: { error: string | null }, formData: FormData) {
  const name = await actor();
  if (!name) return { error: "אין הרשאה" };
  const slaRaw = String(formData.get("slaDays") ?? "");
  const result = await saveFeeSettings(
    {
      redemptionFeeRate: rateOrNull(formData.get("redemptionFeeRate")),
      taxFeeRate: rateOrNull(formData.get("taxFeeRate")),
      vatRate: rateOrNull(formData.get("vatRate")),
      slaDays: slaRaw === "" ? null : Number(slaRaw),
    },
    name,
  );
  if (!result.error) refresh();
  return result;
}

export async function saveShemeshFeesForm(formData: FormData) {
  await saveShemeshFees({ error: null }, formData);
}

export async function createShemeshCaseChildForm(formData: FormData) {
  await createShemeshCaseChild({ error: null }, formData);
}

export async function createShemeshCaseChild(_state: { error: string | null }, formData: FormData) {
  const name = await actor();
  if (!name) return { error: "אין הרשאה" };
  const kind = String(formData.get("child") ?? "");
  if (kind !== "task" && kind !== "document" && kind !== "note") return { error: "סוג לא מוכר" };
  const result = await addCaseChild(
    kind,
    {
      caseId: String(formData.get("caseId") ?? ""),
      title: String(formData.get("title") ?? ""),
      assignee: String(formData.get("assignee") ?? ""),
      dueOn: String(formData.get("dueOn") ?? ""),
      body: String(formData.get("body") ?? ""),
    },
    name,
  );
  if (!result.error) refresh();
  return result;
}
