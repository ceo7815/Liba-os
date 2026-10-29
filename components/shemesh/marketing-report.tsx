"use client";

import { useMemo, useState } from "react";
import { Megaphone } from "lucide-react";
import { Panel, Stat } from "@/components/shemesh/widgets";
import { formatShemeshCount, formatShemeshMoney } from "@/lib/shemesh/format";
import { jerusalemYmd } from "@/lib/sales-dashboard/campaign-math";
import type { FacebookAdDailyMetric } from "@/lib/facebook-ads/client";

const PERIODS = [
  { id: "month", label: "החודש" },
  { id: "30", label: "30 יום" },
  { id: "90", label: "90 יום" },
] as const;

type PeriodId = (typeof PERIODS)[number]["id"];

function inPeriod(day: string, period: PeriodId, today: string): boolean {
  if (period === "month") return day.slice(0, 7) === today.slice(0, 7);
  const span = period === "30" ? 30 : 90;
  const from = new Date(`${today}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - (span - 1));
  const fromDay = from.toISOString().slice(0, 10);
  return day >= fromDay && day <= today;
}

export function ShemeshMarketingReport({
  accountId,
  error,
  rows,
}: {
  accountId: string;
  error: string | null;
  rows: FacebookAdDailyMetric[];
}) {
  const [period, setPeriod] = useState<PeriodId>("month");
  const today = jerusalemYmd();
  const visible = useMemo(() => rows.filter((row) => inPeriod(row.day, period, today)), [rows, period, today]);
  const campaigns = rollup(visible, (row) => row.campaignName || row.campaignId);
  const ads = rollup(visible, (row) => row.adName || row.adId);
  const spend = visible.reduce((sum, row) => sum + row.cost, 0);
  const leads = visible.reduce((sum, row) => sum + row.leads, 0);
  const cpl = leads > 0 ? spend / leads : null;
  const forecast = forecastMonth(rows, today);

  return (
    <section className="mx-auto mb-6 max-w-[76rem] space-y-3">
      <div className="app-surface px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">שיווק שמש</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-highlight/35">
                <Megaphone className="size-5" />
              </span>
              <h1 className="text-2xl font-semibold tracking-tight">מודעות</h1>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              חשבון Meta <span className="font-mono text-xs" dir="ltr">act_{accountId}</span>. עלות, לידים ועלות לליד לפי קמפיין ולפי מודעה.
            </p>
          </div>
          <div className="flex rounded-full bg-[#f6f5f1] p-1" role="tablist" aria-label="תקופה">
            {PERIODS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPeriod(item.id)}
                className={`h-8 rounded-full px-3 text-xs ${period === item.id ? "bg-white font-semibold shadow-sm" : "text-muted-foreground"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="הוצאה" value={formatShemeshMoney(spend)} />
          <Stat label="לידים" value={formatShemeshCount(leads)} />
          <Stat label="עלות לליד" value={cpl == null ? "—" : formatShemeshMoney(cpl)} />
          <Stat label="צפי הוצאה לחודש" value={forecast == null ? "—" : formatShemeshMoney(forecast)} hint="ממוצע יומי כפול ימי החודש" />
        </div>
      </div>
      {error ? (
        <Panel title="החשבון לא נקרא">
          <p className="py-3 text-sm text-muted-foreground">{error}</p>
        </Panel>
      ) : rows.length === 0 ? (
        <Panel title="אין נתוני מודעות">
          <p className="py-3 text-sm text-muted-foreground">
            אחרי חיבור פייסבוק של ליבה, המסך קורא רק את חשבון שמש. חשבונות אחרים לא נספרים כאן.
          </p>
        </Panel>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <Rank title="קמפיינים" rows={campaigns} />
          <Rank title="מודעות" rows={ads} />
        </div>
      )}
    </section>
  );
}

function rollup(rows: FacebookAdDailyMetric[], key: (row: FacebookAdDailyMetric) => string) {
  const groups = new Map<string, { spend: number; leads: number }>();
  for (const row of rows) {
    const name = key(row) || "ללא שם";
    const current = groups.get(name) ?? { spend: 0, leads: 0 };
    current.spend += row.cost;
    current.leads += row.leads;
    groups.set(name, current);
  }
  return Array.from(groups.entries())
    .map(([name, value]) => ({
      name,
      ...value,
      cpl: value.leads > 0 ? value.spend / value.leads : null,
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 12);
}

function forecastMonth(rows: FacebookAdDailyMetric[], today: string): number | null {
  const month = today.slice(0, 7);
  const days = new Map<string, number>();
  for (const row of rows) {
    if (row.day.slice(0, 7) !== month) continue;
    days.set(row.day, (days.get(row.day) ?? 0) + row.cost);
  }
  if (!days.size) return null;
  const spent = Array.from(days.values()).reduce((sum, value) => sum + value, 0);
  const [year, monthNumber] = month.split("-").map(Number);
  const length = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return (spent / days.size) * length;
}

function Rank({
  title,
  rows,
}: {
  title: string;
  rows: { name: string; spend: number; leads: number; cpl: number | null }[];
}) {
  return (
    <Panel title={title}>
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th className="py-2 text-right font-medium">שם</th>
            <th className="py-2 text-right font-medium">הוצאה</th>
            <th className="py-2 text-right font-medium">לידים</th>
            <th className="py-2 text-right font-medium">עלות לליד</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-t border-black/[0.06]">
              <td className="max-w-[14rem] truncate py-2 font-medium">{row.name}</td>
              <td className="py-2 tabular-nums">{formatShemeshMoney(row.spend)}</td>
              <td className="py-2 tabular-nums">{formatShemeshCount(row.leads)}</td>
              <td className="py-2 tabular-nums">{row.cpl == null ? "—" : formatShemeshMoney(row.cpl)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
