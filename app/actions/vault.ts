"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptVaultSecret, encryptVaultSecret } from "@/lib/vault/crypto";
import {
  isVaultCategory,
  type VaultCategory,
  type VaultEntryMeta,
} from "@/lib/vault/categories";

export type VaultListResult =
  | { error: null; entries: VaultEntryMeta[] }
  | { error: string; entries: VaultEntryMeta[] };

export type VaultMutationResult =
  | { error: null; id?: string }
  | { error: string };

export type VaultRevealResult =
  | { error: null; password: string }
  | { error: string; password?: undefined };

function mapMeta(row: {
  id: string;
  title: string;
  username: string | null;
  description: string | null;
  category: string;
  system_type?: string | null;
  login_url?: string | null;
  created_at: string;
  updated_at: string;
}): VaultEntryMeta {
  return {
    id: row.id,
    title: row.title,
    username: row.username,
    description: row.description,
    category: (isVaultCategory(row.category) ? row.category : "other") as VaultCategory,
    system_type: row.system_type ?? null,
    login_url: row.login_url ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    has_password: true,
  };
}

function normalizeLoginUrl(raw: string | undefined): string | null {
  const v = raw?.trim() || "";
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

export async function listVaultEntries(options?: {
  query?: string;
  category?: string | "all";
}): Promise<VaultListResult> {
  await requireProfile();
  const supabase = createClient();

  let q = supabase
    .from("vault_entries")
    .select(
      "id, title, username, description, category, system_type, login_url, created_at, updated_at",
    )
    .order("updated_at", { ascending: false });

  const category = options?.category;
  if (category && category !== "all" && isVaultCategory(category)) {
    q = q.eq("category", category);
  }

  const search = options?.query?.trim();
  if (search) {
    const safe = search.replace(/[%_]/g, " ").replace(/\s+/g, " ").trim();
    if (safe) {
      q = q.ilike("search_text", `%${safe}%`);
    }
  }

  const { data, error } = await q.limit(200);
  if (error) {
    return { error: error.message, entries: [] };
  }

  return {
    error: null,
    entries: (data ?? []).map(mapMeta),
  };
}

export async function revealVaultPassword(
  entryId: string,
): Promise<VaultRevealResult> {
  await requireProfile();

  if (!entryId?.trim()) {
    return { error: "חסר מזהה רשומה" };
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("vault_entries")
      .select("password_ciphertext")
      .eq("id", entryId)
      .maybeSingle();

    if (error) return { error: error.message };
    if (!data?.password_ciphertext) {
      return { error: "הרשומה לא נמצאה" };
    }

    const password = decryptVaultSecret(data.password_ciphertext);
    return { error: null, password };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "פענוח הסיסמה נכשל — בדקו את מפתח ההצפנה",
    };
  }
}

export async function createVaultEntry(input: {
  title: string;
  username?: string;
  password: string;
  description?: string;
  category: string;
  system_type?: string;
  login_url?: string;
}): Promise<VaultMutationResult> {
  const profile = await requireAdmin();

  const title = input.title?.trim();
  const password = input.password ?? "";
  if (!title) return { error: "חובה למלא שם" };
  if (!password) return { error: "חובה למלא סיסמה" };
  if (!isVaultCategory(input.category)) return { error: "קטגוריה לא תקינה" };

  const systemType =
    input.category === "other" ? input.system_type?.trim() || null : null;
  const loginUrl = normalizeLoginUrl(input.login_url);

  if (input.category === "other" && !systemType) {
    return { error: "בקטגוריה «אחר» חובה לציין מהי המערכת" };
  }

  try {
    const ciphertext = encryptVaultSecret(password);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("vault_entries")
      .insert({
        title,
        username: input.username?.trim() || null,
        password_ciphertext: ciphertext,
        description: input.description?.trim() || null,
        category: input.category,
        system_type: systemType,
        login_url: loginUrl,
        created_by: profile.id,
        updated_by: profile.id,
      })
      .select("id")
      .single();

    if (error || !data) {
      return { error: error?.message ?? "יצירת הרשומה נכשלה" };
    }

    revalidatePath("/vault");
    return { error: null, id: data.id };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "יצירת הרשומה נכשלה",
    };
  }
}

export async function updateVaultEntry(input: {
  id: string;
  title: string;
  username?: string;
  password?: string;
  description?: string;
  category: string;
  system_type?: string;
  login_url?: string;
}): Promise<VaultMutationResult> {
  const profile = await requireAdmin();

  if (!input.id?.trim()) return { error: "חסר מזהה" };
  const title = input.title?.trim();
  if (!title) return { error: "חובה למלא שם" };
  if (!isVaultCategory(input.category)) return { error: "קטגוריה לא תקינה" };

  const systemType =
    input.category === "other" ? input.system_type?.trim() || null : null;
  const loginUrl = normalizeLoginUrl(input.login_url);

  if (input.category === "other" && !systemType) {
    return { error: "בקטגוריה «אחר» חובה לציין מהי המערכת" };
  }

  try {
    const patch: Record<string, unknown> = {
      title,
      username: input.username?.trim() || null,
      description: input.description?.trim() || null,
      category: input.category,
      system_type: systemType,
      login_url: loginUrl,
      updated_by: profile.id,
    };

    if (input.password != null && input.password !== "") {
      patch.password_ciphertext = encryptVaultSecret(input.password);
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("vault_entries")
      .update(patch)
      .eq("id", input.id)
      .select("id")
      .maybeSingle();

    if (error) return { error: error.message };
    if (!data) return { error: "הרשומה לא נמצאה" };

    revalidatePath("/vault");
    return { error: null, id: data.id };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "עדכון הרשומה נכשל",
    };
  }
}

export async function deleteVaultEntry(
  entryId: string,
): Promise<VaultMutationResult> {
  await requireAdmin();

  if (!entryId?.trim()) return { error: "חסר מזהה" };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("vault_entries")
    .delete()
    .eq("id", entryId)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "הרשומה לא נמצאה או כבר נמחקה" };

  revalidatePath("/vault");
  return { error: null, id: data.id };
}
