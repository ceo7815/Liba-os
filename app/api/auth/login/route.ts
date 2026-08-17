import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/env";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase()
      .replace(/[\u200e\u200f\u202a-\u202e]/g, "");
    const password = String(body.password ?? "").replace(
      /[\u200e\u200f\u202a-\u202e]/g,
      "",
    );

    if (!email || !password) {
      return NextResponse.json(
        { error: "יש למלא אימייל וסיסמה." },
        { status: 400 },
      );
    }

    const cookieStore = cookies();
    const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    });

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code ?? null,
          status: error.status ?? null,
        },
        { status: 401 },
      );
    }

    if (data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", data.user.id)
        .maybeSingle();

      if (!profile) {
        return NextResponse.json(
          { error: "לא נמצא פרופיל למשתמש. פנו למנהל." },
          { status: 403 },
        );
      }

      if (!profile.is_active) {
        await supabase.auth.signOut();
        return NextResponse.json(
          { error: "החשבון הושבת. פנו למנהל המערכת." },
          { status: 403 },
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: `שגיאת שרת: ${message}` },
      { status: 500 },
    );
  }
}
