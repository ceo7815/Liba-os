"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { canManageShemesh } from "@/lib/permissions/access";
import { pickShemeshGoogleCustomer, saveShemeshProvider, saveShemeshSurense, syncShemeshSources, testShemeshProvider } from "@/lib/shemesh/connect";
import { importInsurerRows, saveGrow, saveRivhit, testRivhit } from "@/lib/shemesh/connector-store";
import { INSURERS, type ColumnMapping, type InsurerId } from "@/lib/shemesh/insurer-import";

async function allowed() {
  const profile = await getCurrentProfile();
  return Boolean(profile && canManageShemesh(profile));
}

export async function connectShemeshProvider(_state: { error: string | null }, formData: FormData) {
  if (!(await allowed())) return { error: "אין הרשאה" };
  const provider = String(formData.get("provider") ?? "");
  if (provider !== "rivhit" && provider !== "grow" && provider !== "insurance") return { error: "ספק לא מוכר" };
  const result = await saveShemeshProvider(provider, String(formData.get("apiUrl") ?? ""), String(formData.get("secret") ?? ""));
  if (!result.error) revalidatePath("/shemesh/sources");
  return result;
}

export async function connectShemeshSurense(_state: { error: string | null }, formData: FormData) {
  if (!(await allowed())) return { error: "אין הרשאה" };
  const mode = String(formData.get("mode") ?? "same");
  if (mode !== "same" && mode !== "separate") return { error: "מצב לא מוכר" };
  const result = await saveShemeshSurense(mode, String(formData.get("clientId") ?? ""), String(formData.get("clientSecret") ?? ""));
  if (!result.error) revalidatePath("/shemesh/sources");
  return result;
}

export async function chooseShemeshGoogleCustomer(_state: { error: string | null }, formData: FormData) {
  if (!(await allowed())) return { error: "אין הרשאה" };
  const result = await pickShemeshGoogleCustomer(String(formData.get("customerId") ?? ""));
  if (!result.error) revalidatePath("/shemesh/sources");
  return result;
}

export async function saveRivhitForm(_state: { error: string | null; ops?: number }, formData: FormData) {
  if (!(await allowed())) return { error: "אין הרשאה" };
  const result = await saveRivhit(String(formData.get("companyId") ?? ""), String(formData.get("apiToken") ?? ""));
  if (!result.error) revalidatePath("/shemesh/sources");
  return result;
}

export async function testRivhitForm(_formData: FormData) {
  if (!(await allowed())) return;
  await testRivhit();
  revalidatePath("/shemesh/sources");
}

export async function saveGrowForm(_state: { error: string | null; webhookToken: string }, formData: FormData) {
  if (!(await allowed())) return { error: "אין הרשאה", webhookToken: "" };
  const result = await saveGrow({
    userId: String(formData.get("userId") ?? ""),
    pageCode: String(formData.get("pageCode") ?? ""),
    apiKey: String(formData.get("apiKey") ?? ""),
    environment: String(formData.get("environment") ?? "sandbox"),
  });
  if (!result.error) revalidatePath("/shemesh/sources");
  return result;
}

export async function importInsurerForm(_state: { error: string | null; headers?: string[]; inserted?: number; skipped?: number }, formData: FormData) {
  if (!(await allowed())) return { error: "אין הרשאה" };
  const company = String(formData.get("company") ?? "");
  if (!INSURERS.some((item) => item.id === company)) return { error: "חברה לא מוכרת" };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "חסר קובץ" };
  const mapping: ColumnMapping = {
    policy: String(formData.get("policy") ?? "") || undefined,
    client: String(formData.get("client") ?? "") || undefined,
    premium: String(formData.get("premium") ?? "") || undefined,
    commission: String(formData.get("commission") ?? "") || undefined,
    date: String(formData.get("date") ?? "") || undefined,
  };
  const result = await importInsurerRows({
    company: company as InsurerId,
    fileName: file.name,
    bytes: new Uint8Array(await file.arrayBuffer()),
    mapping,
  });
  if (!result.error) {
    revalidatePath("/shemesh/insurance");
    revalidatePath("/shemesh/settlement");
  }
  return {
    error: result.error,
    headers: result.headers,
    inserted: result.inserted,
    skipped: result.skipped,
    messages: result.preview?.errors ?? [],
  };
}

export async function testShemeshProviderForm(formData: FormData) {
  if (!(await allowed())) return;
  const provider = String(formData.get("provider") ?? "");
  if (provider !== "rivhit" && provider !== "grow" && provider !== "insurance") return;
  await testShemeshProvider(provider);
  revalidatePath("/shemesh/sources");
}

export async function runShemeshSync() {
  const profile = await getCurrentProfile();
  if (!profile || !canManageShemesh(profile)) return { ok: true, notes: [] };
  const result = await syncShemeshSources();
  revalidatePath("/shemesh/sources");
  revalidatePath("/interfaces");
  return result;
}
