import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingRelation } from "@/lib/shemesh/db";
import {
  EMPTY_FEE_SETTINGS,
  deadlineFromSla,
  feeForKind,
  rateOrNull,
  slaOverdue,
  type FeeSettings,
} from "@/lib/shemesh/fees";
import { CASE_STAGES } from "@/lib/shemesh/catalog";

export type DeskKind = "cases" | "ledger" | "rules";

export type DeskRow = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  amount: number | null;
  when: string;
  assignee: string;
  overdue: boolean;
  kind?: string;
};

export type DeskPayload = {
  missing: boolean;
  error: string | null;
  rows: DeskRow[];
  settings: FeeSettings;
  audit: { id: string; summary: string; createdAt: string }[];
};

const LEDGER_KIND = new Set(["redemption", "tax_refund"]);
const RULE_KIND = new Set(["cost", "debt", "income", "payroll", "commission"]);
const CASE_STATUS = new Set(["open", "waiting", "done", "cancelled"]);
const STAGE_IDS = new Set<string>(CASE_STAGES.map((stage) => stage.id));

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function loadFeeSettings(): Promise<{ settings: FeeSettings; missing: boolean }> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("shemesh_fee_settings").select("*").eq("id", 1).maybeSingle();
    if (error) {
      if (isMissingRelation(error.message)) return { settings: EMPTY_FEE_SETTINGS, missing: true };
      return { settings: EMPTY_FEE_SETTINGS, missing: false };
    }
    return {
      missing: false,
      settings: {
        redemptionFeeRate: rateOrNull(data?.redemption_fee_rate),
        taxFeeRate: rateOrNull(data?.tax_fee_rate),
        vatRate: rateOrNull(data?.vat_rate),
        slaDays: data?.sla_days == null ? null : Number(data.sla_days),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (isMissingRelation(message) || /missing supabase|missing next_public/i.test(message)) {
      return { settings: EMPTY_FEE_SETTINGS, missing: true };
    }
    return { settings: EMPTY_FEE_SETTINGS, missing: false };
  }
}

async function loadAudit(): Promise<DeskPayload["audit"]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("shemesh_audit")
      .select("id, summary, created_at")
      .order("created_at", { ascending: false })
      .limit(12);
    if (error || !data) return [];
    return data.map((row) => ({
      id: String(row.id),
      summary: text(row.summary),
      createdAt: text(row.created_at),
    }));
  } catch {
    return [];
  }
}

export async function writeAudit(actor: string, action: string, entity: string, entityId: string, summary: string) {
  try {
    const admin = createAdminClient();
    await admin.from("shemesh_audit").insert({
      actor,
      action,
      entity,
      entity_id: entityId,
      summary: summary.slice(0, 400),
    });
  } catch {
    // Audit must not block the change. A missing table is reported by the screen.
  }
}

export async function loadDesk(kind: DeskKind, filterKind?: string): Promise<DeskPayload> {
  const fees = await loadFeeSettings();
  const empty: DeskPayload = { missing: fees.missing, error: null, rows: [], settings: fees.settings, audit: [] };
  try {
    const admin = createAdminClient();
    if (kind === "cases") {
      const { data, error } = await admin.from("shemesh_cases").select("*").order("updated_at", { ascending: false }).limit(400);
      if (error) {
        if (isMissingRelation(error.message)) return { ...empty, missing: true };
        return { ...empty, error: error.message };
      }
      const today = todayIso();
      return {
        ...empty,
        missing: false,
        audit: await loadAudit(),
        rows: (data ?? []).map((row) => ({
          id: String(row.id),
          title: text(row.client_name),
          subtitle: `${text(row.stage)} · ${text(row.phone)}`,
          status: text(row.status) || "open",
          amount: null,
          when: text(row.deadline) || text(row.opened_on),
          assignee: text(row.handler),
          overdue: slaOverdue(text(row.deadline) || null, text(row.status), today),
          kind: text(row.stage),
        })),
      };
    }
    if (kind === "ledger") {
      let query = admin.from("shemesh_ledger").select("*").order("day", { ascending: false }).limit(400);
      if (filterKind && LEDGER_KIND.has(filterKind)) query = query.eq("kind", filterKind);
      const { data, error } = await query;
      if (error) {
        if (isMissingRelation(error.message)) return { ...empty, missing: true };
        return { ...empty, error: error.message };
      }
      return {
        ...empty,
        missing: false,
        audit: await loadAudit(),
        rows: (data ?? []).map((row) => ({
          id: String(row.id),
          title: text(row.client_name),
          subtitle: row.fee == null ? "בלי שיעור עמלה" : `עמלה ${row.fee} · נטו ${row.net}`,
          status: text(row.status) || "open",
          amount: num(row.gross),
          when: text(row.day),
          assignee: "",
          overdue: false,
          kind: text(row.kind),
        })),
      };
    }
    let query = admin.from("shemesh_rules").select("*").order("updated_at", { ascending: false }).limit(400);
    if (filterKind && RULE_KIND.has(filterKind)) query = query.eq("kind", filterKind);
    const { data, error } = await query;
    if (error) {
      if (isMissingRelation(error.message)) return { ...empty, missing: true };
      return { ...empty, error: error.message };
    }
    return {
      ...empty,
      missing: false,
      audit: await loadAudit(),
      rows: (data ?? []).map((row) => ({
        id: String(row.id),
        title: text(row.title),
        subtitle: `${text(row.cadence)} · ${row.active ? "פעיל" : "כבוי"}`,
        status: row.active ? "open" : "done",
        amount: num(row.amount),
        when: text(row.starts_on),
        assignee: "",
        overdue: false,
        kind: text(row.kind),
      })),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "המסד לא זמין";
    if (isMissingRelation(message) || /missing supabase|missing next_public/i.test(message)) {
      return { ...empty, missing: true };
    }
    return { ...empty, error: message };
  }
}

export function monthLinesFromRules(
  rules: { id: string; kind: string; title: string; amount: number | null; cadence: string; day_of_month: number | null; starts_on: string | null; active: boolean }[],
  month: string,
): { ruleId: string; title: string; amount: number | null; kind: string }[] {
  if (!/^\d{4}-\d{2}$/.test(month)) return [];
  return rules
    .filter((rule) => {
      if (!rule.active) return false;
      if (rule.cadence === "once") return (rule.starts_on ?? "").slice(0, 7) === month;
      if (rule.starts_on && rule.starts_on.slice(0, 7) > month) return false;
      return true;
    })
    .map((rule) => ({ ruleId: rule.id, title: rule.title, amount: rule.amount, kind: rule.kind }));
}

export async function loadMonthView(kind: string, month: string) {
  const desk = await loadDesk("rules", kind);
  if (desk.missing || desk.error) return { ...desk, monthRows: [] as { ruleId: string; title: string; amount: number | null; kind: string }[] };
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("shemesh_rules").select("*").eq("kind", kind);
    if (error) {
      if (isMissingRelation(error.message)) return { ...desk, missing: true, monthRows: [] };
      return { ...desk, error: error.message, monthRows: [] };
    }
    const rules = (data ?? []).map((row) => ({
      id: String(row.id),
      kind: text(row.kind),
      title: text(row.title),
      amount: num(row.amount),
      cadence: text(row.cadence) || "monthly",
      day_of_month: row.day_of_month == null ? null : Number(row.day_of_month),
      starts_on: text(row.starts_on) || null,
      active: Boolean(row.active),
    }));
    return { ...desk, monthRows: monthLinesFromRules(rules, month) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "החודש לא נטען";
    return { ...desk, error: message, monthRows: [] };
  }
}

export function validateCase(input: { clientName: string; stage: string; status: string }) {
  if (!input.clientName.trim()) return "חובה שם לקוח";
  if (!STAGE_IDS.has(input.stage)) return "שלב לא מוכר";
  if (!CASE_STATUS.has(input.status)) return "סטטוס לא מוכר";
  return null;
}

export function validateLedger(input: { clientName: string; kind: string; gross: number }) {
  if (!input.clientName.trim()) return "חובה שם לקוח";
  if (!LEDGER_KIND.has(input.kind)) return "סוג לא מוכר";
  if (!Number.isFinite(input.gross)) return "חובה סכום";
  return null;
}

export function validateRule(input: { title: string; kind: string; amount: number | null }) {
  if (!input.title.trim()) return "חובה כותרת";
  if (!RULE_KIND.has(input.kind)) return "סוג לא מוכר";
  if (input.amount != null && !Number.isFinite(input.amount)) return "סכום לא תקין";
  return null;
}

export async function insertCase(input: {
  clientName: string;
  phone: string;
  stage: string;
  status: string;
  handler: string;
  openedOn: string;
  notes: string;
}, actor: string) {
  const errorText = validateCase(input);
  if (errorText) return { error: errorText };
  const fees = await loadFeeSettings();
  const opened = input.openedOn || todayIso();
  const deadline = deadlineFromSla(opened, fees.settings.slaDays);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("shemesh_cases")
    .insert({
      client_name: input.clientName.trim(),
      phone: input.phone.trim() || null,
      stage: input.stage,
      status: input.status,
      handler: input.handler.trim() || null,
      opened_on: opened,
      deadline,
      notes: input.notes.trim() || null,
    })
    .select("id")
    .single();
  if (error) return { error: isMissingRelation(error.message) ? "הטבלה עדיין לא הורצה" : error.message };
  await writeAudit(actor, "create", "case", String(data.id), input.clientName.trim());
  return { error: null };
}

export async function patchCase(id: string, patch: Record<string, string>, actor: string) {
  const admin = createAdminClient();
  const next: Record<string, string | null> = { updated_at: new Date().toISOString() };
  if (patch.status) {
    if (!CASE_STATUS.has(patch.status)) return { error: "סטטוס לא מוכר" };
    next.status = patch.status;
  }
  if (patch.stage) {
    if (!STAGE_IDS.has(patch.stage)) return { error: "שלב לא מוכר" };
    next.stage = patch.stage;
  }
  if ("handler" in patch) next.handler = patch.handler.trim() || null;
  if ("notes" in patch) next.notes = patch.notes.trim() || null;
  const { error } = await admin.from("shemesh_cases").update(next).eq("id", id);
  if (error) return { error: isMissingRelation(error.message) ? "הטבלה עדיין לא הורצה" : error.message };
  await writeAudit(actor, "update", "case", id, patch.status || patch.stage || patch.handler || "עודכן");
  return { error: null };
}

export async function insertLedger(input: {
  kind: "redemption" | "tax_refund";
  clientName: string;
  day: string;
  gross: number;
  status: string;
  notes: string;
}, actor: string) {
  const errorText = validateLedger(input);
  if (errorText) return { error: errorText };
  if (!CASE_STATUS.has(input.status)) return { error: "סטטוס לא מוכר" };
  const fees = await loadFeeSettings();
  const money = feeForKind(input.kind, input.gross, fees.settings);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("shemesh_ledger")
    .insert({
      kind: input.kind,
      client_name: input.clientName.trim(),
      day: input.day || null,
      gross: input.gross,
      fee_rate: money.rate,
      fee: money.fee,
      net: money.net,
      status: input.status,
      notes: input.notes.trim() || null,
    })
    .select("id")
    .single();
  if (error) return { error: isMissingRelation(error.message) ? "הטבלה עדיין לא הורצה" : error.message };
  await writeAudit(actor, "create", "ledger", String(data.id), `${input.kind} ${input.clientName.trim()}`);
  return { error: null };
}

export async function patchLedgerStatus(id: string, status: string, actor: string) {
  if (!CASE_STATUS.has(status)) return { error: "סטטוס לא מוכר" };
  const admin = createAdminClient();
  const { error } = await admin.from("shemesh_ledger").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: error.message };
  await writeAudit(actor, "status", "ledger", id, status);
  return { error: null };
}

export async function insertRule(input: {
  kind: string;
  title: string;
  amount: number | null;
  cadence: string;
  dayOfMonth: number | null;
  startsOn: string;
  notes: string;
}, actor: string) {
  const errorText = validateRule(input);
  if (errorText) return { error: errorText };
  if (input.cadence !== "monthly" && input.cadence !== "once") return { error: "תדירות לא מוכרת" };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("shemesh_rules")
    .insert({
      kind: input.kind,
      title: input.title.trim(),
      amount: input.amount,
      cadence: input.cadence,
      day_of_month: input.dayOfMonth,
      starts_on: input.startsOn || null,
      notes: input.notes.trim() || null,
    })
    .select("id")
    .single();
  if (error) return { error: isMissingRelation(error.message) ? "הטבלה עדיין לא הורצה" : error.message };
  await writeAudit(actor, "create", "rule", String(data.id), input.title.trim());
  return { error: null };
}

export async function patchRuleActive(id: string, active: boolean, actor: string) {
  const admin = createAdminClient();
  const { error } = await admin.from("shemesh_rules").update({ active, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: error.message };
  await writeAudit(actor, "status", "rule", id, active ? "פעיל" : "כבוי");
  return { error: null };
}

export async function saveFeeSettings(input: FeeSettings, actor: string) {
  const admin = createAdminClient();
  const { error } = await admin.from("shemesh_fee_settings").upsert({
    id: 1,
    redemption_fee_rate: input.redemptionFeeRate,
    tax_fee_rate: input.taxFeeRate,
    vat_rate: input.vatRate,
    sla_days: input.slaDays,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: isMissingRelation(error.message) ? "הטבלה עדיין לא הורצה" : error.message };
  await writeAudit(actor, "update", "fee_settings", "1", "עודכנו שיעורי עמלה");
  return { error: null };
}

export async function addCaseChild(
  kind: "task" | "document" | "note",
  input: { caseId: string; title: string; assignee: string; dueOn: string; body: string },
  actor: string,
) {
  if (!input.caseId) return { error: "חסר תיק" };
  const admin = createAdminClient();
  if (kind === "note") {
    if (!input.body.trim()) return { error: "חובה הערה" };
    const { error } = await admin.from("shemesh_case_notes").insert({
      case_id: input.caseId,
      body: input.body.trim(),
      author: actor,
    });
    if (error) return { error: error.message };
  } else if (kind === "task") {
    if (!input.title.trim()) return { error: "חובה משימה" };
    const { error } = await admin.from("shemesh_case_tasks").insert({
      case_id: input.caseId,
      title: input.title.trim(),
      assignee: input.assignee.trim() || null,
      due_on: input.dueOn || null,
    });
    if (error) return { error: error.message };
  } else {
    if (!input.title.trim()) return { error: "חובה שם מסמך" };
    const { error } = await admin.from("shemesh_case_documents").insert({
      case_id: input.caseId,
      label: input.title.trim(),
    });
    if (error) return { error: error.message };
  }
  await writeAudit(actor, "create", kind, input.caseId, input.title || input.body);
  return { error: null };
}

export async function loadCaseDetail(caseId: string) {
  const empty = { missing: false, error: null as string | null, tasks: [] as { id: string; title: string; status: string; assignee: string; dueOn: string }[], documents: [] as { id: string; label: string; received: boolean }[], notes: [] as { id: string; body: string; author: string }[] };
  if (!caseId) return empty;
  try {
    const admin = createAdminClient();
    const [tasks, documents, notes] = await Promise.all([
      admin.from("shemesh_case_tasks").select("*").eq("case_id", caseId).order("created_at", { ascending: false }),
      admin.from("shemesh_case_documents").select("*").eq("case_id", caseId).order("created_at", { ascending: false }),
      admin.from("shemesh_case_notes").select("*").eq("case_id", caseId).order("created_at", { ascending: false }),
    ]);
    const firstError = tasks.error || documents.error || notes.error;
    if (firstError) {
      if (isMissingRelation(firstError.message)) return { ...empty, missing: true };
      return { ...empty, error: firstError.message };
    }
    return {
      missing: false,
      error: null,
      tasks: (tasks.data ?? []).map((row) => ({
        id: String(row.id),
        title: text(row.title),
        status: text(row.status),
        assignee: text(row.assignee),
        dueOn: text(row.due_on),
      })),
      documents: (documents.data ?? []).map((row) => ({
        id: String(row.id),
        label: text(row.label),
        received: Boolean(row.received),
      })),
      notes: (notes.data ?? []).map((row) => ({
        id: String(row.id),
        body: text(row.body),
        author: text(row.author),
      })),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "התיק לא נטען";
    if (isMissingRelation(message)) return { ...empty, missing: true };
    return { ...empty, error: message };
  }
}
