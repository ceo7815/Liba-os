"use client";

import { useState } from "react";
import Link from "next/link";
import { PasswordField } from "@/components/auth/password-field";
import { authButtonClass, authFieldClass } from "@/components/auth/auth-styles";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function LoginForm({ disabledError }: { disabledError?: boolean }) {
  const [error, setError] = useState<string | null>(
    disabledError ? "החשבון הושבת. פנו למנהל המערכת." : null,
  );
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(form.get("password") ?? "");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await res.json()) as {
        error?: string;
        code?: string | null;
        status?: number | null;
        ok?: boolean;
      };

      if (!res.ok) {
        const technical = payload.error ?? "";
        if (/invalid login|invalid credentials|invalid email or password/i.test(technical)) {
          setError("אימייל או סיסמה שגויים. בדקו שהכתובת והסיסמה נכונים.");
        } else if (technical) {
          setError(technical);
        } else {
          setError("ההתחברות נכשלה.");
        }
        setPending(false);
        return;
      }

      // Full navigation is faster than soft RSC refresh after setting auth cookies.
      window.location.assign("/dashboard");
    } catch {
      setError("אין חיבור לשרת. רעננו את העמוד ונסו שוב.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" autoComplete="on">
      {error && (
        <p className="rounded-2xl border-2 border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-bold text-destructive break-words">
          {error}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-extrabold">
          אימייל
        </Label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          dir="ltr"
          placeholder="ceo@beosystem.com"
          defaultValue="ceo@beosystem.com"
          className={authFieldClass}
        />
      </div>
      <PasswordField
        id="password"
        name="password"
        label="סיסמה"
        autoComplete="current-password"
      />
      <Button type="submit" disabled={pending} className={authButtonClass}>
        {pending ? "מתחבר..." : "התחברות"}
      </Button>
      <p className="pt-1 text-center text-sm font-bold">
        <Link
          href="/forgot-password"
          className="text-foreground underline-offset-4 transition-colors hover:text-black hover:underline"
        >
          שכחתי סיסמה
        </Link>
      </p>
    </form>
  );
}
