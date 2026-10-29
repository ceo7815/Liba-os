"use client";

import Image from "next/image";
import { useState } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { OS_SYSTEM_COOKIE, osSystemHome, type OsSystem } from "@/lib/systems";

function rememberSystem(system: OsSystem) {
  document.cookie = `${OS_SYSTEM_COOKIE}=${system}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function SystemGate({
  disabledError,
  signedIn = false,
}: {
  disabledError?: boolean;
  signedIn?: boolean;
}) {
  const [system, setSystem] = useState<OsSystem | null>(null);

  function choose(next: OsSystem) {
    rememberSystem(next);
    if (signedIn) {
      window.location.assign(osSystemHome(next));
      return;
    }
    setSystem(next);
  }

  if (!system) {
    return (
      <AuthCard
        brand="chooser"
        title="בחירת מערכת"
        description="בחרו לאיזו מערכת להיכנס"
        footer="ליבה · שמש"
      >
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => choose("liba")}
            className="auth-choice flex min-h-11 w-full cursor-pointer flex-col items-center rounded-lg border border-border bg-card px-4 py-4 text-center shadow-card"
          >
            <span className="logo-plate rounded-md px-3 py-1">
            <Image
              src="/brand/liba-logo.png"
              alt="ליבה"
              width={320}
              height={120}
              className="h-14 w-auto object-contain"
            />
            </span>
            <span className="mt-1 text-sm font-semibold text-[#5c5c5c]">
              המערכת הקיימת
            </span>
          </button>
          <button
            type="button"
            onClick={() => choose("shemesh")}
            className="auth-choice auth-choice-shemesh flex min-h-11 w-full cursor-pointer flex-col items-center rounded-lg border border-border bg-card px-4 py-3 text-center shadow-card"
          >
            <span className="logo-plate rounded-md px-2 py-1">
            <Image
              src="/brand/shemesh-logo.png"
              alt="שמש מימוש זכויות"
              width={605}
              height={782}
              className="h-24 w-auto object-contain"
            />
            </span>
          </button>
        </div>
      </AuthCard>
    );
  }

  const isShemesh = system === "shemesh";

  return (
    <AuthCard
      brand={isShemesh ? "shemesh" : "liba"}
      title={isShemesh ? "התחברות לשמש" : "התחברות לליבה"}
      description={
        isShemesh
          ? "גישה מאובטחת למערכת של שמש"
          : "גישה מאובטחת לפלטפורמת הניהול הפנימית של ליבה"
      }
      footer={
        isShemesh
          ? "© שמש · מערכת פנימית"
          : "© ליבה ביטוח ופנסיוני · מערכת פנימית"
      }
    >
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => setSystem(null)}
          className="inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          חזרה לבחירת מערכת
        </button>
        <LoginForm disabledError={disabledError} redirectTo={osSystemHome(system)} />
      </div>
    </AuthCard>
  );
}
