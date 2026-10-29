import { asRows, isMissingRelation, shemeshAdmin } from "@/lib/shemesh/db";
import { formatShemeshMoney } from "@/lib/shemesh/format";
import {
  EMPTY_FEE_SETTINGS,
  deadlineFromSla,
  feeForKind,
  rateOrNull,
  slaOverdue,
  type FeeSettings,
} from "@/lib/shemesh/fees";
import { CASE_STAGES } from "@/lib/shemesh/catalog";
import { SERVICE_CHECKLIST, stageMoveAllowed, mapTaxStatus, type ServiceTypeId } from "@/lib/shemesh/lifecycle";

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
const CASE_STATUS = new Set(["open", "waiting", "done", "cancelled", "on_hold"]);
const STAGE_IDS = new Set<string>(CASE_STAGES.map((stage) => stage.id));

function settingsFromRow(data: { redemption_fee_rate?: unknown; tax_fee_rate?: unknown; vat_rate?: unknown; sla_days?: unknown; success_fee_rates?: unknown; rates_pending?: unknown; fee_multiplier?: unknown; multiplier_pending?: unknown } | null): FeeSettings {
  const named = data?.success_fee_rates && typeof data.success_fee_rates === "object" ? data.success_fee_rates as Record<string, unknown> : {};
  const successFeeRates: Record<string, number | null> = {};
  for (const [key, value] of Object.entries(named)) successFeeRates[key] = rateOrNull(value);
  return {
    redemptionFeeRate: rateOrNull(data?.redemption_fee_rate),
    taxFeeRate: rateOrNull(data?.tax_fee_rate),
    vatRate: rateOrNull(data?.vat_rate),
    slaDays: data?.sla_days == null ? null : Number(data.sla_days),
    successFeeRates,
    ratesPending: data?.rates_pending !== false,
    feeMultiplier: data?.fee_multiplier == null || data.fee_multiplier === "" ? null : (Number.isFinite(Number(data.fee_multiplier)) ? Number(data.fee_multiplier) : null),
    multiplierPending: data?.multiplier_pending !== false,
  };
}

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
    const admin = shemeshAdmin();
    const { data, error } = await admin.from("shemesh_fee_settings").select("*").eq("id", 1).maybeSingle();
    if (error) {
      if (isMissingRelation(error.message)) return { settings: EMPTY_FEE_SETTINGS, missing: true };
      return { settings: EMPTY_FEE_SETTINGS, missing: false };
    }
    return {
      missing: false,
      settings: settingsFromRow(data),
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
    const admin = shemeshAdmin();
    const { data, error } = await admin
      .from("shemesh_audit")
      .select("id, summary, created_at")
      .order("created_at", { ascending: false })
      .limit(12);
    if (error || !data) return [];
    return asRows(data).map((row) => ({
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
    const admin = shemeshAdmin();
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
    const admin = shemeshAdmin();
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
        rows: asRows(data).map((row) => ({
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
        rows: asRows(data).map((row) => ({
          id: String(row.id),
          title: text(row.client_name),
          subtitle: row.fee == null ? "בלי שיעור עמלה" : `עמלה ${formatShemeshMoney(num(row.fee))} · נטו ${formatShemeshMoney(num(row.net))}`,
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
      rows: asRows(data).map((row) => ({
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
    const admin = shemeshAdmin();
    const { data, error } = await admin.from("shemesh_rules").select("*").eq("kind", kind);
    if (error) {
      if (isMissingRelation(error.message)) return { ...desk, missing: true, monthRows: [] };
      return { ...desk, error: error.message, monthRows: [] };
    }
    const rules = asRows(data).map((row) => ({
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
  serviceType?: string;
}, actor: string) {
  const errorText = validateCase({ ...input, stage: "lead" });
  if (errorText) return { error: errorText };
  if (input.stage && input.stage !== "lead") return { error: "תיק חדש נפתח כליד. ההתקדמות היא שלב אחד בכל פעם." };
  const serviceType = input.serviceType && input.serviceType in SERVICE_CHECKLIST ? input.serviceType as ServiceTypeId : null;
  const fees = await loadFeeSettings();
  const opened = input.openedOn || todayIso();
  const deadline = deadlineFromSla(opened, fees.settings.slaDays);
  const admin = shemeshAdmin();
  const { data, error } = await admin
    .from("shemesh_cases")
    .insert({
      client_name: input.clientName.trim(),
      phone: input.phone.trim() || null,
      stage: "lead",
      status: input.status || "open",
      handler: input.handler.trim() || null,
      service_type: serviceType,
      opened_on: opened,
      deadline,
      sla_due_at: deadline,
      notes: input.notes.trim() || null,
    })
    .select("id")
    .single();
  if (error) return { error: isMissingRelation(error.message) ? "הטבלה עדיין לא הורצה" : error.message };
  const id = String(data.id);
  if (serviceType) await seedChecklist(id, serviceType);
  await writeAudit(actor, "create", "case", id, input.clientName.trim());
  return { error: null };
}

export async function patchCase(id: string, patch: Record<string, string>, actor: string) {
  const admin = shemeshAdmin();
  const current = await admin.from("shemesh_cases").select("stage, service_type").eq("id", id).maybeSingle();
  if (current.error) return { error: current.error.message };
  const next: Record<string, string | null> = { updated_at: new Date().toISOString() };
  if (patch.status) {
    if (!CASE_STATUS.has(patch.status)) return { error: "סטטוס לא מוכר" };
    next.status = patch.status;
  }
  if (patch.stage) {
    if (!STAGE_IDS.has(patch.stage)) return { error: "שלב לא מוכר" };
    const from = text(current.data?.stage) || "lead";
    if (!stageMoveAllowed(from, patch.stage)) return { error: "אפשר להישאר בשלב או להתקדם שלב אחד. אי אפשר לדלג." };
    next.stage = patch.stage;
  }
  let serviceType: ServiceTypeId | null = null;
  if (patch.serviceType && patch.serviceType in SERVICE_CHECKLIST) {
    serviceType = patch.serviceType as ServiceTypeId;
    next.service_type = serviceType;
  }
  if ("handler" in patch) next.handler = patch.handler.trim() || null;
  if ("notes" in patch) next.notes = patch.notes.trim() || null;
  const { error } = await admin.from("shemesh_cases").update(next).eq("id", id);
  if (error) return { error: isMissingRelation(error.message) ? "הטבלה עדיין לא הורצה" : error.message };
  if (serviceType) await seedChecklist(id, serviceType);
  await writeAudit(actor, "update", "case", id, patch.status || patch.stage || patch.handler || "עודכן");
  return { error: null };
}

async function seedChecklist(caseId: string, serviceType: ServiceTypeId) {
  const admin = shemeshAdmin();
  const existing = await admin.from("shemesh_case_documents").select("label").eq("case_id", caseId).limit(40);
  const labels = new Set(asRows(existing.data).map((row) => text(row.label)));
  for (const label of SERVICE_CHECKLIST[serviceType]) {
    if (labels.has(label)) continue;
    await admin.from("shemesh_case_documents").insert({
      case_id: caseId,
      label,
      state: "missing",
      received: false,
      required: true,
    });
  }
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
  const admin = shemeshAdmin();
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
  const admin = shemeshAdmin();
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
  const admin = shemeshAdmin();
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
  const admin = shemeshAdmin();
  const { error } = await admin.from("shemesh_rules").update({ active, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: error.message };
  await writeAudit(actor, "status", "rule", id, active ? "פעיל" : "כבוי");
  return { error: null };
}

export async function saveFeeSettings(input: FeeSettings, actor: string) {
  const admin = shemeshAdmin();
  const { error } = await admin.from("shemesh_fee_settings").upsert({
    id: 1,
    redemption_fee_rate: input.redemptionFeeRate,
    tax_fee_rate: input.taxFeeRate,
    vat_rate: input.vatRate,
    sla_days: input.slaDays,
    success_fee_rates: input.successFeeRates,
    rates_pending: input.ratesPending,
    fee_multiplier: input.feeMultiplier,
    multiplier_pending: input.multiplierPending,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: isMissingRelation(error.message) ? "הטבלה עדיין לא הורצה" : error.message };
  await writeAudit(actor, "update", "fee_settings", "1", "עודכנו שיעורי עמלה");
  return { error: null };
}

export async function setCaseDocumentReceived(id: string, received: boolean, actor: string, state?: string) {
  if (!id) return { error: "חסר מסמך" };
  const nextState = state === "received" || state === "invalid" || state === "missing"
    ? state
    : received ? "received" : "missing";
  const admin = shemeshAdmin();
  const doc = await admin.from("shemesh_case_documents").select("label").eq("id", id).maybeSingle();
  const { error } = await admin.from("shemesh_case_documents").update({
    received: nextState === "received",
    state: nextState,
  }).eq("id", id);
  if (error) return { error: isMissingRelation(error.message) ? "הטבלה עדיין לא הורצה" : error.message };
  const label = text(doc.data?.label);
  const consent = nextState === "received" && label.includes("ייפוי");
  await writeAudit(actor, "update", "document", id, consent ? `הסכמה נחתמה: ${label}` : nextState === "invalid" ? "לא תקין" : nextState === "received" ? "התקבל" : "חסר");
  return { error: null };
}

export async function addCaseChild(
  kind: "task" | "document" | "note",
  input: { caseId: string; title: string; assignee: string; dueOn: string; body: string },
  actor: string,
) {
  if (!input.caseId) return { error: "חסר תיק" };
  const admin = shemeshAdmin();
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

export type CaseFile = {
  id: string;
  clientName: string;
  phone: string;
  stage: string;
  stageLabel: string;
  status: string;
  handler: string;
  openedOn: string;
  deadline: string | null;
  notes: string;
  overdue: boolean;
  serviceType: string;
  tasks: { id: string; title: string; status: string; assignee: string; dueOn: string }[];
  documents: { id: string; label: string; received: boolean; required: boolean; state: string }[];
  notesList: { id: string; body: string; author: string }[];
};

export async function loadCaseBoard(handlerOnly?: string | null): Promise<{
  missing: boolean;
  error: string | null;
  cases: CaseFile[];
  audit: DeskPayload["audit"];
  settings: FeeSettings;
}> {
  const fees = await loadFeeSettings();
  const empty = { missing: fees.missing, error: null as string | null, cases: [] as CaseFile[], audit: [] as DeskPayload["audit"], settings: fees.settings };
  try {
    const admin = shemeshAdmin();
    let caseQuery = admin.from("shemesh_cases").select("*").order("updated_at", { ascending: false }).limit(200);
    if (handlerOnly) caseQuery = caseQuery.eq("handler", handlerOnly);
    const [cases, tasks, documents, notes] = await Promise.all([
      caseQuery,
      admin.from("shemesh_case_tasks").select("*").limit(800),
      admin.from("shemesh_case_documents").select("*").limit(800),
      admin.from("shemesh_case_notes").select("*").order("created_at", { ascending: false }).limit(800),
    ]);
    const firstError = cases.error || tasks.error || documents.error || notes.error;
    if (firstError) {
      if (isMissingRelation(firstError.message)) return { ...empty, missing: true };
      return { ...empty, error: firstError.message };
    }
    const today = todayIso();
    const byCase = <T extends { case_id?: string }>(rows: T[] | null) => {
      const map = new Map<string, T[]>();
      for (const row of rows ?? []) {
        const id = String(row.case_id ?? "");
        const list = map.get(id) ?? [];
        list.push(row);
        map.set(id, list);
      }
      return map;
    };
    const taskMap = byCase(tasks.data as { case_id?: string }[] | null);
    const docMap = byCase(documents.data as { case_id?: string }[] | null);
    const noteMap = byCase(notes.data as { case_id?: string }[] | null);
    return {
      missing: false,
      error: null,
      settings: fees.settings,
      audit: await loadAudit(),
      cases: asRows(cases.data).map((row) => {
        const id = String(row.id);
        const stage = text(row.stage);
        return {
          id,
          clientName: text(row.client_name),
          phone: text(row.phone),
          stage,
          stageLabel: CASE_STAGES.find((item) => item.id === stage)?.label ?? stage,
          status: text(row.status) || "open",
          handler: text(row.handler),
          openedOn: text(row.opened_on),
          deadline: text(row.deadline) || null,
          notes: text(row.notes),
          serviceType: text(row.service_type),
          overdue: slaOverdue(text(row.deadline) || null, text(row.status), today),
          tasks: (taskMap.get(id) ?? []).map((item) => {
            const task = item as { id?: string; title?: string; status?: string; assignee?: string; due_on?: string };
            return {
              id: String(task.id),
              title: text(task.title),
              status: text(task.status),
              assignee: text(task.assignee),
              dueOn: text(task.due_on),
            };
          }),
          documents: (docMap.get(id) ?? []).map((item) => {
            const doc = item as { id?: string; label?: string; received?: boolean; required?: boolean; state?: string };
            return {
              id: String(doc.id),
              label: text(doc.label),
              received: Boolean(doc.received),
              required: doc.required !== false,
              state: text(doc.state) || (doc.received ? "received" : "missing"),
            };
          }),
          notesList: (noteMap.get(id) ?? []).map((item) => {
            const note = item as { id?: string; body?: string; author?: string };
            return { id: String(note.id), body: text(note.body), author: text(note.author) };
          }),
        };
      }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "התיקים לא נטענו";
    if (isMissingRelation(message) || /missing supabase|missing next_public/i.test(message)) return { ...empty, missing: true };
    return { ...empty, error: message };
  }
}

export async function loadCaseDetail(caseId: string) {
  const empty = { missing: false, error: null as string | null, tasks: [] as { id: string; title: string; status: string; assignee: string; dueOn: string }[], documents: [] as { id: string; label: string; received: boolean }[], notes: [] as { id: string; body: string; author: string }[] };
  if (!caseId) return empty;
  try {
    const admin = shemeshAdmin();
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
      tasks: asRows(tasks.data).map((row) => ({
        id: String(row.id),
        title: text(row.title),
        status: text(row.status),
        assignee: text(row.assignee),
        dueOn: text(row.due_on),
      })),
      documents: asRows(documents.data).map((row) => ({
        id: String(row.id),
        label: text(row.label),
        received: Boolean(row.received),
      })),
      notes: asRows(notes.data).map((row) => ({
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

export type QueueLead = {
  id: string;
  clientName: string;
  phone: string;
  excelRowId: string;
  surenseId: string;
  openedCaseId: string | null;
  createdAt: string;
};

export async function loadSheetQueue(): Promise<{ missing: boolean; rows: QueueLead[] }> {
  try {
    const admin = shemeshAdmin();
    const { data, error } = await admin.from("shemesh_sheet6_queue").select("*").order("created_at", { ascending: false }).limit(100);
    if (error) return { missing: isMissingRelation(error.message), rows: [] };
    return {
      missing: false,
      rows: asRows(data).map((row) => ({
        id: String(row.id),
        clientName: text(row.client_name),
        phone: text(row.phone),
        excelRowId: text(row.excel_row_id),
        surenseId: text(row.surense_id),
        openedCaseId: row.opened_case_id ? String(row.opened_case_id) : null,
        createdAt: text(row.created_at)?.slice(0, 10) ?? "",
      })),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return { missing: isMissingRelation(message) || /missing supabase|missing next_public/i.test(message), rows: [] };
  }
}

export async function openQueuedCase(queueId: string, actor: string) {
  if (!queueId) return { error: "חסרה שורה" };
  const admin = shemeshAdmin();
  const { data, error } = await admin.from("shemesh_sheet6_queue").select("*").eq("id", queueId).maybeSingle();
  if (error) return { error: isMissingRelation(error.message) ? "הטבלה עדיין לא הורצה" : error.message };
  if (!data) return { error: "השורה לא נמצאה" };
  if (data.opened_case_id) return { error: null };
  const excel = text(data.excel_row_id);
  const surense = text(data.surense_id);
  const existingId = await existingCaseId(excel, surense);
  if (existingId) {
    await admin.from("shemesh_sheet6_queue").update({ opened_case_id: existingId }).eq("id", queueId);
    return { error: null };
  }
  const inserted = await admin.from("shemesh_cases").insert({
    client_name: text(data.client_name),
    phone: text(data.phone) || null,
    stage: "lead",
    status: "open",
    lead_source: excel ? "sheet6" : surense ? "surense" : null,
    excel_row_id: excel || null,
    surense_id: surense || null,
    opened_on: todayIso(),
  }).select("id").single();
  if (inserted.error) {
    if (/duplicate|unique/i.test(inserted.error.message)) {
      const again = await existingCaseId(excel, surense);
      if (again) await admin.from("shemesh_sheet6_queue").update({ opened_case_id: again }).eq("id", queueId);
      return { error: null };
    }
    return { error: inserted.error.message };
  }
  const id = String(inserted.data.id);
  await admin.from("shemesh_sheet6_queue").update({ opened_case_id: id }).eq("id", queueId);
  await writeAudit(actor, "create", "case", id, text(data.client_name));
  return { error: null };
}

async function existingCaseId(excel: string, surense: string): Promise<string | null> {
  const admin = shemeshAdmin();
  if (excel) {
    const found = await admin.from("shemesh_cases").select("id").eq("excel_row_id", excel).maybeSingle();
    if (found.data?.id) return String(found.data.id);
  }
  if (surense) {
    const found = await admin.from("shemesh_cases").select("id").eq("surense_id", surense).maybeSingle();
    if (found.data?.id) return String(found.data.id);
  }
  return null;
}

export async function ensureStoredChecklists() {
  try {
    const admin = shemeshAdmin();
    const { data, error } = await admin.from("shemesh_cases").select("id, service_type").limit(200);
    if (error) return;
    for (const row of asRows(data)) {
      const type = text(row.service_type);
      if (type in SERVICE_CHECKLIST) await seedChecklist(String(row.id), type as ServiceTypeId);
    }
  } catch {
    // Checklist fill waits until the documents table exists.
  }
}

export async function importTaxRowsToLedger(
  rows: { id: string; name: string; status: string; amount: number }[],
  actor: string,
) {
  const admin = shemeshAdmin();
  let inserted = 0;
  let skipped = 0;
  for (const row of rows) {
    if (!row.name.trim()) continue;
    const key = `tax:${row.id}`;
    const existing = await admin.from("shemesh_ledger").select("id").eq("kind", "tax_refund").eq("external_key", key).maybeSingle();
    if (existing.data?.id) {
      skipped += 1;
      continue;
    }
    const taxStatus = mapTaxStatus(row.status);
    const { error } = await admin.from("shemesh_ledger").insert({
      kind: "tax_refund",
      client_name: row.name.trim(),
      gross: Number.isFinite(row.amount) ? row.amount : 0,
      fee_rate: null,
      fee: null,
      net: null,
      status: taxStatus === "fee_billed" ? "done" : taxStatus === "received" || taxStatus === "filed" ? "waiting" : "open",
      tax_status: taxStatus,
      external_key: key,
      notes: taxStatus ? "ייבוא דוח החזרי מס" : `ייבוא דוח. סטטוס לא מוכר: ${row.status}`,
    });
    if (error) {
      if (/duplicate|unique|external_key/i.test(error.message)) skipped += 1;
      else return { error: error.message, inserted, skipped };
    } else {
      inserted += 1;
    }
  }
  if (inserted) await writeAudit(actor, "import", "ledger", "tax_refund", `יובאו ${inserted} שורות`);
  return { error: null, inserted, skipped };
}

export async function loadRuleKind(id: string): Promise<string | null> {
  if (!id) return null;
  try {
    const admin = shemeshAdmin();
    const { data } = await admin.from("shemesh_rules").select("kind").eq("id", id).maybeSingle();
    return data?.kind ? text(data.kind) : null;
  } catch {
    return null;
  }
}

export async function loadInsurerProductions(): Promise<{ missing: boolean; rows: { premium: number | null; status: string }[] }> {
  try {
    const admin = shemeshAdmin();
    const { data, error } = await admin.from("shemesh_insurer_rows").select("premium, settlement_status").limit(400);
    if (error) return { missing: isMissingRelation(error.message), rows: [] };
    return {
      missing: false,
      rows: asRows(data).map((row) => ({
        premium: row.premium == null ? null : Number(row.premium),
        status: text(row.settlement_status),
      })),
    };
  } catch {
    return { missing: true, rows: [] };
  }
}

export async function loadTaxStatuses(): Promise<{ missing: boolean; statuses: Array<string | null> }> {
  try {
    const admin = shemeshAdmin();
    const { data, error } = await admin.from("shemesh_ledger").select("tax_status").eq("kind", "tax_refund").limit(400);
    if (error) return { missing: isMissingRelation(error.message), statuses: [] };
    return { missing: false, statuses: asRows(data).map((row) => text(row.tax_status) || null) };
  } catch {
    return { missing: true, statuses: [] };
  }
}
