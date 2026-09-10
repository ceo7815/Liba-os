"use server";

import { revalidatePath } from "next/cache";
import { requireEmployeesAccess } from "@/lib/auth";
import { excelAgentKey } from "@/lib/employees/excel-sellers";
import {
  parseAttendanceDays,
  parseAttendanceHoursWorkbook,
  type AttendanceDay,
  type EmployeeHoursRow,
} from "@/lib/employees/hours";
import { createAdminClient } from "@/lib/supabase/admin";
import { canonicalAgentName } from "@/lib/sales-dashboard/campaign-math";

const MAX_BYTES = 8 * 1024 * 1024;

function monthKey(value: string): string | null {
  const match = value.trim().match(/^(\d{4}-\d{2})/);
  return match?.[1] ?? null;
}

function mapHour(row: Record<string, unknown>): EmployeeHoursRow {
  return {
    employeeId: String(row.employee_id),
    fullName: String(row.full_name ?? ""),
    month: String(row.month),
    hours: Number(row.hours) || 0,
    source: String(row.source ?? "manual"),
    fileName: (row.file_name as string | null) ?? null,
    uploadedAt: String(row.uploaded_at ?? ""),
    days: parseAttendanceDays(row.days),
  };
}

export async function listEmployeeHours(employeeId?: string): Promise<{
  error: string | null;
  hours: EmployeeHoursRow[];
}> {
  await requireEmployeesAccess();
  const admin = createAdminClient();
  let query = admin
    .from("finance_employee_hours")
    .select("employee_id, month, hours, source, file_name, uploaded_at, days")
    .order("month", { ascending: false });
  if (employeeId) query = query.eq("employee_id", employeeId);
  const [{ data, error }, list] = await Promise.all([
    query,
    admin.from("finance_employees").select("id, full_name"),
  ]);
  if (error) {
    if (/does not exist/i.test(error.message) || /schema cache/i.test(error.message)) {
      return { error: null, hours: [] };
    }
    return { error: error.message, hours: [] };
  }
  const names = new Map(
    (list.data ?? []).map((row) => [String(row.id), String(row.full_name)] as const),
  );
  return {
    error: null,
    hours: (data ?? []).map((row) =>
      mapHour({ ...row, full_name: names.get(String(row.employee_id)) ?? "" }),
    ),
  };
}

export async function saveEmployeeMonthHours(input: {
  employeeId: string;
  month: string;
  hours: number;
}): Promise<{ error: string | null }> {
  await requireEmployeesAccess();
  const month = monthKey(input.month);
  if (!input.employeeId || !month) return { error: "חסרים עובד או חודש" };
  const hours = Math.max(0, Number(input.hours) || 0);
  const admin = createAdminClient();
  const { error } = await admin.from("finance_employee_hours").upsert(
    {
      employee_id: input.employeeId,
      month,
      hours,
      source: "manual",
      file_name: null,
      uploaded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "employee_id,month" },
  );
  if (error) return { error: error.message };
  revalidatePath("/employees");
  revalidatePath("/employees/payroll");
  return { error: null };
}

export async function importEmployeeHoursFromExcel(formData: FormData): Promise<{
  error: string | null;
  updated: number;
  unmatched: string[];
  months: string[];
  assignedName: string | null;
}> {
  await requireEmployeesAccess();
  const file = formData.get("file");
  const onlyEmployeeId = String(formData.get("employeeId") ?? "").trim();
  if (!(file instanceof File)) {
    return { error: "לא נבחר קובץ אקסל", updated: 0, unmatched: [], months: [], assignedName: null };
  }
  if (file.size > MAX_BYTES) {
    return { error: "הקובץ גדול מדי", updated: 0, unmatched: [], months: [], assignedName: null };
  }

  let parsed;
  try {
    parsed = parseAttendanceHoursWorkbook(Buffer.from(await file.arrayBuffer()), file.name);
  } catch {
    return {
      error: "לא הצלחנו לקרוא את קובץ השעות",
      updated: 0,
      unmatched: [],
      months: [],
      assignedName: null,
    };
  }
  if (parsed.length === 0) {
    return {
      error:
        "לא נמצאו שורות שעות. מעלים את דוח הנוכחות של העובד: שם, טווח תאריכים ועמודת «שעות משולמות».",
      updated: 0,
      unmatched: [],
      months: [],
      assignedName: null,
    };
  }

  const admin = createAdminClient();
  const { data: employees, error: listError } = await admin
    .from("finance_employees")
    .select("id, full_name");
  if (listError) {
    return { error: listError.message, updated: 0, unmatched: [], months: [], assignedName: null };
  }

  const byKey = new Map(
    (employees ?? []).flatMap((row) => {
      const mapped = [excelAgentKey(String(row.full_name)), excelAgentKey(canonicalAgentName(String(row.full_name)))];
      return mapped
        .filter(Boolean)
        .map((key) => [key, row] as const);
    }),
  );
  const target = onlyEmployeeId
    ? (employees ?? []).find((row) => row.id === onlyEmployeeId) ?? null
    : null;
  const namesInFile = Array.from(new Set(parsed.map((line) => excelAgentKey(line.name))));
  const unmatched = new Set<string>();
  const months = new Set<string>();
  let assignedName: string | null = null;
  const rows: {
    employee_id: string;
    month: string;
    hours: number;
    source: string;
    file_name: string;
    uploaded_at: string;
    updated_at: string;
    days: AttendanceDay[];
  }[] = [];

  for (const line of parsed) {
    let employee =
      byKey.get(excelAgentKey(line.name)) ??
      byKey.get(excelAgentKey(canonicalAgentName(line.name))) ??
      null;
    if (onlyEmployeeId) {
      if (employee && employee.id !== onlyEmployeeId) continue;
      if (!employee && namesInFile.length === 1 && target) {
        employee = target;
        assignedName = line.name;
      }
    }
    if (!employee) {
      unmatched.add(line.name);
      continue;
    }
    months.add(line.month);
    rows.push({
      employee_id: employee.id,
      month: line.month,
      hours: Math.round(line.hours * 100) / 100,
      source: "excel",
      file_name: file.name,
      uploaded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      days: line.days,
    });
  }

  if (rows.length === 0) {
    return {
      error: unmatched.size > 0 ? "השמות באקסל לא תואמים לכרטיס העובד" : "אין שורות לייבוא",
      updated: 0,
      unmatched: Array.from(unmatched),
      months: [],
      assignedName: null,
    };
  }

  const { error } = await admin.from("finance_employee_hours").upsert(rows, {
    onConflict: "employee_id,month",
  });
  if (error) {
    return {
      error: error.message,
      updated: 0,
      unmatched: Array.from(unmatched),
      months: [],
      assignedName: null,
    };
  }
  revalidatePath("/employees");
  revalidatePath("/employees/payroll");
  revalidatePath("/finance");
  return {
    error: null,
    updated: rows.length,
    unmatched: Array.from(unmatched),
    months: Array.from(months).sort(),
    assignedName,
  };
}
