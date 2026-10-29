"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { canManageShemesh } from "@/lib/permissions/access";
import { pickShemeshGoogleCustomer, saveShemeshProvider, saveShemeshSurense, syncShemeshSources, testShemeshProvider } from "@/lib/shemesh/connect";

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
