"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/env";
import type { UserRole } from "@/lib/types";
import {
  PERMISSION_KEYS,
  normalizePermissionKeys,
  type PermissionKey,
} from "@/lib/permissions/catalog";

export type UsersActionState = {
  error: string | null;
  success: string | null;
};

export type ManagedUser = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  permissionKeys: PermissionKey[];
};

async function countActiveAdmins(admin = createAdminClient()) {
  const { count, error } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("is_active", true);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

function bustProfileCache() {
  revalidateTag("profiles");
  revalidatePath("/dashboard/users");
  revalidatePath("/", "layout");
}

async function replacePermissions(
  profileId: string,
  keys: PermissionKey[],
  grantedBy: string | null,
) {
  const admin = createAdminClient();
  const unique = normalizePermissionKeys(keys);

  const { error: delError } = await admin
    .from("profile_permissions")
    .delete()
    .eq("profile_id", profileId);
  if (delError) throw new Error(delError.message);

  if (unique.length === 0) return;

  const { error: insError } = await admin.from("profile_permissions").insert(
    unique.map((permission_key) => ({
      profile_id: profileId,
      permission_key,
      granted: true,
      granted_by: grantedBy,
      updated_at: new Date().toISOString(),
    })),
  );
  if (insError) throw new Error(insError.message);
}

export async function listManagedUsers(): Promise<{
  error: string | null;
  users: ManagedUser[];
}> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data, error } = await admin.rpc(
    "admin_list_profiles_with_permissions",
  );

  if (error) {
    // Fallback if RPC not yet available in typed client
    const { data: profiles, error: pErr } = await admin
      .from("profiles")
      .select("id, email, full_name, role, is_active, created_at")
      .order("created_at", { ascending: true });
    if (pErr) return { error: pErr.message, users: [] };

    const ids = (profiles ?? []).map((p) => p.id);
    const { data: perms } = await admin
      .from("profile_permissions")
      .select("profile_id, permission_key")
      .in("profile_id", ids)
      .eq("granted", true);

    const byUser = new Map<string, string[]>();
    for (const row of perms ?? []) {
      const id = String(row.profile_id);
      const list = byUser.get(id) ?? [];
      list.push(String(row.permission_key));
      byUser.set(id, list);
    }

    return {
      error: null,
      users: (profiles ?? []).map((p) => ({
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        role: p.role as UserRole,
        is_active: p.is_active,
        created_at: p.created_at,
        permissionKeys: normalizePermissionKeys(byUser.get(p.id) ?? []),
      })),
    };
  }

  const users: ManagedUser[] = (data ?? []).map(
    (row: {
      id: string;
      email: string;
      full_name: string;
      role: UserRole;
      is_active: boolean;
      created_at: string;
      permission_keys: string[] | null;
    }) => ({
      id: row.id,
      email: row.email,
      full_name: row.full_name,
      role: row.role,
      is_active: row.is_active,
      created_at: row.created_at,
      permissionKeys: normalizePermissionKeys(row.permission_keys ?? []),
    }),
  );

  return { error: null, users };
}

export async function inviteUser(
  _prev: UsersActionState,
  formData: FormData,
): Promise<UsersActionState> {
  const actor = await requireAdmin();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "employee") as UserRole;
  const rawKeys = String(formData.get("permission_keys") ?? "");

  let permissionKeys: PermissionKey[] = [];
  try {
    const parsed = JSON.parse(rawKeys || "[]") as unknown;
    if (Array.isArray(parsed)) {
      permissionKeys = normalizePermissionKeys(parsed.map(String));
    }
  } catch {
    return { error: "הרשאות לא תקינות.", success: null };
  }

  if (!email || !fullName) {
    return { error: "יש למלא שם מלא ואימייל.", success: null };
  }
  if (role !== "admin" && role !== "employee") {
    return { error: "תפקיד לא תקין.", success: null };
  }
  if (permissionKeys.length === 0) {
    return { error: "יש לבחור לפחות הרשאה אחת.", success: null };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${getSiteUrl()}/auth/callback?next=/set-password`,
  });

  if (error || !data.user) {
    return {
      error: error?.message?.includes("already")
        ? "משתמש עם אימייל זה כבר קיים."
        : "שליחת ההזמנה נכשלה. בדקו את הגדרות האימייל ב-Supabase.",
      success: null,
    };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ full_name: fullName, role })
    .eq("id", data.user.id);

  if (profileError) {
    return {
      error: "המשתמש הוזמן, אך עדכון הפרופיל נכשל. רעננו וניסו שוב.",
      success: null,
    };
  }

  const admins = await countActiveAdmins(admin);
  if (admins === 0) {
    await admin.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
    permissionKeys = [...PERMISSION_KEYS];
  }

  try {
    await replacePermissions(data.user.id, permissionKeys, actor.id);
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "המשתמש הוזמן, אך שמירת ההרשאות נכשלה.",
      success: null,
    };
  }

  bustProfileCache();
  return { error: null, success: `הזמנה נשלחה אל ${email}.` };
}

export async function updateUserRole(userId: string, role: UserRole) {
  const actor = await requireAdmin();
  if (role !== "admin" && role !== "employee") {
    return { error: "תפקיד לא תקין." };
  }

  const admin = createAdminClient();

  if (actor.id === userId && role !== "admin") {
    const admins = await countActiveAdmins(admin);
    if (admins <= 1) {
      return { error: "לא ניתן להוריד את המנהל האחרון הפעיל." };
    }
  }

  if (role !== "admin") {
    const { data: target } = await admin
      .from("profiles")
      .select("role, is_active")
      .eq("id", userId)
      .maybeSingle();

    if (target?.role === "admin" && target.is_active) {
      const admins = await countActiveAdmins(admin);
      if (admins <= 1) {
        return { error: "לא ניתן להוריד את המנהל האחרון הפעיל." };
      }
    }
  }

  const { error } = await admin.from("profiles").update({ role }).eq("id", userId);
  if (error) {
    return { error: "עדכון התפקיד נכשל." };
  }

  bustProfileCache();
  return { error: null };
}

export async function setUserActive(userId: string, isActive: boolean) {
  const actor = await requireAdmin();
  const admin = createAdminClient();

  if (!isActive) {
    if (actor.id === userId) {
      return { error: "לא ניתן להשבית את החשבון שלכם." };
    }

    const { data: target } = await admin
      .from("profiles")
      .select("role, is_active")
      .eq("id", userId)
      .maybeSingle();

    if (target?.role === "admin" && target.is_active) {
      const admins = await countActiveAdmins(admin);
      if (admins <= 1) {
        return { error: "לא ניתן להשבית את המנהל האחרון הפעיל." };
      }
    }
  }

  const { error } = await admin
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", userId);

  if (error) {
    return { error: "עדכון הסטטוס נכשל." };
  }

  if (!isActive) {
    await admin.auth.admin.signOut(userId, "global");
    await admin.auth.admin.updateUserById(userId, {
      ban_duration: "876000h",
    });
  } else {
    await admin.auth.admin.updateUserById(userId, {
      ban_duration: "none",
    });
  }

  bustProfileCache();
  return { error: null };
}

export async function saveUserPermissions(
  userId: string,
  keys: string[],
): Promise<{ error: string | null }> {
  const actor = await requireAdmin();
  const permissionKeys = normalizePermissionKeys(keys);

  if (permissionKeys.length === 0) {
    return { error: "יש לבחור לפחות הרשאה אחת." };
  }

  // Never lock yourself out of user management.
  if (actor.id === userId && !permissionKeys.includes("org.users")) {
    return { error: "לא ניתן להסיר מעצמכם את ניהול המשתמשים." };
  }

  try {
    await replacePermissions(userId, permissionKeys, actor.id);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "שמירת ההרשאות נכשלה.",
    };
  }

  bustProfileCache();
  return { error: null };
}
