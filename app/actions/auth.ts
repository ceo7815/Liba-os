"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/env";

export type AuthActionState = {
  error: string | null;
  success?: string | null;
};

export async function signIn(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "יש למלא אימייל וסיסמה." };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const message = error.message?.toLowerCase() ?? "";
    if (message.includes("email") && message.includes("confirm")) {
      return { error: "יש לאשר את כתובת האימייל לפני ההתחברות." };
    }
    if (message.includes("invalid") || error.status === 400) {
      return { error: "אימייל או סיסמה שגויים. בדקו שהכתובת והסיסמה נכונים." };
    }
    return { error: "ההתחברות נכשלה. נסו שוב בעוד רגע." };
  }

  if (data.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!profile?.is_active) {
      await supabase.auth.signOut();
      return { error: "החשבון הושבת. פנו למנהל המערכת." };
    }
  }

  redirect("/dashboard");
}

export async function requestPasswordReset(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "יש למלא כתובת אימייל." };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getSiteUrl()}/auth/callback?next=/set-password`,
  });

  if (error) {
    return { error: "לא ניתן לשלוח קישור איפוס כרגע. נסו שוב." };
  }

  return {
    error: null,
    success: "אם הכתובת קיימת במערכת, נשלח אליה קישור לאיפוס סיסמה.",
  };
}

export async function updatePassword(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) {
    return { error: "הסיסמה חייבת להכיל לפחות 8 תווים." };
  }
  if (password !== confirm) {
    return { error: "הסיסמאות אינן תואמות." };
  }

  const supabase = createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) {
    return { error: "הקישור אינו תקין או שפג תוקפו. בקשו הזמנה או איפוס מחדש." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: "לא ניתן לעדכן את הסיסמה. נסו שוב." };
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
