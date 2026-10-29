"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { money } from "@/lib/admin/money";
import { setPayout, type PayoutStatus } from "@/lib/crm/payout-actions";

export type CommissionRep = {
  id: string;
  name: string;
  department: string;
  leads: number;
  won: number;
  lost: number;
  dealsWon: number;
  close: number;
  response: number | null;
  sales: number;
  commission: number;
  prevSales: number;
  weeks: number[];
  payout: PayoutStatus;
  deals: { id: string; number: number; title: string; status: string; value: number }[];
};

const tones = ["#1d4333", "#0b6e4f", "#8e24aa", "#1a73e8", "#e37400", "#5f6368"];
const departmentIds = ["sales", "service", "field", "marketing", "finance"] as const;

function spark(values: number[]) {
  const width = 84;
  const height = 28;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  return values.map((value, index) => `${index === 0 ? "M" : "L"} ${index * step} ${height - (value / max) * (height - 4) - 2}`).join(" ");
}

function trend(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export function CommissionBoard({
  rows,
  rate,
  today,
  target,
  pulse,
}: {
  rows: CommissionRep[];
  rate: number;
  today: string;
  target: number;
  pulse: { sales: number; prev: number };
}) {
  const t = useTranslations("commissionDesk");
  const dept = useTranslations("departments");
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [range, setRange] = useState(false);
  const ranked = useMemo(() => [...rows].filter((row) => row.id !== "none").sort((a, b) => b.sales - a.sales || a.name.localeCompare(b.name)), [rows]);
  const unassigned = rows.find((row) => row.id === "none");
  const totals = ranked.reduce((sum, row) => ({ sales: sum.sales + row.sales, commission: sum.commission + row.commission, leads: sum.leads + row.leads }), { sales: 0, commission: 0, leads: 0 });
  const selected = ranked.find((row) => row.id === open) ?? null;
  const max = Math.max(...ranked.map((row) => row.sales), 1);

  function download() {
    const header = ["name", "department", "leads", "deals_won", "close", "response_hours", "sales", "commission", "payout"];
    const lines = ranked.map((row) => [row.name, row.department, row.leads, row.dealsWon, row.close, row.response ?? "", row.sales, row.commission, row.payout].join(","));
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "commissions.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function monthChip(offset: number) {
    const [year, month] = today.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1 - offset, 1));
    const from = date.toISOString().slice(0, 10);
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    const label = new Intl.DateTimeFormat("he-IL", { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
    return { from, end: offset === 0 ? today : end, label };
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <a href="/admin/crm/commissions" className="press inline-flex h-9 items-center rounded-full border border-border px-3 text-sm">{t("all")}</a>
        {[7, 30, 90].map((count) => (
          <a key={count} href={`/admin/crm/commissions?days=${count}`} className="press inline-flex h-9 items-center rounded-full px-3 text-sm text-muted-foreground">{t("days", { count })}</a>
        ))}
        <button type="button" onClick={() => setRange((value) => !value)} className="press h-9 rounded-full border border-border px-3 text-sm">{t("range")}</button>
        <button type="button" onClick={download} className="press ms-auto h-9 rounded-full bg-primary px-3 text-sm text-primary-foreground">{t("export")}</button>
      </div>
      {range ? (
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2].map((offset) => {
            const chip = monthChip(offset);
            return <a key={chip.from} href={`/admin/crm/commissions?from=${chip.from}&to=${chip.end}`} className="rounded-full border border-border px-3 py-1 text-sm">{chip.label}</a>;
          })}
        </div>
      ) : null}
      <section className="grid gap-3 md:grid-cols-3">
        {[
          [t("leads"), String(totals.leads), 0],
          [t("sales"), money(totals.sales), trend(pulse.sales, pulse.prev)],
          [t("commission"), money(totals.commission), trend(Math.round(pulse.sales * rate) / 100, Math.round(pulse.prev * rate) / 100)],
        ].map(([label, value, delta]) => (
          <article key={String(label)} className="work-sheet px-4 py-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="kpi-num mt-1 text-3xl tabular-nums" dir="ltr">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground" dir="ltr">{typeof delta === "number" ? `${delta > 0 ? "+" : ""}${delta}%` : ""} {t("vsPrior")}</p>
          </article>
        ))}
      </section>
      <section className="grid gap-3 lg:grid-cols-[16rem_1fr]">
        <ol className="work-sheet grid gap-2 px-3 py-3">
          {ranked.slice(0, 5).map((row, index) => (
            <li key={row.id}>
              <button type="button" onClick={() => setOpen(row.id)} className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-start hover:bg-muted">
                <span className="w-4 text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                <span className="grid size-8 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: tones[index % tones.length] }}>{row.name.slice(0, 1)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{row.name}</span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-primary" style={{ width: `${Math.min(100, Math.round((row.sales / target) * 100))}%` }} /></span>
                </span>
              </button>
            </li>
          ))}
        </ol>
        <div className="work-sheet grid gap-3 px-4 py-4">
          <p className="text-sm font-medium">{t("chart")}</p>
          {ranked.map((row) => (
            <div key={row.id} className="grid grid-cols-[8rem_1fr_auto] items-center gap-3 text-sm">
              <span className="truncate">{row.name}</span>
              <span className="h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (row.sales / max) * 100)}%` }} /></span>
              <span dir="ltr" className="tabular-nums text-muted-foreground">{money(row.commission)}</span>
            </div>
          ))}
        </div>
      </section>
      <div className="work-sheet overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="px-4 py-3 text-start font-medium">{t("rep")}</th>
              <th className="px-3 py-3 text-end font-medium">{t("leads")}</th>
              <th className="px-3 py-3 text-end font-medium">{t("dealsWon")}</th>
              <th className="px-3 py-3 text-end font-medium">{t("close")}</th>
              <th className="px-3 py-3 text-end font-medium">{t("response")}</th>
              <th className="px-3 py-3 text-end font-medium">{t("sales")}</th>
              <th className="px-3 py-3 text-end font-medium">{t("commission")}</th>
              <th className="px-4 py-3 text-end font-medium">{t("payout")}</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((row, index) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <button type="button" onClick={() => setOpen(row.id)} className="flex items-center gap-2 text-start">
                    <span className="grid size-8 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: tones[index % tones.length] }}>{row.name.slice(0, 1)}</span>
                    <span>
                      <span className="block font-medium">{row.name}</span>
                      <span className="text-xs text-muted-foreground">{(departmentIds as readonly string[]).includes(row.department) ? dept(row.department as (typeof departmentIds)[number]) : ""}</span>
                    </span>
                    <svg viewBox="0 0 84 28" className="h-7 w-16 text-primary" aria-hidden><path d={spark(row.weeks)} fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
                  </button>
                </td>
                <td className="px-3 py-3 text-end tabular-nums" dir="ltr">{row.leads}</td>
                <td className="px-3 py-3 text-end tabular-nums" dir="ltr">{row.dealsWon}</td>
                <td className="px-3 py-3 text-end tabular-nums" dir="ltr">{row.won + row.lost === 0 ? "—" : `${row.close}%`}</td>
                <td className="px-3 py-3 text-end tabular-nums" dir="ltr">{row.response == null ? "—" : row.response}</td>
                <td className="px-3 py-3 text-end tabular-nums" dir="ltr">{money(row.sales)}</td>
                <td className="px-3 py-3 text-end tabular-nums" dir="ltr">{money(row.commission)}</td>
                <td className="px-4 py-3 text-end">
                  <span className="me-2 text-xs">{t(`payouts.${row.payout}`)}</span>
                  <span className="row-actions">
                  {row.payout === "pending" ? (
                    <form action={setPayout} className="inline"><input type="hidden" name="id" value={row.id} /><input type="hidden" name="status" value="approved" /><button className="text-xs text-primary" type="submit">{t("approve")}</button></form>
                  ) : null}
                  {row.payout === "approved" ? (
                    <form action={setPayout} className="inline"><input type="hidden" name="id" value={row.id} /><input type="hidden" name="status" value="paid" /><button className="text-xs text-primary" type="submit">{t("markPaid")}</button></form>
                  ) : null}
                  </span>
                </td>
              </tr>
            ))}
            {unassigned && unassigned.sales > 0 ? (
              <tr className="border-t border-border text-muted-foreground">
                <td className="px-4 py-3">{t("unassigned")}</td>
                <td className="px-3 py-3 text-end tabular-nums" dir="ltr">{unassigned.leads}</td>
                <td />
                <td />
                <td />
                <td className="px-3 py-3 text-end tabular-nums" dir="ltr">{money(unassigned.sales)}</td>
                <td className="px-3 py-3 text-end tabular-nums" dir="ltr">{money(unassigned.commission)}</td>
                <td />
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {selected ? (
        <aside className="work-sheet grid gap-3 px-4 py-4" role="dialog" aria-label={selected.name}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{selected.name}</h2>
            <button type="button" onClick={() => setOpen(null)} className="text-sm text-muted-foreground">×</button>
          </div>
          <p className="text-sm text-muted-foreground">{t("target")} <bdi dir="ltr">{money(target)}</bdi> · {Math.min(100, Math.round((selected.sales / target) * 100))}%</p>
          <ul className="divide-y divide-border">
            {selected.deals.length === 0 ? <li className="py-3 text-sm text-muted-foreground">{t("noDeals")}</li> : null}
            {selected.deals.map((deal) => (
              <li key={deal.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <a href={`/admin/crm/deals/${deal.id}`} className="font-medium">{deal.title}</a>
                <span className="text-muted-foreground">{deal.status}</span>
                <span dir="ltr" className="tabular-nums">{money(deal.value)}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="text-sm text-primary" onClick={() => router.refresh()}>{t("apply")}</button>
        </aside>
      ) : null}
    </div>
  );
}
