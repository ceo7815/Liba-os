"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { money } from "@/lib/admin/money";
import { saveIntegration, type IntegrationId } from "@/lib/admin/integrations";

const networks: IntegrationId[] = ["meta", "google", "tiktok", "linkedin", "analytics"];

export function MarketingBoard({
  rows,
  states,
  children,
}: {
  rows: { id: string; name: string; channel: string; spend: number; leads: number; cpl: number | null; roas: number | null }[];
  states: Record<IntegrationId, { connected: boolean; last4: string }>;
  children: React.ReactNode;
}) {
  const t = useTranslations("marketDesk");
  const channelLabel = (key: string) => {
    const known = ["meta", "tiktok", "linkedin", "whatsapp", "referral", "other"] as const;
    return (known as readonly string[]).includes(key) ? t(`channels.${key}`) : key;
  };
  const [open, setOpen] = useState<IntegrationId | null>(null);
  const [channel, setChannel] = useState("all");
  const shown = channel === "all" ? rows : rows.filter((row) => row.channel === channel);
  const max = Math.max(...shown.map((row) => row.spend), 1);
  const channels = [...new Set(rows.map((row) => row.channel))];

  return (
    <div className="grid gap-4">
      <section className="grid gap-3">
        <h2 className="text-sm font-semibold">{t("integrations")}</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {networks.map((id) => {
            const state = states[id];
            return (
              <article key={id} className="work-sheet grid gap-2 px-4 py-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{id === "google" ? "Google Ads" : id === "analytics" ? "Google Analytics" : id === "meta" ? "Meta Ads" : id === "tiktok" ? "TikTok" : "LinkedIn"}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${state.connected ? "bg-[#e7f0eb] text-[#1d4333]" : "bg-muted text-muted-foreground"}`}>
                    {state.connected ? t("connected") : t("waiting")}
                  </span>
                </div>
                <p className="min-h-10 text-xs text-muted-foreground">{t(`unlocks.${id}`)}</p>
                <button type="button" onClick={() => setOpen(id)} className="press h-9 rounded-full border border-border text-sm">{t("connect")}</button>
                {state.last4 ? <p className="text-[11px] text-muted-foreground" dir="ltr">•••• {state.last4}</p> : null}
              </article>
            );
          })}
        </div>
      </section>
      {open ? (
        <form action={saveIntegration} className="work-sheet grid max-w-md gap-2 px-4 py-4">
          <input type="hidden" name="id" value={open} />
          <p className="text-sm font-medium">{t("connect")}</p>
          <p className="text-xs text-muted-foreground">{t("keyHint")}</p>
          <input name="key" type="password" required minLength={8} autoComplete="off" placeholder={t("key")} className="h-10 rounded-xl border border-border bg-transparent px-3" />
          <div className="flex gap-2">
            <button type="submit" className="h-9 rounded-full bg-primary px-4 text-sm text-primary-foreground">{t("saveKey")}</button>
            <button type="button" onClick={() => setOpen(null)} className="h-9 rounded-full px-4 text-sm">×</button>
          </div>
        </form>
      ) : null}
      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{t("performance")}</h2>
          <select value={channel} onChange={(event) => setChannel(event.target.value)} className="h-9 rounded-full border border-border bg-transparent px-3 text-sm">
            <option value="all">{t("campaigns")}</option>
            {channels.map((item) => <option key={item} value={item}>{channelLabel(item)}</option>)}
          </select>
        </div>
        <ul className="work-sheet grid gap-2 px-4 py-4">
          {shown.map((row) => (
            <li key={row.id} className="grid grid-cols-[8rem_1fr_auto] items-center gap-3 text-sm">
              <span className="truncate">{row.name}</span>
              <span className="h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(6, (row.spend / max) * 100)}%` }} /></span>
              <span dir="ltr" className="tabular-nums text-muted-foreground">{money(row.spend)}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="work-sheet overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="px-4 py-3 text-start font-medium">{t("name")}</th>
              <th className="px-3 py-3 text-start font-medium">{t("channel")}</th>
              <th className="px-3 py-3 text-end font-medium">{t("spend")}</th>
              <th className="px-3 py-3 text-end font-medium">{t("leads")}</th>
              <th className="px-3 py-3 text-end font-medium">CPL</th>
              <th className="px-4 py-3 text-end font-medium">{t("roas")}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{row.name}</td>
                <td className="px-3 py-3">{channelLabel(row.channel)}</td>
                <td className="px-3 py-3 text-end tabular-nums" dir="ltr">{money(row.spend)}</td>
                <td className="px-3 py-3 text-end tabular-nums" dir="ltr">{row.leads}</td>
                <td className="px-3 py-3 text-end tabular-nums" dir="ltr">{row.cpl == null ? "—" : money(row.cpl)}</td>
                <td className="px-4 py-3 text-end tabular-nums" dir="ltr">{row.roas == null ? "—" : row.roas.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {children}
    </div>
  );
}
