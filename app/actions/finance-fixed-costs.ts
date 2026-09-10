"use server";

import { revalidatePath } from "next/cache";
import { createFinanceEntry, updateFinanceEntry } from "@/app/actions/finance";
import { requireFinanceAccess } from "@/lib/auth";
import { EXPENSES_PATH, SOURCE_PNL_PATH } from "@/lib/finance/access";
import {
  amountAsPaid,
  categoryForAllocation,
  isFinanceOk,
  monthRange,
  suggestVendorFromFileName,
  type ExpenseAllocationType,
  type ExpenseKind,
  type ExpenseSourceAllocation,
  type FinanceFixedCost,
  type FinanceFixedCostWithMeta,
  type FinanceMutationResult,
  type FixedCostPayment,
} from "@/lib/finance/categories";
import { getSalesDashboardSnapshot } from "@/lib/sales-dashboard/snapshot";
import { extractInvoiceFields } from "@/lib/finance/invoice-extract";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "finance-docs";
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function resolveInvoiceMime(fileName: string, mimeRaw: string | null | undefined): string {
  const mime = (mimeRaw || "").toLowerCase().trim();
  if (ALLOWED_MIME.has(mime) || mime.startsWith("image/")) return mime;
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic")) return "image/heic";
  if (lower.endsWith(".heif")) return "image/heif";
  return mime || "application/octet-stream";
}

function isAllowedInvoiceMime(mime: string): boolean {
  return ALLOWED_MIME.has(mime) || mime.startsWith("image/");
}

function readFormFile(formData: FormData): {
  error: string | null;
  file: File | null;
} {
  const file = formData.get("file");
  if (file instanceof File) return { error: null, file };

  // Some Node/undici paths yield a Blob without File prototype.
  if (
    typeof file === "object" &&
    file !== null &&
    typeof (file as Blob).arrayBuffer === "function" &&
    typeof (file as Blob).type === "string"
  ) {
    const blob = file as Blob;
    const named = formData.get("file_name");
    const name =
      typeof named === "string" && named.trim()
        ? named.trim()
        : "invoice.bin";
    return {
      error: null,
      file: new File([blob], name, {
        type: blob.type || "application/octet-stream",
      }),
    };
  }

  return { error: "לא נבחר קובץ", file: null };
}

const COST_COLS =
  "id, title, category, vendor_name, default_amount, due_day, notes, sort_order, is_active, allocation_type, expense_kind, invoice_storage_path, invoice_file_name, invoice_mime_type, invoice_uploaded_at, created_at, updated_at";

function parseExpenseKind(raw: unknown): ExpenseKind {
  return raw === "variable" ? "variable" : "fixed";
}

const PAYMENT_COLS =
  "id, amount, occurred_at, description, reference_number, vat_included, notes, created_at, fixed_cost_id";

function mapCost(row: Record<string, unknown>): FinanceFixedCost {
  const allocation =
    row.allocation_type === "sources" ? "sources" : "office";
  return {
    id: String(row.id),
    title: String(row.title),
    category: String(row.category),
    vendor_name: (row.vendor_name as string | null) ?? null,
    default_amount:
      row.default_amount == null ? null : Number(row.default_amount),
    due_day: row.due_day == null ? null : Number(row.due_day),
    notes: (row.notes as string | null) ?? null,
    sort_order: Number(row.sort_order ?? 100),
    is_active: Boolean(row.is_active),
    allocation_type: allocation,
    expense_kind: parseExpenseKind(row.expense_kind),
    invoice_storage_path: (row.invoice_storage_path as string | null) ?? null,
    invoice_file_name: (row.invoice_file_name as string | null) ?? null,
    invoice_mime_type: (row.invoice_mime_type as string | null) ?? null,
    invoice_uploaded_at: (row.invoice_uploaded_at as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapPayment(row: Record<string, unknown>): FixedCostPayment {
  return {
    id: String(row.id),
    amount: Number(row.amount),
    occurred_at: String(row.occurred_at),
    description: (row.description as string | null) ?? null,
    reference_number: (row.reference_number as string | null) ?? null,
    vat_included: Boolean(row.vat_included),
    notes: (row.notes as string | null) ?? null,
    created_at: String(row.created_at),
  };
}

function parseOptionalAmount(raw: number | string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function parseDueDay(raw: number | string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 28) return null;
  return n;
}

function normalizeAllocations(
  allocationType: ExpenseAllocationType,
  allocations: ExpenseSourceAllocation[] | undefined,
): { ok: true; rows: ExpenseSourceAllocation[] } | { ok: false; error: string } {
  if (allocationType === "office") return { ok: true, rows: [] };
  const cleaned = (allocations ?? [])
    .map((row) => ({
      source_name: row.source_name?.trim() ?? "",
      share_percent: Number(row.share_percent),
    }))
    .filter((row) => row.source_name);

  if (cleaned.length === 0) {
    return { ok: false, error: "בחרו לפחות מקור אחד, או סמנו הוצאות משרד כלליות" };
  }

  const names = new Set<string>();
  for (const row of cleaned) {
    if (names.has(row.source_name)) {
      return { ok: false, error: `מקור כפול: ${row.source_name}` };
    }
    names.add(row.source_name);
    if (!Number.isFinite(row.share_percent) || row.share_percent <= 0) {
      return { ok: false, error: `אחוז לא תקין עבור ${row.source_name}` };
    }
  }

  const sum = cleaned.reduce((acc, row) => acc + row.share_percent, 0);
  if (Math.abs(sum - 100) > 0.05) {
    return { ok: false, error: `סכום האחוזים חייב להיות 100% (כרגע ${sum.toFixed(1)}%)` };
  }

  return {
    ok: true,
    rows: cleaned.map((row) => ({
      source_name: row.source_name,
      share_percent: Math.round(row.share_percent * 100) / 100,
    })),
  };
}

function revalidateFixed() {
  revalidatePath(EXPENSES_PATH);
  revalidatePath(SOURCE_PNL_PATH);
}

async function replaceAllocations(
  admin: ReturnType<typeof createAdminClient>,
  costId: string,
  rows: ExpenseSourceAllocation[],
) {
  await admin
    .from("finance_fixed_cost_allocations")
    .delete()
    .eq("fixed_cost_id", costId);
  if (!rows.length) return null;
  const { error } = await admin.from("finance_fixed_cost_allocations").insert(
    rows.map((row) => ({
      fixed_cost_id: costId,
      source_name: row.source_name,
      share_percent: row.share_percent,
    })),
  );
  return error?.message ?? null;
}

export async function listExpenseAllocationSources(): Promise<{
  error: string | null;
  sources: string[];
}> {
  await requireFinanceAccess();
  try {
    const data = await getSalesDashboardSnapshot();
    const set = new Set<string>();
    for (const row of data.marketing?.sources ?? []) {
      const name = row.name?.trim();
      if (name) set.add(name);
    }
    for (const name of data.marketing?.sourceCatalog ?? []) {
      if (name.trim()) set.add(name.trim());
    }
    for (const row of data.marketing?.productions ?? []) {
      const name = row.source?.trim();
      if (name) set.add(name);
    }
    set.delete("ללא מקור");
    return {
      error: null,
      sources: Array.from(set).sort((a, b) => a.localeCompare(b, "he")),
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "טעינת מקורות נכשלה",
      sources: [],
    };
  }
}

export async function listFinanceFixedCosts(options?: {
  from?: string;
  to?: string;
}): Promise<{
  error: string | null;
  costs: FinanceFixedCostWithMeta[];
}> {
  await requireFinanceAccess();
  const admin = createAdminClient();
  const fallback = monthRange();
  const from = options?.from?.trim() || fallback.from;
  const to = options?.to?.trim() || fallback.to;

  const { data: costRows, error: costError } = await admin
    .from("finance_fixed_costs")
    .select(COST_COLS)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  if (costError) return { error: costError.message, costs: [] };

  const costs = (costRows ?? []).map((row) => mapCost(row as Record<string, unknown>));
  const ids = costs.map((c) => c.id);
  if (ids.length === 0) return { error: null, costs: [] };

  // Load payments covering the selected period + a short lookback for last_paid_at.
  const lookback = new Date(`${from}T00:00:00`);
  lookback.setUTCMonth(lookback.getUTCMonth() - 3);
  const lookbackFrom = lookback.toISOString().slice(0, 10);

  const [{ data: paymentRows, error: payError }, { data: allocRows, error: allocError }] =
    await Promise.all([
      admin
        .from("finance_entries")
        .select(PAYMENT_COLS)
        .in("fixed_cost_id", ids)
        .eq("kind", "expense")
        .gte("occurred_at", lookbackFrom)
        .lte("occurred_at", to)
        .order("occurred_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(400),
      admin
        .from("finance_fixed_cost_allocations")
        .select("fixed_cost_id, source_name, share_percent")
        .in("fixed_cost_id", ids),
    ]);

  if (payError) return { error: payError.message, costs: [] };
  if (allocError) return { error: allocError.message, costs: [] };

  const byCost = new Map<string, FixedCostPayment[]>();
  for (const row of paymentRows ?? []) {
    const costId = String((row as { fixed_cost_id?: string }).fixed_cost_id ?? "");
    if (!costId) continue;
    const list = byCost.get(costId) ?? [];
    list.push(mapPayment(row as Record<string, unknown>));
    byCost.set(costId, list);
  }

  const allocByCost = new Map<string, ExpenseSourceAllocation[]>();
  for (const row of allocRows ?? []) {
    const costId = String(row.fixed_cost_id);
    const list = allocByCost.get(costId) ?? [];
    list.push({
      source_name: String(row.source_name),
      share_percent: Number(row.share_percent),
    });
    allocByCost.set(costId, list);
  }

  const enriched: FinanceFixedCostWithMeta[] = costs
    .map((cost) => {
      const payments = (byCost.get(cost.id) ?? []).slice(0, 40);
      const inPeriod = payments.filter(
        (p) => p.occurred_at >= from && p.occurred_at <= to,
      );
      const paidThisMonth = inPeriod.length > 0;
      // Ledger stores before-VAT; expenses UI shows cash paid (סכום ששולם).
      const thisMonthAmount = paidThisMonth
        ? inPeriod.reduce(
            (sum, p) => sum + amountAsPaid(p.amount, p.vat_included),
            0,
          )
        : null;
      return {
        ...cost,
        payments,
        paid_this_month: paidThisMonth,
        this_month_amount: thisMonthAmount,
        last_paid_at: payments[0]?.occurred_at ?? null,
        allocations: allocByCost.get(cost.id) ?? [],
      };
    })
    // Expenses in this module are paid records — show only those paid in the period.
    .filter((cost) => cost.paid_this_month);

  return { error: null, costs: enriched };
}

export async function createFinanceFixedCost(input: {
  title: string;
  vendor_name?: string;
  default_amount?: number | string | null;
  due_day?: number | string | null;
  notes?: string;
  allocation_type: ExpenseAllocationType;
  allocations?: ExpenseSourceAllocation[];
  expense_kind?: ExpenseKind;
  /** Payment date — every expense here is treated as already paid. */
  paid_at?: string | null;
  vat_included?: boolean;
}): Promise<FinanceMutationResult> {
  const profile = await requireFinanceAccess();
  const title = input.title?.trim();
  if (!title) return { error: "חובה למלא שם הוצאה" };

  const allocationType: ExpenseAllocationType =
    input.allocation_type === "sources" ? "sources" : "office";
  const alloc = normalizeAllocations(allocationType, input.allocations);
  if (!alloc.ok) return { error: alloc.error };
  const allocRows = alloc.rows;

  const expenseKind = parseExpenseKind(input.expense_kind);
  const amount = parseOptionalAmount(input.default_amount);
  if (amount == null || amount <= 0) {
    return { error: "חובה למלא סכום ששולם" };
  }
  const dueDay =
    expenseKind === "variable" ? null : parseDueDay(input.due_day);
  if (
    expenseKind === "fixed" &&
    input.due_day != null &&
    input.due_day !== "" &&
    dueDay == null
  ) {
    return { error: "יום חיוב חייב להיות בין 1 ל־28" };
  }

  const paidAt = (input.paid_at?.trim() || new Date().toISOString().slice(0, 10));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidAt)) {
    return { error: "תאריך תשלום לא תקין" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("finance_fixed_costs")
    .insert({
      title,
      category: categoryForAllocation(allocationType),
      vendor_name: input.vendor_name?.trim() || null,
      default_amount: amount,
      due_day: dueDay,
      notes: input.notes?.trim() || null,
      allocation_type: allocationType,
      expense_kind: expenseKind,
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "שמירה נכשלה" };

  const allocErr = await replaceAllocations(admin, data.id, allocRows);
  if (allocErr) return { error: allocErr };

  const pay = await recordFixedCostPayment({
    fixed_cost_id: data.id,
    amount,
    occurred_at: paidAt,
    vat_included: input.vat_included ?? true,
    notes: input.notes,
  });
  if (!isFinanceOk(pay)) {
    return { error: pay.error ?? "ההוצאה נשמרה אבל רישום התשלום נכשל" };
  }

  revalidateFixed();
  return { error: null, id: data.id };
}

export async function updateFinanceFixedCost(input: {
  id: string;
  title: string;
  vendor_name?: string;
  default_amount?: number | string | null;
  due_day?: number | string | null;
  notes?: string;
  is_active?: boolean;
  allocation_type: ExpenseAllocationType;
  allocations?: ExpenseSourceAllocation[];
  expense_kind?: ExpenseKind;
  /** Every expense in this module is paid — sync the linked payment. */
  paid_at?: string | null;
  vat_included?: boolean;
}): Promise<FinanceMutationResult> {
  const profile = await requireFinanceAccess();
  if (!input.id?.trim()) return { error: "חסר מזהה" };
  const title = input.title?.trim();
  if (!title) return { error: "חובה למלא שם הוצאה" };

  const allocationType: ExpenseAllocationType =
    input.allocation_type === "sources" ? "sources" : "office";
  const alloc = normalizeAllocations(allocationType, input.allocations);
  if (!alloc.ok) return { error: alloc.error };
  const allocRows = alloc.rows;

  const expenseKind = parseExpenseKind(input.expense_kind);
  const amount = parseOptionalAmount(input.default_amount);
  if (amount == null || amount <= 0) {
    return { error: "חובה למלא סכום ששולם" };
  }
  const dueDay =
    expenseKind === "variable" ? null : parseDueDay(input.due_day);
  if (
    expenseKind === "fixed" &&
    input.due_day != null &&
    input.due_day !== "" &&
    dueDay == null
  ) {
    return { error: "יום חיוב חייב להיות בין 1 ל־28" };
  }

  const paidAt = (input.paid_at?.trim() || new Date().toISOString().slice(0, 10));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidAt)) {
    return { error: "תאריך תשלום לא תקין" };
  }

  const category = categoryForAllocation(allocationType);
  const vendor = input.vendor_name?.trim() || null;
  const notes = input.notes?.trim() || null;

  const admin = createAdminClient();
  const { error } = await admin
    .from("finance_fixed_costs")
    .update({
      title,
      category,
      vendor_name: vendor,
      default_amount: amount,
      due_day: dueDay,
      notes,
      allocation_type: allocationType,
      expense_kind: expenseKind,
      is_active: input.is_active ?? true,
      updated_by: profile.id,
    })
    .eq("id", input.id);

  if (error) return { error: error.message };

  const allocErr = await replaceAllocations(admin, input.id, allocRows);
  if (allocErr) return { error: allocErr };

  const description = [title, vendor].filter(Boolean).join(" · ");
  const vatIncluded = input.vat_included ?? true;

  const { data: latestPay, error: payLookupError } = await admin
    .from("finance_entries")
    .select("id")
    .eq("fixed_cost_id", input.id)
    .eq("kind", "expense")
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (payLookupError) return { error: payLookupError.message };

  if (latestPay?.id) {
    const payUpdate = await updateFinanceEntry({
      id: latestPay.id,
      kind: "expense",
      category,
      amount,
      occurred_at: paidAt,
      vat_included: vatIncluded,
      description,
      notes: notes ?? undefined,
    });
    if (!isFinanceOk(payUpdate)) {
      return { error: payUpdate.error ?? "עדכון התשלום נכשל" };
    }
  } else {
    const pay = await recordFixedCostPayment({
      fixed_cost_id: input.id,
      amount,
      occurred_at: paidAt,
      vat_included: vatIncluded,
      notes: notes ?? undefined,
    });
    if (!isFinanceOk(pay)) {
      return { error: pay.error ?? "רישום התשלום נכשל" };
    }
  }

  revalidateFixed();
  return { error: null, id: input.id };
}

export async function deactivateFinanceFixedCost(
  id: string,
): Promise<FinanceMutationResult> {
  const profile = await requireFinanceAccess();
  if (!id?.trim()) return { error: "חסר מזהה" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("finance_fixed_costs")
    .update({ is_active: false, updated_by: profile.id })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidateFixed();
  return { error: null, id };
}

export async function recordFixedCostPayment(input: {
  fixed_cost_id: string;
  amount: number | string;
  occurred_at: string;
  vat_included: boolean;
  reference_number?: string;
  notes?: string;
}): Promise<FinanceMutationResult> {
  await requireFinanceAccess();
  const costId = input.fixed_cost_id?.trim();
  if (!costId) return { error: "חסר מזהה הוצאה" };

  const admin = createAdminClient();
  const { data: cost, error } = await admin
    .from("finance_fixed_costs")
    .select("id, title, category, vendor_name, is_active")
    .eq("id", costId)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!cost || !cost.is_active) return { error: "הוצאה קבועה לא נמצאה" };

  const description = [cost.title, cost.vendor_name]
    .filter(Boolean)
    .join(" · ");

  const result = await createFinanceEntry({
    kind: "expense",
    category: cost.category,
    amount: input.amount,
    occurred_at: input.occurred_at,
    vat_included: input.vat_included,
    description,
    reference_number: input.reference_number,
    notes: input.notes,
    fixed_cost_id: cost.id,
  });

  if (!isFinanceOk(result)) return result;
  revalidateFixed();
  return result;
}

export async function analyzeExpenseInvoice(formData: FormData): Promise<{
  error: string | null;
  vendor: string | null;
  amount: number | null;
  title: string | null;
  paidAt: string | null;
  vatIncluded: boolean | null;
  source: "ai" | "filename" | null;
}> {
  await requireFinanceAccess();
  const picked = readFormFile(formData);
  if (picked.error || !picked.file) {
    return {
      error: picked.error ?? "לא נבחר קובץ",
      vendor: null,
      amount: null,
      title: null,
      paidAt: null,
      vatIncluded: null,
      source: null,
    };
  }
  const file = picked.file;
  if (file.size <= 0) {
    return {
      error: "קובץ ריק",
      vendor: null,
      amount: null,
      title: null,
      paidAt: null,
      vatIncluded: null,
      source: null,
    };
  }
  if (file.size > MAX_FILE_BYTES) {
    return {
      error: "הקובץ גדול מ־20MB",
      vendor: null,
      amount: null,
      title: null,
      paidAt: null,
      vatIncluded: null,
      source: null,
    };
  }

  const mime = resolveInvoiceMime(file.name, file.type);
  if (!isAllowedInvoiceMime(mime)) {
    return {
      error: "מותר PDF או תמונה בלבד",
      vendor: null,
      amount: null,
      title: null,
      paidAt: null,
      vatIncluded: null,
      source: null,
    };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const result = await extractInvoiceFields({
    fileName: file.name,
    mime,
    bytes,
  });

  return {
    error: null,
    vendor: result.vendor,
    amount: result.amount,
    title: result.title,
    paidAt: result.paidAt,
    vatIncluded: result.vatIncluded,
    source: result.source,
  };
}

export async function uploadFixedCostInvoice(formData: FormData): Promise<
  FinanceMutationResult & {
    suggestedVendor?: string;
    invoice?: {
      storage_path: string;
      file_name: string;
      mime_type: string;
      uploaded_at: string;
    };
  }
> {
  const profile = await requireFinanceAccess();
  const costIdRaw = formData.get("fixed_cost_id");
  const costId =
    typeof costIdRaw === "string" && costIdRaw.trim() ? costIdRaw.trim() : "";
  if (!costId) return { error: "חסר מזהה הוצאה — שמרו את ההוצאה ואז העלו חשבונית" };

  const picked = readFormFile(formData);
  if (picked.error || !picked.file) return { error: picked.error ?? "לא נבחר קובץ" };
  const file = picked.file;
  if (file.size <= 0) return { error: "קובץ ריק" };
  if (file.size > MAX_FILE_BYTES) return { error: "הקובץ גדול מ־20MB" };

  const mime = resolveInvoiceMime(file.name, file.type);
  if (!isAllowedInvoiceMime(mime)) {
    return { error: "מותר PDF או תמונה בלבד" };
  }

  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("finance_fixed_costs")
    .select("id, invoice_storage_path, is_active")
    .eq("id", costId)
    .maybeSingle();
  if (existingError) return { error: existingError.message };
  if (!existing?.is_active) return { error: "הוצאה לא נמצאה" };

  const safeName = file.name.replace(/[^\w.\u0590-\u05FF\u00A0-\uFFFF\- ()]/g, "_");
  const path = `fixed-costs/${costId}/${Date.now()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, buffer, {
    contentType: mime || "application/octet-stream",
    upsert: false,
  });
  if (uploadError) return { error: uploadError.message };

  const uploadedAt = new Date().toISOString();
  const { error: updateError } = await admin
    .from("finance_fixed_costs")
    .update({
      invoice_storage_path: path,
      invoice_file_name: file.name,
      invoice_mime_type: mime || null,
      invoice_uploaded_at: uploadedAt,
      updated_by: profile.id,
    })
    .eq("id", costId);

  if (updateError) {
    await admin.storage.from(BUCKET).remove([path]);
    return { error: updateError.message };
  }

  if (
    existing.invoice_storage_path &&
    existing.invoice_storage_path !== path
  ) {
    await admin.storage.from(BUCKET).remove([existing.invoice_storage_path]);
  }

  revalidateFixed();
  return {
    error: null,
    id: costId,
    suggestedVendor: suggestVendorFromFileName(file.name),
    invoice: {
      storage_path: path,
      file_name: file.name,
      mime_type: mime,
      uploaded_at: uploadedAt,
    },
  };
}

export async function getFixedCostInvoiceUrl(
  costId: string,
): Promise<{ error: string | null; url: string | null; fileName: string | null; mimeType: string | null }> {
  await requireFinanceAccess();
  if (!costId?.trim()) return { error: "חסר מזהה", url: null, fileName: null, mimeType: null };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("finance_fixed_costs")
    .select("invoice_storage_path, invoice_file_name, invoice_mime_type, is_active")
    .eq("id", costId)
    .maybeSingle();
  if (error) return { error: error.message, url: null, fileName: null, mimeType: null };
  if (!data?.is_active || !data.invoice_storage_path) {
    return { error: null, url: null, fileName: null, mimeType: null };
  }
  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(data.invoice_storage_path, 60 * 10);
  if (signError) return { error: signError.message, url: null, fileName: null, mimeType: null };
  return {
    error: null,
    url: signed.signedUrl,
    fileName: data.invoice_file_name,
    mimeType: data.invoice_mime_type,
  };
}

export async function removeFixedCostInvoice(
  costId: string,
): Promise<FinanceMutationResult> {
  const profile = await requireFinanceAccess();
  if (!costId?.trim()) return { error: "חסר מזהה" };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("finance_fixed_costs")
    .select("invoice_storage_path")
    .eq("id", costId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (data?.invoice_storage_path) {
    await admin.storage.from(BUCKET).remove([data.invoice_storage_path]);
  }
  const { error: updateError } = await admin
    .from("finance_fixed_costs")
    .update({
      invoice_storage_path: null,
      invoice_file_name: null,
      invoice_mime_type: null,
      invoice_uploaded_at: null,
      updated_by: profile.id,
    })
    .eq("id", costId);
  if (updateError) return { error: updateError.message };
  revalidateFixed();
  return { error: null, id: costId };
}
