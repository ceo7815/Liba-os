"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  categoriesForKind,
  getFinanceCategory,
  getPortalFinanceLabel,
  isCommissionType,
  isFinanceKind,
  isFinancePortalSlug,
  isPayrollMonth,
  isSalaryCategory,
  payrollMonthToDate,
  toPayrollMonth,
  monthRange,
  plDeltaForEntry,
  type CommissionType,
  type FinanceAttachment,
  type FinanceBankSnapshot,
  type FinanceEntry,
  type FinanceKind,
  type FinanceMutationResult,
  type PlLine,
  type PlReport,
} from "@/lib/finance/categories";

export type { FinanceMutationResult };

const BUCKET = "finance-docs";
const MAX_FILE_BYTES = 20 * 1024 * 1024;

function mapEntry(row: {
  id: string;
  kind: string;
  category: string;
  amount: number | string;
  currency: string;
  occurred_at: string;
  portal_slug: string | null;
  commission_type: string | null;
  description: string | null;
  reference_number: string | null;
  vat_included: boolean;
  notes: string | null;
  employee_id?: string | null;
  supplier_id?: string | null;
  payroll_month?: string | null;
  created_at: string;
  updated_at: string;
}): FinanceEntry {
  return {
    id: row.id,
    kind: (isFinanceKind(row.kind) ? row.kind : "expense") as FinanceKind,
    category: row.category,
    amount: Number(row.amount),
    currency: row.currency,
    occurred_at: row.occurred_at,
    portal_slug: row.portal_slug,
    commission_type:
      row.commission_type && isCommissionType(row.commission_type)
        ? row.commission_type
        : null,
    description: row.description,
    reference_number: row.reference_number,
    vat_included: row.vat_included,
    notes: row.notes,
    employee_id: row.employee_id ?? null,
    supplier_id: row.supplier_id ?? null,
    payroll_month:
      row.payroll_month && isPayrollMonth(row.payroll_month)
        ? row.payroll_month
        : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function validateCategory(kind: FinanceKind, category: string): string | null {
  const allowed = categoriesForKind(kind);
  if (!allowed.some((c) => c.id === category)) {
    return "סעיף לא תואם לסוג התנועה";
  }
  return null;
}

function parseAmount(raw: number | string): number | null {
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

const ENTRY_COLS =
  "id, kind, category, amount, currency, occurred_at, portal_slug, commission_type, description, reference_number, vat_included, notes, employee_id, supplier_id, payroll_month, created_at, updated_at";

async function resolveSalaryAssignment(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    kind: FinanceKind;
    category: string;
    occurred_at: string;
    employee_id?: string;
    supplier_id?: string;
    payroll_month?: string;
  },
): Promise<{
  error: string | null;
  employeeId: string | null;
  supplierId: string | null;
  payrollMonth: string | null;
  occurredAt: string;
}> {
  const supplierId = input.supplier_id?.trim() || null;
  const employeeId = input.employee_id?.trim() || null;

  if (input.kind === "expense" && isSalaryCategory(input.category)) {
    if (!employeeId) {
      return {
        error: "חובה לשייך את המשכורת לעובד",
        employeeId: null,
        supplierId: null,
        payrollMonth: null,
        occurredAt: input.occurred_at,
      };
    }
    const payrollMonth =
      input.payroll_month?.trim() ||
      (input.occurred_at ? toPayrollMonth(input.occurred_at) : "");
    if (!isPayrollMonth(payrollMonth)) {
      return {
        error: "חובה לבחור חודש משכורת",
        employeeId,
        supplierId: null,
        payrollMonth: null,
        occurredAt: input.occurred_at,
      };
    }
    const { data: emp } = await admin
      .from("finance_employees")
      .select("id")
      .eq("id", employeeId)
      .maybeSingle();
    if (!emp) {
      return {
        error: "העובד לא נמצא — הוסיפו אותו ידנית קודם",
        employeeId: null,
        supplierId: null,
        payrollMonth: null,
        occurredAt: input.occurred_at,
      };
    }
    return {
      error: null,
      employeeId,
      supplierId: null,
      payrollMonth,
      occurredAt: payrollMonthToDate(payrollMonth),
    };
  }

  return {
    error: null,
    employeeId,
    supplierId,
    payrollMonth: null,
    occurredAt: input.occurred_at,
  };
}

export async function listFinanceEntries(options?: {
  from?: string;
  to?: string;
  kind?: string;
  category?: string;
  portal_slug?: string;
  query?: string;
}): Promise<{ error: string | null; entries: FinanceEntry[] }> {
  await requireAdmin();
  const admin = createAdminClient();

  let q = admin
    .from("finance_entries")
    .select(ENTRY_COLS)
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (options?.from) q = q.gte("occurred_at", options.from);
  if (options?.to) q = q.lte("occurred_at", options.to);
  if (options?.kind && isFinanceKind(options.kind)) {
    q = q.eq("kind", options.kind);
  }
  if (options?.category) q = q.eq("category", options.category);
  if (options?.portal_slug) q = q.eq("portal_slug", options.portal_slug);

  const search = options?.query?.trim();
  if (search) {
    const safe = search.replace(/[%_]/g, " ").replace(/\s+/g, " ").trim();
    if (safe) {
      q = q.or(
        `description.ilike.%${safe}%,reference_number.ilike.%${safe}%,notes.ilike.%${safe}%`,
      );
    }
  }

  const { data, error } = await q.limit(500);
  if (error) return { error: error.message, entries: [] };
  return { error: null, entries: (data ?? []).map(mapEntry) };
}

export async function createFinanceEntry(input: {
  kind: string;
  category: string;
  amount: number | string;
  occurred_at: string;
  portal_slug?: string;
  commission_type?: string;
  description?: string;
  reference_number?: string;
  vat_included?: boolean;
  notes?: string;
  employee_id?: string;
  supplier_id?: string;
  payroll_month?: string;
}): Promise<FinanceMutationResult> {
  const profile = await requireAdmin();

  if (!isFinanceKind(input.kind)) return { error: "סוג תנועה לא תקין" };
  const category = input.category?.trim();
  if (!category) return { error: "חובה לבחור סעיף" };
  const catErr = validateCategory(input.kind, category);
  if (catErr) return { error: catErr };

  const amount = parseAmount(input.amount);
  if (amount == null) return { error: "סכום לא תקין" };

  let commissionType: CommissionType | null = null;
  if (input.kind === "income" && input.commission_type) {
    if (!isCommissionType(input.commission_type)) {
      return { error: "סוג עמלה לא תקין" };
    }
    commissionType = input.commission_type;
  }

  const portalSlug =
    input.kind === "income" || input.kind === "income_adjustment"
      ? input.portal_slug?.trim() || null
      : null;

  if (
    (input.kind === "income" || input.kind === "income_adjustment") &&
    !portalSlug
  ) {
    return { error: "חובה לבחור חברת ביטוח" };
  }
  if (portalSlug && !isFinancePortalSlug(portalSlug)) {
    return { error: "חברת ביטוח לא תקינה" };
  }

  const admin = createAdminClient();
  const assignment = await resolveSalaryAssignment(admin, {
    kind: input.kind,
    category,
    occurred_at: input.occurred_at,
    employee_id: input.employee_id,
    supplier_id: input.supplier_id,
    payroll_month: input.payroll_month,
  });
  if (assignment.error) return { error: assignment.error };
  if (!assignment.occurredAt?.trim()) return { error: "חובה למלא תאריך" };

  const { data, error } = await admin
    .from("finance_entries")
    .insert({
      kind: input.kind,
      category,
      amount,
      occurred_at: assignment.occurredAt,
      portal_slug: portalSlug,
      commission_type: commissionType,
      description: input.description?.trim() || null,
      reference_number: input.reference_number?.trim() || null,
      vat_included: input.vat_included ?? true,
      notes: input.notes?.trim() || null,
      employee_id: assignment.employeeId,
      supplier_id: assignment.supplierId,
      payroll_month: assignment.payrollMonth,
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "יצירת התנועה נכשלה" };
  }

  revalidatePath("/finance");
  return { error: null, id: data.id };
}

export async function updateFinanceEntry(input: {
  id: string;
  kind: string;
  category: string;
  amount: number | string;
  occurred_at: string;
  portal_slug?: string;
  commission_type?: string;
  description?: string;
  reference_number?: string;
  vat_included?: boolean;
  notes?: string;
  employee_id?: string;
  supplier_id?: string;
  payroll_month?: string;
}): Promise<FinanceMutationResult> {
  const profile = await requireAdmin();
  if (!input.id?.trim()) return { error: "חסר מזהה" };
  if (!isFinanceKind(input.kind)) return { error: "סוג תנועה לא תקין" };

  const category = input.category?.trim();
  if (!category) return { error: "חובה לבחור סעיף" };
  const catErr = validateCategory(input.kind, category);
  if (catErr) return { error: catErr };

  const amount = parseAmount(input.amount);
  if (amount == null) return { error: "סכום לא תקין" };

  let commissionType: CommissionType | null = null;
  if (input.kind === "income" && input.commission_type) {
    if (!isCommissionType(input.commission_type)) {
      return { error: "סוג עמלה לא תקין" };
    }
    commissionType = input.commission_type;
  }

  const portalSlug =
    input.kind === "income" || input.kind === "income_adjustment"
      ? input.portal_slug?.trim() || null
      : null;

  if (
    (input.kind === "income" || input.kind === "income_adjustment") &&
    !portalSlug
  ) {
    return { error: "חובה לבחור חברת ביטוח" };
  }
  if (portalSlug && !isFinancePortalSlug(portalSlug)) {
    return { error: "חברת ביטוח לא תקינה" };
  }

  const admin = createAdminClient();
  const assignment = await resolveSalaryAssignment(admin, {
    kind: input.kind,
    category,
    occurred_at: input.occurred_at,
    employee_id: input.employee_id,
    supplier_id: input.supplier_id,
    payroll_month: input.payroll_month,
  });
  if (assignment.error) return { error: assignment.error };
  if (!assignment.occurredAt?.trim()) return { error: "חובה למלא תאריך" };

  const { error } = await admin
    .from("finance_entries")
    .update({
      kind: input.kind,
      category,
      amount,
      occurred_at: assignment.occurredAt,
      portal_slug: portalSlug,
      commission_type: commissionType,
      description: input.description?.trim() || null,
      reference_number: input.reference_number?.trim() || null,
      vat_included: input.vat_included ?? true,
      notes: input.notes?.trim() || null,
      employee_id: assignment.employeeId,
      supplier_id: assignment.supplierId,
      payroll_month: assignment.payrollMonth,
      updated_by: profile.id,
    })
    .eq("id", input.id);

  if (error) return { error: error.message };
  revalidatePath("/finance");
  return { error: null, id: input.id };
}

export async function deleteFinanceEntry(
  id: string,
): Promise<FinanceMutationResult> {
  await requireAdmin();
  if (!id?.trim()) return { error: "חסר מזהה" };

  const admin = createAdminClient();

  const { data: files } = await admin
    .from("finance_attachments")
    .select("id, storage_path")
    .eq("entry_id", id);

  if (files?.length) {
    await admin.storage
      .from(BUCKET)
      .remove(files.map((f) => f.storage_path));
    await admin.from("finance_attachments").delete().eq("entry_id", id);
  }

  const { error } = await admin.from("finance_entries").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/finance");
  return { error: null, id };
}

export async function getFinancePlReport(input: {
  from: string;
  to: string;
}): Promise<{ error: string | null; report: PlReport | null }> {
  await requireAdmin();
  if (!input.from || !input.to) {
    return { error: "חובה לבחור טווח תאריכים", report: null };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("finance_entries")
    .select(ENTRY_COLS)
    .gte("occurred_at", input.from)
    .lte("occurred_at", input.to)
    .limit(2000);

  if (error) return { error: error.message, report: null };

  const entries = (data ?? []).map(mapEntry);
  let incomeTotal = 0;
  let adjustmentTotal = 0;
  let expenseTotal = 0;

  const incomeMap = new Map<string, number>();
  const portalMap = new Map<string, number>();
  const adjMap = new Map<string, number>();
  const expenseMap = new Map<string, number>();

  for (const entry of entries) {
    const d = plDeltaForEntry(entry);
    incomeTotal += d.income;
    adjustmentTotal += d.adjustment;
    expenseTotal += d.expense;

    if (entry.kind === "income") {
      incomeMap.set(
        entry.category,
        (incomeMap.get(entry.category) ?? 0) + entry.amount,
      );
      const portalKey = entry.portal_slug ?? "_none";
      portalMap.set(
        portalKey,
        (portalMap.get(portalKey) ?? 0) + entry.amount,
      );
    } else if (entry.kind === "income_adjustment") {
      adjMap.set(
        entry.category,
        (adjMap.get(entry.category) ?? 0) + entry.amount,
      );
    } else if (entry.kind === "expense") {
      expenseMap.set(
        entry.category,
        (expenseMap.get(entry.category) ?? 0) + entry.amount,
      );
    }
  }

  const toLines = (map: Map<string, number>): PlLine[] =>
    Array.from(map.entries())
      .map(([category, amount]) => {
        const def = getFinanceCategory(category);
        return {
          category,
          label: def?.label ?? category,
          group: def?.group ?? "אחר",
          amount,
        };
      })
      .sort((a, b) => b.amount - a.amount);

  const incomeByCategory = toLines(incomeMap);
  const adjustmentsByCategory = toLines(adjMap);
  const expenseLines = toLines(expenseMap);

  const groupMap = new Map<string, PlLine[]>();
  for (const line of expenseLines) {
    const list = groupMap.get(line.group) ?? [];
    list.push(line);
    groupMap.set(line.group, list);
  }

  const expensesByGroup = Array.from(groupMap.entries())
    .map(([group, lines]) => ({
      group,
      amount: lines.reduce((s: number, l: PlLine) => s + l.amount, 0),
      lines,
    }))
    .sort((a, b) => b.amount - a.amount);

  const incomeByPortal = Array.from(portalMap.entries())
    .map(([portal_slug, amount]) => ({
      portal_slug,
      label:
        portal_slug === "_none"
          ? "ללא חברת ביטוח"
          : getPortalFinanceLabel(portal_slug),
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);

  const netIncome = incomeTotal - adjustmentTotal;
  const operatingProfit = netIncome - expenseTotal;

  return {
    error: null,
    report: {
      from: input.from,
      to: input.to,
      incomeTotal,
      adjustmentTotal,
      netIncome,
      expenseTotal,
      operatingProfit,
      incomeByCategory,
      incomeByPortal,
      adjustmentsByCategory,
      expensesByGroup,
    },
  };
}

export async function listBankSnapshots(): Promise<{
  error: string | null;
  snapshots: FinanceBankSnapshot[];
}> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("finance_bank_snapshots")
    .select("id, snapshot_date, balance, account_label, notes, created_at")
    .order("snapshot_date", { ascending: false })
    .limit(100);

  if (error) return { error: error.message, snapshots: [] };
  return {
    error: null,
    snapshots: (data ?? []).map((row) => ({
      id: row.id,
      snapshot_date: row.snapshot_date,
      balance: Number(row.balance),
      account_label: row.account_label,
      notes: row.notes,
      created_at: row.created_at,
    })),
  };
}

export async function upsertBankSnapshot(input: {
  snapshot_date: string;
  balance: number | string;
  account_label?: string;
  notes?: string;
}): Promise<FinanceMutationResult> {
  const profile = await requireAdmin();
  if (!input.snapshot_date?.trim()) return { error: "חובה למלא תאריך" };
  const bal =
    typeof input.balance === "number"
      ? input.balance
      : Number(String(input.balance).replace(",", "."));
  if (!Number.isFinite(bal)) return { error: "יתרה לא תקינה" };

  const accountLabel = input.account_label?.trim() || "עו״ש ראשי";
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("finance_bank_snapshots")
    .upsert(
      {
        snapshot_date: input.snapshot_date,
        balance: Math.round(bal * 100) / 100,
        account_label: accountLabel,
        notes: input.notes?.trim() || null,
        created_by: profile.id,
      },
      { onConflict: "snapshot_date,account_label" },
    )
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "שמירת היתרה נכשלה" };
  }

  revalidatePath("/finance");
  return { error: null, id: data.id };
}

export async function deleteBankSnapshot(
  id: string,
): Promise<FinanceMutationResult> {
  await requireAdmin();
  if (!id?.trim()) return { error: "חסר מזהה" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("finance_bank_snapshots")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/finance");
  return { error: null, id };
}

export async function getBankReconciliation(input: {
  from: string;
  to: string;
  account_label?: string;
}): Promise<{
  error: string | null;
  opening: FinanceBankSnapshot | null;
  closing: FinanceBankSnapshot | null;
  cashNet: number;
  expectedClosing: number | null;
  variance: number | null;
}> {
  await requireAdmin();
  const accountLabel = input.account_label?.trim() || "עו״ש ראשי";
  const admin = createAdminClient();

  const { data: entries, error: entriesError } = await admin
    .from("finance_entries")
    .select("kind, amount")
    .gte("occurred_at", input.from)
    .lte("occurred_at", input.to);

  if (entriesError) {
    return {
      error: entriesError.message,
      opening: null,
      closing: null,
      cashNet: 0,
      expectedClosing: null,
      variance: null,
    };
  }

  let cashNet = 0;
  for (const row of entries ?? []) {
    const amount = Number(row.amount);
    if (row.kind === "income") cashNet += amount;
    else if (row.kind === "income_adjustment" || row.kind === "expense") {
      cashNet -= amount;
    }
  }

  const { data: snaps } = await admin
    .from("finance_bank_snapshots")
    .select("id, snapshot_date, balance, account_label, notes, created_at")
    .eq("account_label", accountLabel)
    .lte("snapshot_date", input.to)
    .order("snapshot_date", { ascending: false })
    .limit(50);

  const mapped =
    snaps?.map((row) => ({
      id: row.id,
      snapshot_date: row.snapshot_date,
      balance: Number(row.balance),
      account_label: row.account_label,
      notes: row.notes,
      created_at: row.created_at,
    })) ?? [];

  const opening =
    mapped.find((s) => s.snapshot_date <= input.from) ??
    mapped.find((s) => s.snapshot_date < input.from) ??
    null;
  // Prefer snapshot on/before from for opening; for closing prefer on/near to
  const openingSnap =
    mapped
      .filter((s) => s.snapshot_date <= input.from)
      .sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date))[0] ??
    null;
  const closingSnap =
    mapped
      .filter((s) => s.snapshot_date <= input.to)
      .sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date))[0] ??
    null;

  void opening;
  const expectedClosing =
    openingSnap != null ? openingSnap.balance + cashNet : null;
  const variance =
    expectedClosing != null && closingSnap != null
      ? closingSnap.balance - expectedClosing
      : null;

  return {
    error: null,
    opening: openingSnap,
    closing: closingSnap,
    cashNet,
    expectedClosing,
    variance,
  };
}

export async function listFinanceAttachments(options?: {
  entry_id?: string | null;
}): Promise<{ error: string | null; attachments: FinanceAttachment[] }> {
  await requireAdmin();
  const admin = createAdminClient();
  let q = admin
    .from("finance_attachments")
    .select(
      "id, entry_id, storage_path, file_name, mime_type, file_size, created_at",
    )
    .order("created_at", { ascending: false });

  if (options?.entry_id) {
    q = q.eq("entry_id", options.entry_id);
  }

  const { data, error } = await q.limit(200);
  if (error) return { error: error.message, attachments: [] };
  return {
    error: null,
    attachments: (data ?? []).map((row) => ({
      id: row.id,
      entry_id: row.entry_id,
      storage_path: row.storage_path,
      file_name: row.file_name,
      mime_type: row.mime_type,
      file_size: row.file_size,
      created_at: row.created_at,
    })),
  };
}

export async function uploadFinanceAttachment(formData: FormData): Promise<
  FinanceMutationResult & { attachment?: FinanceAttachment }
> {
  const profile = await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "לא נבחר קובץ" };
  if (file.size <= 0) return { error: "קובץ ריק" };
  if (file.size > MAX_FILE_BYTES) return { error: "הקובץ גדול מ־20MB" };

  const entryIdRaw = formData.get("entry_id");
  const entryId =
    typeof entryIdRaw === "string" && entryIdRaw.trim()
      ? entryIdRaw.trim()
      : null;

  const safeName = file.name.replace(/[^\w.\u0590-\u05FF\u00A0-\uFFFF\- ()]/g, "_");
  const path = `${profile.id}/${Date.now()}-${safeName}`;

  const admin = createAdminClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) return { error: uploadError.message };

  const { data, error } = await admin
    .from("finance_attachments")
    .insert({
      entry_id: entryId,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      file_size: file.size,
      uploaded_by: profile.id,
    })
    .select(
      "id, entry_id, storage_path, file_name, mime_type, file_size, created_at",
    )
    .single();

  if (error || !data) {
    await admin.storage.from(BUCKET).remove([path]);
    return { error: error?.message ?? "שמירת המסמך נכשלה" };
  }

  revalidatePath("/finance");
  return {
    error: null,
    id: data.id,
    attachment: {
      id: data.id,
      entry_id: data.entry_id,
      storage_path: data.storage_path,
      file_name: data.file_name,
      mime_type: data.mime_type,
      file_size: data.file_size,
      created_at: data.created_at,
    },
  };
}

export async function getFinanceAttachmentUrl(
  attachmentId: string,
): Promise<{ error: string | null; url?: string }> {
  await requireAdmin();
  if (!attachmentId?.trim()) return { error: "חסר מזהה" };

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("finance_attachments")
    .select("storage_path")
    .eq("id", attachmentId)
    .maybeSingle();

  if (error || !row) return { error: error?.message ?? "מסמך לא נמצא" };

  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path, 60 * 10);

  if (signError || !signed?.signedUrl) {
    return { error: signError?.message ?? "יצירת קישור נכשלה" };
  }

  return { error: null, url: signed.signedUrl };
}

export async function deleteFinanceAttachment(
  id: string,
): Promise<FinanceMutationResult> {
  await requireAdmin();
  if (!id?.trim()) return { error: "חסר מזהה" };

  const admin = createAdminClient();
  const { data: row, error: findError } = await admin
    .from("finance_attachments")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  if (findError || !row) {
    return { error: findError?.message ?? "מסמך לא נמצא" };
  }

  await admin.storage.from(BUCKET).remove([row.storage_path]);
  const { error } = await admin.from("finance_attachments").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/finance");
  return { error: null, id };
}

export async function getFinanceMonthSummary(): Promise<{
  error: string | null;
  from: string;
  to: string;
  incomeTotal: number;
  adjustmentTotal: number;
  expenseTotal: number;
  operatingProfit: number;
  entryCount: number;
}> {
  const { from, to } = monthRange();
  const result = await getFinancePlReport({ from, to });
  if (result.error || !result.report) {
    return {
      error: result.error,
      from,
      to,
      incomeTotal: 0,
      adjustmentTotal: 0,
      expenseTotal: 0,
      operatingProfit: 0,
      entryCount: 0,
    };
  }

  const list = await listFinanceEntries({ from, to });
  return {
    error: null,
    from,
    to,
    incomeTotal: result.report.incomeTotal,
    adjustmentTotal: result.report.adjustmentTotal,
    expenseTotal: result.report.expenseTotal,
    operatingProfit: result.report.operatingProfit,
    entryCount: list.entries.length,
  };
}
