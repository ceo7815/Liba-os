"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/env";
import type { UserRole } from "@/lib/types";

export type UsersActionState = {
  error: string | null;
  success: string | null;
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

export async function inviteUser(
  _prev: UsersActionState,
  formData: FormData,
): Promise<UsersActionState> {
  await requireAdmin();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "employee") as UserRole;

  if (!email || !fullName) {
    return { error: "יש למלא שם מלא ואימייל.", success: null };
  }
  if (role !== "admin" && role !== "employee") {
    return { error: "תפקיד לא תקין.", success: null };
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
  }

  revalidatePath("/dashboard/users");
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

  revalidatePath("/dashboard/users");
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

  revalidatePath("/dashboard/users");
  return { error: null };
}
