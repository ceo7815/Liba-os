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
            className="flex w-full flex-col items-center rounded-2xl border-2 border-black/15 bg-white px-4 py-4 text-center transition hover:border-highlight hover:shadow-[0_12px_28px_-16px_rgba(17,17,17,0.45)]"
          >
            <Image
              src="/brand/liba-logo.png"
              alt="ליבה"
              width={320}
              height={120}
              className="h-14 w-auto object-contain"
            />
            <span className="mt-1 text-sm font-semibold text-[#5c5c5c]">
              המערכת הקיימת
            </span>
          </button>
          <button
            type="button"
            onClick={() => choose("shemesh")}
            className="flex w-full flex-col items-center rounded-2xl border-2 border-black/15 bg-white px-4 py-3 text-center transition hover:border-[#185A94] hover:shadow-[0_12px_28px_-16px_rgba(24,90,148,0.4)]"
          >
            <Image
              src="/brand/shemesh-logo.png"
              alt="שמש מימוש זכויות"
              width={605}
              height={782}
              className="h-24 w-auto object-contain"
            />
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
          className="text-sm font-bold text-[#5c5c5c] underline-offset-4 hover:text-black hover:underline"
        >
          חזרה לבחירת מערכת
        </button>
        <LoginForm disabledError={disabledError} redirectTo={osSystemHome(system)} />
      </div>
    </AuthCard>
  );
}
