"use client";

import { useLiveDashboard } from "@/components/layout/live-dashboard-provider";
import { formatLastUpdatedAt } from "@/lib/sales-dashboard/marketing-copy";

export function DashHero({ name, date }: { name: string; date: string }) {
  const { dashboard } = useLiveDashboard();
  const synced = formatLastUpdatedAt(dashboard?.syncedAt ?? null);

  return (
    <header className="glass glass-noise flex flex-wrap items-end justify-between gap-3 rounded-[1.15rem] px-4 py-4 sm:px-5">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground">ליבה</p>
        <h1 className="mt-1 text-2xl font-semibold leading-none tracking-tight sm:text-3xl">שלום, {name}</h1>
      </div>
      <div className="glass flex max-w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-full px-3 py-2 text-[11px] font-medium text-muted-foreground">
        <span>{date}</span>
        <span className="hidden h-3 w-px bg-border sm:block" aria-hidden />
        <span className="tabular-nums">{synced ? `עודכן ${synced}` : "טרם סונכרן"}</span>
      </div>
    </header>
  );
}
