"use server";

import { revalidatePath } from "next/cache";
import {
  canAccessFinance,
  canAccessSourcePnl,
  requireEmployeesAccess,
  requireFinanceAccess,
  requireProfile,
} from "@/lib/auth";
import { canViewEmployees } from "@/lib/permissions/access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolveSupplierCategory,
  type FinanceEmployee,
  type FinanceMutationResult,
  type FinanceSupplier,
} from "@/lib/finance/categories";
import {
  currentAgreement,
  currentEmploymentKind,
  parseEmploymentKind,
  parsePayAgreements,
  parsePayContract,
  serializePayAgreements,
  withResolvedOneTimePayments,
  type EmployeeAgreement,
} from "@/lib/employees/contract";
import { type SellerHint } from "@/lib/employees/excel-sellers";
import { applyExcelEmployeeCatalog } from "@/lib/employees/sync-from-excel";

function mapEmployee(row: Record<string, unknown>): FinanceEmployee {
  const kind = parseEmploymentKind(row.employment_kind);
  const agreements = parsePayAgreements(row.pay_contract, kind).map((agreement) => ({
    ...agreement,
    contract: withResolvedOneTimePayments(agreement.contract),
  }));
  const current = currentAgreement(agreements);
  return {
    id: String(row.id),
    full_name: String(row.full_name),
    department: (row.department as string | null) ?? null,
    short_dial: (row.short_dial as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    direct_phone: (row.direct_phone as string | null) ?? null,
    outbound_number: (row.outbound_number as string | null) ?? null,
    sim_provider: (row.sim_provider as string | null) ?? null,
    wait_circle: (row.wait_circle as string | null) ?? null,
    dialer_type: (row.dialer_type as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at),
    employment_kind: current?.employmentKind ?? kind,
    pay_contract: current?.contract ?? parsePayContract(row.pay_contract),
    agreements,
  };
}

function mapSupplier(row: Record<string, unknown>): FinanceSupplier {
  return {
    id: String(row.id),
    name: String(row.name),
    category: (row.category as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    contact_name: (row.contact_name as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at),
  };
}

const EMPLOYEE_COLS =
  "id, full_name, department, short_dial, email, direct_phone, outbound_number, sim_provider, wait_circle, dialer_type, notes, is_active, created_at, employment_kind, pay_contract";
const SUPPLIER_COLS =
  "id, name, category, phone, email, contact_name, notes, is_active, created_at";

export async function listFinanceEmployees(): Promise<{
  error: string | null;
  employees: FinanceEmployee[];
}> {
  await requireEmployeesAccess();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("finance_employees")
    .select(EMPLOYEE_COLS)
    .order("full_name", { ascending: true });
  if (error) return { error: error.message, employees: [] };
  return {
    error: null,
    employees: (data ?? []).map((row) => mapEmployee(row)),
  };
}

export async function getFinanceEmployee(id: string): Promise<{
  error: string | null;
  employee: FinanceEmployee | null;
}> {
  await requireEmployeesAccess();
  if (!id?.trim()) return { error: "חסר מזהה", employee: null };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("finance_employees")
    .select(EMPLOYEE_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) return { error: error.message, employee: null };
  if (!data) return { error: null, employee: null };
  return { error: null, employee: mapEmployee(data) };
}

export async function createFinanceEmployee(input: {
  full_name: string;
  department?: string;
  short_dial?: string;
  email?: string;
  direct_phone?: string;
  outbound_number?: string;
  sim_provider?: string;
  wait_circle?: string;
  dialer_type?: string;
  notes?: string;
}): Promise<FinanceMutationResult> {
  await requireEmployeesAccess();
  const name = input.full_name?.trim();
  if (!name) return { error: "חובה למלא שם" };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("finance_employees")
    .insert({
      full_name: name,
      department: input.department?.trim() || null,
      short_dial: input.short_dial?.trim() || null,
      email: input.email?.trim() || null,
      direct_phone: input.direct_phone?.trim() || null,
      outbound_number: input.outbound_number?.trim() || null,
      sim_provider: input.sim_provider?.trim() || null,
      wait_circle: input.wait_circle?.trim() || null,
      dialer_type: input.dialer_type?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "שמירה נכשלה" };
  revalidatePath("/finance");
  revalidatePath("/employees");
  revalidatePath("/employees/payroll");
  revalidatePath("/employees/agreements");
  return { error: null, id: data.id };
}

export async function updateFinanceEmployee(input: {
  id: string;
  full_name: string;
  department?: string;
  short_dial?: string;
  email?: string;
  direct_phone?: string;
  outbound_number?: string;
  sim_provider?: string;
  wait_circle?: string;
  dialer_type?: string;
  notes?: string;
  is_active?: boolean;
}): Promise<FinanceMutationResult> {
  await requireEmployeesAccess();
  if (!input.id?.trim()) return { error: "חסר מזהה" };
  const name = input.full_name?.trim();
  if (!name) return { error: "חובה למלא שם" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("finance_employees")
    .update({
      full_name: name,
      department: input.department?.trim() || null,
      short_dial: input.short_dial?.trim() || null,
      email: input.email?.trim() || null,
      direct_phone: input.direct_phone?.trim() || null,
      outbound_number: input.outbound_number?.trim() || null,
      sim_provider: input.sim_provider?.trim() || null,
      wait_circle: input.wait_circle?.trim() || null,
      dialer_type: input.dialer_type?.trim() || null,
      notes: input.notes?.trim() || null,
      is_active: input.is_active ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (error) return { error: error.message };
  revalidatePath("/finance");
  revalidatePath("/employees");
  revalidatePath("/employees/payroll");
  revalidatePath("/employees/agreements");
  return { error: null, id: input.id };
}

export async function deleteFinanceEmployee(
  id: string,
): Promise<FinanceMutationResult> {
  await requireEmployeesAccess();
  if (!id?.trim()) return { error: "חסר מזהה" };
  const admin = createAdminClient();
  const { error } = await admin.from("finance_employees").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/finance");
  revalidatePath("/employees");
  revalidatePath("/employees/payroll");
  revalidatePath("/employees/agreements");
  return { error: null, id };
}

export async function saveEmployeePayContract(input: {
  id: string;
  agreements: EmployeeAgreement[];
}): Promise<FinanceMutationResult> {
  await requireEmployeesAccess();
  if (!input.id?.trim()) return { error: "חסר מזהה" };
  const agreements = parsePayAgreements(
    serializePayAgreements(input.agreements),
    null,
  );
  const admin = createAdminClient();
  const { error } = await admin
    .from("finance_employees")
    .update({
      employment_kind: currentEmploymentKind(agreements),
      pay_contract: serializePayAgreements(agreements),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (error) return { error: error.message };
  revalidatePath("/finance");
  revalidatePath("/employees");
  revalidatePath("/employees/payroll");
  revalidatePath("/employees/agreements");
  revalidatePath("/finance/source-pnl");
  revalidatePath("/finance/settled");
  return { error: null, id: input.id };
}

export async function syncEmployeesFromExcel(input?: {
  sellers?: SellerHint[];
}): Promise<{
  error: string | null;
  added: number;
  found: number;
}> {
  const profile = await requireProfile();
  if (
    !canViewEmployees(profile) &&
    !canAccessSourcePnl(profile) &&
    !canAccessFinance(profile)
  ) {
    return { error: "אין הרשאה", added: 0, found: 0 };
  }
  return applyExcelEmployeeCatalog(input?.sellers ?? []);
}

export async function listFinanceSuppliers(): Promise<{
  error: string | null;
  suppliers: FinanceSupplier[];
}> {
  await requireFinanceAccess();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("finance_suppliers")
    .select(SUPPLIER_COLS)
    .order("name", { ascending: true });
  if (error) return { error: error.message, suppliers: [] };
  return {
    error: null,
    suppliers: (data ?? []).map((row) => mapSupplier(row)),
  };
}

export async function createFinanceSupplier(input: {
  name: string;
  category?: string;
  customCategory?: string;
  phone?: string;
  email?: string;
  contact_name?: string;
  notes?: string;
}): Promise<FinanceMutationResult> {
  await requireFinanceAccess();
  const name = input.name?.trim();
  if (!name) return { error: "חובה למלא שם ספק" };
  const resolved = resolveSupplierCategory({
    category: input.category,
    customCategory: input.customCategory,
  });
  if (resolved.error) return { error: resolved.error };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("finance_suppliers")
    .insert({
      name,
      category: resolved.category,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      contact_name: input.contact_name?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "שמירה נכשלה" };
  revalidatePath("/finance");
  revalidatePath("/employees");
  revalidatePath("/employees/payroll");
  revalidatePath("/employees/agreements");
  return { error: null, id: data.id };
}

export async function updateFinanceSupplier(input: {
  id: string;
  name: string;
  category?: string;
  customCategory?: string;
  phone?: string;
  email?: string;
  contact_name?: string;
  notes?: string;
  is_active?: boolean;
}): Promise<FinanceMutationResult> {
  await requireFinanceAccess();
  if (!input.id?.trim()) return { error: "חסר מזהה" };
  const name = input.name?.trim();
  if (!name) return { error: "חובה למלא שם ספק" };
  const resolved = resolveSupplierCategory({
    category: input.category,
    customCategory: input.customCategory,
  });
  if (resolved.error) return { error: resolved.error };
  const admin = createAdminClient();
  const { error } = await admin
    .from("finance_suppliers")
    .update({
      name,
      category: resolved.category,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      contact_name: input.contact_name?.trim() || null,
      notes: input.notes?.trim() || null,
      is_active: input.is_active ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (error) return { error: error.message };
  revalidatePath("/finance");
  revalidatePath("/employees");
  revalidatePath("/employees/payroll");
  revalidatePath("/employees/agreements");
  return { error: null, id: input.id };
}

export async function deleteFinanceSupplier(
  id: string,
): Promise<FinanceMutationResult> {
  await requireFinanceAccess();
  if (!id?.trim()) return { error: "חסר מזהה" };
  const admin = createAdminClient();
  const { error } = await admin.from("finance_suppliers").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/finance");
  revalidatePath("/employees");
  revalidatePath("/employees/payroll");
  revalidatePath("/employees/agreements");
  return { error: null, id };
}
