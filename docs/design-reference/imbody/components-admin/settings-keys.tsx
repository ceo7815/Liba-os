"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { saveIntegration, type IntegrationId } from "@/lib/admin/integrations";

const ids: IntegrationId[] = ["meta", "google", "tiktok", "linkedin", "analytics"];
const names: Record<IntegrationId, string> = {
  meta: "Meta Ads",
  google: "Google Ads",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  analytics: "Google Analytics",
};

export function SettingsKeys({ states }: { states: Record<IntegrationId, { connected: boolean; last4: string }> }) {
  const t = useTranslations("marketDesk");
  const [open, setOpen] = useState<IntegrationId | null>(null);
  return (
    <section className="work-sheet grid gap-3 px-4 py-4">
      <h2 className="text-sm font-semibold">{t("integrations")}</h2>
      <ul className="divide-y divide-border">
        {ids.map((id) => (
          <li key={id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <span className="font-medium">{names[id]}</span>
            <span className={states[id].connected ? "text-[#1d4333]" : "text-muted-foreground"}>{states[id].connected ? t("connected") : t("waiting")}</span>
            {states[id].last4 ? <span dir="ltr" className="text-xs text-muted-foreground">•••• {states[id].last4}</span> : null}
            <button type="button" onClick={() => setOpen(id)} className="h-8 rounded-full border border-border px-3 text-xs">{t("connect")}</button>
          </li>
        ))}
      </ul>
      {open ? (
        <form action={saveIntegration} className="grid max-w-sm gap-2">
          <input type="hidden" name="id" value={open} />
          <p className="text-xs text-muted-foreground">{t("keyHint")}</p>
          <input name="key" type="password" required minLength={8} autoComplete="off" placeholder={t("key")} className="h-10 rounded-xl border border-border bg-transparent px-3" />
          <div className="flex gap-2">
            <button type="submit" className="h-9 rounded-full bg-primary px-3 text-sm text-primary-foreground">{t("saveKey")}</button>
            <button type="button" onClick={() => setOpen(null)} className="h-9 px-3 text-sm">×</button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
