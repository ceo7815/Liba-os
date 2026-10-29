"use server";

import { revalidatePath } from "next/cache";
import { shemeshCaseActor, shemeshManageActor, shemeshProfile } from "@/lib/shemesh/actor";
import { canViewShemeshPayroll } from "@/lib/permissions/access";
import {
  addCaseChild,
  insertCase,
  insertLedger,
  insertRule,
  loadCaseBoard,
  loadFeeSettings,
  loadRuleKind,
  openQueuedCase,
  patchCase,
  patchLedgerStatus,
  patchRuleActive,
  saveFeeSettings,
  setCaseDocumentReceived,
} from "@/lib/shemesh/ops";
import { rateOrNull } from "@/lib/shemesh/fees";
import { advanceSettlementDraft, createSettlementDraft } from "@/lib/shemesh/settlement-flow";

async function actor() {
  return shemeshManageActor();
}

async function caseActor() {
  return (await shemeshCaseActor())?.name ?? null;
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
  revalidatePath("/shemesh/settlement");
  revalidatePath("/shemesh/alerts");
}

export async function createShemeshCase(_state: { error: string | null }, formData: FormData) {
  const name = await caseActor();
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
      serviceType: String(formData.get("serviceType") ?? ""),
    },
    name,
  );
  if (!result.error) refresh();
  return result;
}

export async function updateShemeshCase(_state: { error: string | null }, formData: FormData) {
  const who = await shemeshCaseActor();
  if (!who) return { error: "אין הרשאה" };
  const id = String(formData.get("id") ?? "");
  if (who.handlerOnly) {
    const visible = await loadCaseBoard(who.handlerOnly);
    if (!visible.cases.some((item) => item.id === id)) return { error: "התיק לא שלך" };
  }
  const name = who.name;
  if (!id) return { error: "חסר תיק" };
  const patch: Record<string, string> = {};
  for (const key of ["status", "stage", "handler", "notes", "serviceType"] as const) {
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
  const profile = await shemeshProfile();
  const kind = String(formData.get("kind") ?? "");
  if (kind === "payroll" && !canViewShemeshPayroll(profile)) return { error: "שכר פתוח רק לכספים" };
  if (kind !== "payroll" && !profile) return { error: "אין הרשאה" };
  const name = kind === "payroll" ? (profile?.full_name || profile?.email || profile?.id || null) : await actor();
  if (kind !== "payroll" && !name) return { error: "אין הרשאה" };
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
  const profile = await shemeshProfile();
  const id = String(formData.get("id") ?? "");
  const kind = await loadRuleKind(id);
  if (kind === "payroll" && !canViewShemeshPayroll(profile)) return { error: "שכר פתוח רק לכספים" };
  const name = kind === "payroll"
    ? (canViewShemeshPayroll(profile) ? profile?.full_name || profile?.email || profile?.id || null : null)
    : await actor();
  if (!name) return { error: "אין הרשאה" };
  const status = String(formData.get("status") ?? "");
  const result = await patchRuleActive(id, status === "open" || status === "waiting", name);
  if (!result.error) refresh();
  return result;
}

export async function saveShemeshFees(_state: { error: string | null }, formData: FormData) {
  const name = await actor();
  if (!name) return { error: "אין הרשאה" };
  const current = (await loadFeeSettings()).settings;
  const slaRaw = String(formData.get("slaDays") ?? "");
  const multiplierRaw = formData.has("feeMultiplier") ? String(formData.get("feeMultiplier") ?? "") : null;
  const redemptionFeeRate = formData.has("redemptionFeeRate") ? rateOrNull(formData.get("redemptionFeeRate")) : current.redemptionFeeRate;
  const taxFeeRate = formData.has("taxFeeRate") ? rateOrNull(formData.get("taxFeeRate")) : current.taxFeeRate;
  const result = await saveFeeSettings(
    {
      redemptionFeeRate,
      taxFeeRate,
      vatRate: formData.has("vatRate") ? rateOrNull(formData.get("vatRate")) : current.vatRate,
      slaDays: formData.has("slaDays") ? (slaRaw === "" ? null : Number(slaRaw)) : current.slaDays,
      successFeeRates: { ...current.successFeeRates, redemption: redemptionFeeRate, tax_refund: taxFeeRate },
      ratesPending: formData.get("ratesPendingTouched") === "1" ? formData.get("ratesPending") === "on" : current.ratesPending,
      feeMultiplier: multiplierRaw == null ? current.feeMultiplier : (multiplierRaw === "" ? null : Number(multiplierRaw)),
      multiplierPending: formData.get("multiplierTouched") === "1" ? formData.get("multiplierPending") === "on" : current.multiplierPending,
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

export async function openQueuedCaseForm(formData: FormData) {
  const name = await caseActor();
  if (!name) return;
  await openQueuedCase(String(formData.get("id") ?? ""), name);
  refresh();
  revalidatePath("/shemesh");
  revalidatePath("/shemesh/gviya");
  revalidatePath("/shemesh/agency");
}

export async function setShemeshDocumentForm(formData: FormData) {
  const name = await caseActor();
  if (!name) return;
  const state = String(formData.get("state") ?? "");
  await setCaseDocumentReceived(String(formData.get("id") ?? ""), state === "received" || String(formData.get("received") ?? "") === "true", name, state);
  refresh();
}

export async function createShemeshCaseChild(_state: { error: string | null }, formData: FormData) {
  const name = await caseActor();
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

export async function createShemeshSettlementDraft(state: { error: string | null }, formData: FormData): Promise<{ error: string | null }> {
  void state;
  void formData;
  const name = await actor();
  if (!name) return { error: "אין הרשאה" };
  const result = await createSettlementDraft(name);
  if (!result.error) refresh();
  return result;
}

export async function advanceShemeshSettlement(_state: { error: string | null }, formData: FormData): Promise<{ error: string | null }> {
  const name = await actor();
  if (!name) return { error: "אין הרשאה" };
  const result = await advanceSettlementDraft(String(formData.get("id") ?? ""), String(formData.get("next") ?? ""));
  if (!result.error) refresh();
  return result;
}
