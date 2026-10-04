"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Megaphone, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { loadCampaignBoard, loadGoogleCallLines } from "@/app/actions/campaigns-board";
import { syncFacebookAds } from "@/app/actions/facebook-ads";
import { syncGoogleAds } from "@/app/actions/google-ads";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  sumPoints,
  type CampaignBoard,
  type CampaignPoint,
  type CampaignRow,
  type GoogleCallLine,
} from "@/lib/campaigns/board";
import { formatIls } from "@/lib/sales-dashboard/campaign-math";
import { formatLastUpdatedAt } from "@/lib/sales-dashboard/marketing-copy";
import { cn } from "@/lib/utils";

type Channel = "all" | "google" | "facebook";
type Preset = "today" | "month" | "d30" | "year" | "all" | "custom";
type ListMode = "spent" | "active" | "every";

function formatDuration(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return "—";
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}:${String(minutes % 60).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  }
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function durationWords(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours} שעות ו־${mins} דקות` : `${hours} שעות`;
  }
  if (minutes === 0) return `${rest} שניות`;
  if (rest === 0) return `${minutes} דקות`;
  return `${minutes} דקות ו־${rest} שניות`;
}

function dayLabel(day: string): string {
  const [year, month, date] = day.split("-");
  return `${Number(date)}.${Number(month)}.${year.slice(2)}`;
}

function shiftYmd(ymd: string, delta: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function money(value: number): string {
  return formatIls(Math.round(value));
}

function boundsFor(
  preset: Preset,
  today: string,
  earliest: string,
  customFrom: string,
  customTo: string,
): { from: string; to: string } {
  if (preset === "today") return { from: today, to: today };
  if (preset === "month") return { from: `${today.slice(0, 8)}01`, to: today };
  if (preset === "d30") return { from: shiftYmd(today, -29), to: today };
  if (preset === "year") return { from: `${today.slice(0, 4)}-01-01`, to: today };
  if (preset === "all") return { from: earliest, to: today };
  return {
    from: customFrom || `${today.slice(0, 8)}01`,
    to: customTo && customTo <= today ? customTo : today,
  };
}

type DayRollup = {
  day: string;
  cost: number;
  leads: number;
  clicks: number;
  impressions: number;
};

function rollupDays(campaigns: CampaignRow[], from: string, to: string): DayRollup[] {
  const map = new Map<string, DayRollup>();
  for (const row of campaigns) {
    for (const point of row.points) {
      if (point.day < from || point.day > to) continue;
      if (point.cost <= 0 && point.leads <= 0 && point.clicks <= 0 && point.impressions <= 0) continue;
      const current = map.get(point.day) ?? { day: point.day, cost: 0, leads: 0, clicks: 0, impressions: 0 };
      current.cost += point.cost;
      current.leads += point.leads;
      current.clicks += point.clicks;
      current.impressions += point.impressions;
      map.set(point.day, current);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.day.localeCompare(a.day));
}

function leadLabel(channel: Channel): string {
  if (channel === "google") return "שיחות";
  if (channel === "facebook") return "טפסים";
  return "לידים";
}

function priceLabel(channel: Channel): string {
  if (channel === "google") return "מחיר לשיחה";
  if (channel === "facebook") return "מחיר לטופס";
  return "מחיר לליד";
}

export function CampaignsScreen({ initial }: { initial: CampaignBoard }) {
  const [board, setBoard] = useState(initial);
  const [channel, setChannel] = useState<Channel>("all");
  const [preset, setPreset] = useState<Preset>("month");
  const [customFrom, setCustomFrom] = useState(initial.today.slice(0, 8) + "01");
  const [customTo, setCustomTo] = useState(initial.today);
  const [listMode, setListMode] = useState<ListMode>("spent");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [explain, setExplain] = useState<"spend" | "leads" | "cpl" | "active" | null>(null);
  const [dayPick, setDayPick] = useState<{ channel: "google" | "facebook"; day: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const earliest = useMemo(() => {
    let min: string | null = null;
    for (const row of [...board.google.campaigns, ...board.facebook.campaigns]) {
      for (const point of row.points) {
        if (!min || point.day < min) min = point.day;
      }
    }
    for (const day of board.calls.days) {
      if (!min || day.day < min) min = day.day;
    }
    return min ?? board.today;
  }, [board]);
  const range = boundsFor(preset, board.today, earliest, customFrom, customTo);
  const from = range.from <= range.to ? range.from : range.to;
  const to = range.to;

  useEffect(() => {
    let cancel = false;
    void loadGoogleCallLines(from, to).then((rows) => {
      if (cancel) return;
      setBoard((current) => ({ ...current, googleCalls: rows }));
    });
    return () => {
      cancel = true;
    };
  }, [from, to]);

  const tagged = useMemo(() => {
    const google = board.google.campaigns.map((row) => ({ ...row, channel: "google" as const }));
    const facebook = board.facebook.campaigns.map((row) => ({ ...row, channel: "facebook" as const }));
    const source = channel === "all" ? [...google, ...facebook] : channel === "google" ? google : facebook;
    return source
      .map((row) => ({ row, sum: sumPoints(row.points, from, to) }))
      .sort((a, b) => b.sum.cost - a.sum.cost || a.row.name.localeCompare(b.row.name, "he"));
  }, [board, channel, from, to]);

  const visible = tagged.filter((item) => {
    if (listMode === "active") return item.row.active;
    if (listMode === "spent") return item.sum.cost > 0;
    return item.sum.cost > 0 || item.row.active || item.sum.leads > 0;
  });

  const totals = tagged.reduce(
    (acc, item) => {
      acc.cost += item.sum.cost;
      acc.leads += item.sum.leads;
      acc.clicks += item.sum.clicks;
      acc.impressions += item.sum.impressions;
      if (item.row.channel === "google") acc.googleCost += item.sum.cost;
      else acc.facebookCost += item.sum.cost;
      if (item.row.channel === "google") acc.googleLeads += item.sum.leads;
      else acc.facebookLeads += item.sum.leads;
      return acc;
    },
    { cost: 0, leads: 0, clicks: 0, impressions: 0, googleCost: 0, facebookCost: 0, googleLeads: 0, facebookLeads: 0 },
  );
  const cpl = totals.leads > 0 ? totals.cost / totals.leads : null;
  const activeCount = tagged.filter((item) => item.row.active).length;

  const facebookDays = useMemo(() => rollupDays(board.facebook.campaigns, from, to), [board.facebook.campaigns, from, to]);

  const googleCallRows = useMemo(
    () =>
      board.googleCalls
        .filter((row) => row.day >= from && row.day <= to)
        .sort((a, b) => b.at.localeCompare(a.at)),
    [board.googleCalls, from, to],
  );
  const selected = tagged.find((item) => `${item.row.channel}:${item.row.id}` === selectedId) ?? null;
  const googleSync = formatLastUpdatedAt(board.google.lastSyncedAt);
  const facebookSync = formatLastUpdatedAt(board.facebook.lastSyncedAt);

  function sync() {
    startTransition(() => {
      const jobs =
        channel === "facebook"
          ? [syncFacebookAds()]
          : channel === "google"
            ? [syncGoogleAds()]
            : [syncGoogleAds(), syncFacebookAds()];
      void Promise.all(jobs).then((results) => {
        const failed = results.find((result) => !result.ok && !result.skipped);
        if (failed && !failed.ok) {
          toast.error(failed.error ?? "הסנכרון נכשל");
        } else if (results.every((result) => result.skipped)) {
          toast.message("החשבון עדיין לא מחובר");
        } else {
          toast.success("נמשכו 36 החודשים האחרונים מהחשבונות");
        }
        void loadCampaignBoard().then(setBoard).catch(() => undefined);
      });
    });
  }

  return (
    <section className="mx-auto w-full max-w-[76rem] space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-highlight/40">
            <Megaphone className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">קמפיינים</h1>
            <p className="text-sm text-muted-foreground">
              גוגל נספר בשיחות מהמודעה. פייסבוק נספרת בטפסים. נתונים שמורים מ־{dayLabel(earliest)}.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">
            גוגל {googleSync ?? "לא סונכרן"} · פייסבוק {facebookSync ?? "לא סונכרן"}
          </p>
          {board.canSync ? (
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={sync}>
              <RefreshCw className={cn("size-4", pending && "animate-spin")} />
              סנכרון 36 חודשים
            </Button>
          ) : null}
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-full bg-[#f6f5f1] p-1" role="tablist" aria-label="ערוץ">
          {(
            [
              ["all", "הכל"],
              ["google", "גוגל"],
              ["facebook", "פייסבוק"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={channel === id}
              onClick={() => {
                setChannel(id);
                setSelectedId(null);
              }}
              className={cn(
                "h-8 rounded-full px-4 text-sm transition-colors",
                channel === id ? "bg-[#1a1a1a] font-medium text-white" : "text-muted-foreground hover:bg-white",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-full bg-[#f6f5f1] p-1">
          {(
            [
              ["today", "היום"],
              ["month", "החודש"],
              ["d30", "30 יום"],
              ["year", "השנה"],
              ["all", "מההתחלה"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPreset(id)}
              className={cn(
                "h-8 rounded-full px-3 text-sm transition-colors",
                preset === id ? "bg-highlight font-medium text-[#1a1a1a]" : "text-muted-foreground hover:bg-white",
              )}
            >
              {label}
            </button>
          ))}
          <input
            type="date"
            value={preset === "custom" ? customFrom : from}
            max={to}
            aria-label="מתאריך"
            onChange={(event) => {
              setPreset("custom");
              setCustomFrom(event.target.value);
            }}
            className="h-8 rounded-full border border-black/[0.08] bg-white px-2 text-xs"
          />
          <span className="text-xs text-muted-foreground">עד</span>
          <input
            type="date"
            value={preset === "custom" ? customTo : to}
            min={from}
            max={board.today}
            aria-label="עד תאריך"
            onChange={(event) => {
              setPreset("custom");
              setCustomTo(event.target.value);
            }}
            className="h-8 rounded-full border border-black/[0.08] bg-white px-2 text-xs"
          />
        </div>
      </div>

      {(board.google.lastError || board.facebook.lastError) && (channel === "all" || (channel === "google" && board.google.lastError) || (channel === "facebook" && board.facebook.lastError)) ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {channel !== "facebook" ? board.google.lastError : null}
          {channel === "all" && board.google.lastError && board.facebook.lastError ? " · " : ""}
          {channel !== "google" ? board.facebook.lastError : null}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="הוצאה" value={money(totals.cost)} onClick={() => setExplain("spend")} />
        <Metric label={leadLabel(channel)} value={totals.leads.toLocaleString("he-IL")} onClick={() => setExplain("leads")} />
        <Metric label={priceLabel(channel)} value={cpl == null ? "—" : money(cpl)} onClick={() => setExplain("cpl")} />
        <Metric label="פעילים עכשיו" value={activeCount.toLocaleString("he-IL")} onClick={() => setExplain("active")} />
      </div>
      {channel === "all" ? (
        <p className="text-sm text-muted-foreground">
          בקוביית הלידים יש {totals.googleLeads.toLocaleString("he-IL")} שיחות שגוגל ספרה בקמפיינים, ועוד {totals.facebookLeads.toLocaleString("he-IL")} טפסים מפייסבוק. הרשימה למטה היא השיחות שגוגל החזירה אחת־אחת, עם המשך של כל שיחה.
        </p>
      ) : null}

      {channel !== "facebook" ? <GoogleCallDays rows={googleCallRows} /> : null}
      {channel !== "google" ? (
        <DayTable
          title="פייסבוק לפי יום"
          hint="כל שורה היא מה שפייסבוק ספר באותו יום: הוצאה וטפסים. טופס אחד נספר פעם אחת."
          leadName="טפסים"
          rows={facebookDays}
          onOpen={(day) => setDayPick({ channel: "facebook", day })}
        />
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">קמפיינים</h2>
            <p className="text-xs text-muted-foreground">לחיצה על שורה פותחת את הפירוק היומי ואת החישוב.</p>
          </div>
          <div className="flex gap-1 rounded-full bg-[#f6f5f1] p-1">
            {(
              [
                ["spent", "עם הוצאה"],
                ["active", "פעילים"],
                ["every", "הכל"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setListMode(id)}
                className={cn(
                  "h-7 rounded-full px-3 text-xs",
                  listMode === id ? "bg-white font-medium text-[#1a1a1a]" : "text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </header>
        {visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">אין קמפיינים בסינון הזה.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] table-fixed text-sm">
              <thead>
                <tr className="border-b border-black/[0.06] text-[11px] text-muted-foreground">
                  {channel === "all" ? <th className="px-4 py-2 text-start font-medium">ערוץ</th> : null}
                  <th className="px-4 py-2 text-start font-medium">קמפיין</th>
                  <th className="px-3 py-2 text-start font-medium">סטטוס</th>
                  <th className="px-3 py-2 text-start font-medium">הוצאה</th>
                  <th className="px-3 py-2 text-start font-medium">{leadLabel(channel)}</th>
                  <th className="px-3 py-2 text-start font-medium">{priceLabel(channel)}</th>
                  <th className="px-3 py-2 text-start font-medium">קליקים</th>
                  <th className="px-3 py-2 text-start font-medium">חשיפות</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(({ row, sum }) => (
                  <tr key={`${row.channel}:${row.id}`} className="border-b border-black/[0.04] last:border-0">
                    {channel === "all" ? (
                      <td className="px-4 py-3 text-xs text-muted-foreground">{row.channel === "google" ? "גוגל" : "פייסבוק"}</td>
                    ) : null}
                    <td className="px-4 py-3">
                      <button type="button" className="text-start font-medium hover:underline" onClick={() => setSelectedId(`${row.channel}:${row.id}`)}>
                        {row.name}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px]", row.active ? "bg-emerald-50 text-emerald-800" : "bg-[#f3f2ee] text-[#5c5c56]")}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{money(sum.cost)}</td>
                    <td className="px-3 py-3 tabular-nums">{sum.leads.toLocaleString("he-IL")}</td>
                    <td className="px-3 py-3 font-medium tabular-nums">{sum.cpl == null ? "—" : money(sum.cpl)}</td>
                    <td className="px-3 py-3 tabular-nums text-muted-foreground">{sum.clicks.toLocaleString("he-IL")}</td>
                    <td className="px-3 py-3 tabular-nums text-muted-foreground">{sum.impressions.toLocaleString("he-IL")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog open={explain != null} onOpenChange={(open) => !open && setExplain(null)}>
        <DialogContent className="max-h-[min(92dvh,44rem)] w-[min(96vw,44rem)] max-w-none overflow-y-auto">
          <ExplainBody
            id={explain}
            channel={channel}
            spend={totals.cost}
            googleSpend={totals.googleCost}
            facebookSpend={totals.facebookCost}
            leads={totals.leads}
            googleLeads={totals.googleLeads}
            facebookLeads={totals.facebookLeads}
            cpl={cpl}
            activeCount={activeCount}
            clicks={totals.clicks}
            impressions={totals.impressions}
            rows={tagged}
            googleCallCount={googleCallRows.length}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={dayPick != null} onOpenChange={(open) => !open && setDayPick(null)}>
        <DialogContent className="max-h-[min(92dvh,44rem)] w-[min(96vw,42rem)] max-w-none overflow-y-auto">
          {dayPick ? (
            <DayDetail
              day={dayPick.day}
              channel={dayPick.channel}
              campaigns={(dayPick.channel === "google" ? board.google.campaigns : board.facebook.campaigns).map((row) => ({
                ...row,
                channel: dayPick.channel,
              }))}
              calls={dayPick.channel === "google" ? googleCallRows.filter((row) => row.day === dayPick.day) : []}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={selected != null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-h-[min(92dvh,44rem)] w-[min(96vw,42rem)] max-w-none overflow-y-auto">
          {selected ? <CampaignDetail row={selected.row} sum={selected.sum} from={from} to={to} /> : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Metric({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  const body = (
    <>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {onClick ? <p className="mt-2 text-[11px] text-muted-foreground">לחצו לפירוט</p> : null}
    </>
  );
  const className = "w-full rounded-2xl border border-black/[0.06] bg-white px-4 py-3 text-start";
  if (!onClick) return <div className={className}>{body}</div>;
  return (
    <button type="button" onClick={onClick} className={cn(className, "transition-colors hover:bg-[#fafaf8]")}>
      {body}
    </button>
  );
}

function GoogleCallDays({ rows }: { rows: GoogleCallLine[] }) {
  const [day, setDay] = useState<string | null>(null);
  const groups = useMemo(() => {
    const map = new Map<string, GoogleCallLine[]>();
    for (const row of rows) {
      const list = map.get(row.day) ?? [];
      list.push(row);
      map.set(row.day, list);
    }
    return Array.from(map.entries())
      .map(([key, lines]) => {
        const sorted = lines.slice().sort((a, b) => a.at.localeCompare(b.at));
        const duration = sorted.reduce((sum, line) => sum + line.durationSec, 0);
        return {
          day: key,
          lines: sorted,
          count: sorted.length,
          duration,
          avg: sorted.length > 0 ? duration / sorted.length : null,
        };
      })
      .sort((a, b) => b.day.localeCompare(a.day));
  }, [rows]);
  const open = groups.find((group) => group.day === day) ?? null;
  const totalCount = groups.reduce((sum, group) => sum + group.count, 0);
  const totalDuration = groups.reduce((sum, group) => sum + group.duration, 0);

  return (
    <section className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
      <header className="border-b border-black/[0.06] px-4 py-3">
        <h2 className="text-sm font-semibold">שיחות שגוגל החזירה</h2>
        <p className="text-xs text-muted-foreground">
          {totalCount > 0
            ? `${totalCount.toLocaleString("he-IL")} שיחות בטווח. לחיצה על יום פותחת כל שיחה, ובסוף את הממוצע של אותו יום.`
            : "גוגל לא החזירה שיחות בטווח הזה."}
          {totalCount > 0 ? ` משך כולל ${durationWords(totalDuration)}.` : ""}
        </p>
      </header>
      {groups.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">אין רשימת שיחות בטווח הזה.</p>
      ) : (
        <div className="max-h-96 overflow-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-black/[0.06] text-[11px] text-muted-foreground">
                <th className="px-4 py-2 text-start font-medium">תאריך</th>
                <th className="px-3 py-2 text-start font-medium">שיחות</th>
                <th className="px-3 py-2 text-start font-medium">משך כולל</th>
                <th className="px-3 py-2 text-start font-medium">ממוצע לשיחה</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr
                  key={group.day}
                  className="cursor-pointer border-b border-black/[0.04] hover:bg-black/[0.03]"
                  onClick={() => setDay(group.day)}
                >
                  <td className="px-4 py-2 tabular-nums">{dayLabel(group.day)}</td>
                  <td className="px-3 py-2 tabular-nums">{group.count.toLocaleString("he-IL")}</td>
                  <td className="px-3 py-2 tabular-nums">{formatDuration(group.duration)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatDuration(group.avg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={open != null} onOpenChange={(next) => !next && setDay(null)}>
        <DialogContent className="max-h-[min(92dvh,44rem)] w-[min(96vw,44rem)] max-w-none overflow-y-auto">
          {open ? (
            <>
              <DialogHeader>
                <DialogTitle>{dayLabel(open.day)}</DialogTitle>
                <DialogDescription>כל שיחה שגוגל החזירה ביום הזה. הממוצע מחושב רק מהרשימה הזו.</DialogDescription>
              </DialogHeader>
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b border-black/[0.06] text-[11px] text-muted-foreground">
                      <th className="py-2 text-start font-medium">שעה</th>
                      <th className="py-2 text-start font-medium">משך</th>
                      <th className="py-2 text-start font-medium">מה קרה</th>
                      <th className="py-2 text-start font-medium">קמפיין</th>
                      <th className="py-2 text-start font-medium">קידומת</th>
                    </tr>
                  </thead>
                  <tbody>
                    {open.lines.map((line) => (
                      <tr key={`${line.at}-${line.campaignName}-${line.durationSec}`} className="border-b border-black/[0.04]">
                        <td className="py-1.5 tabular-nums">{line.time || "—"}</td>
                        <td className="py-1.5 tabular-nums">{formatDuration(line.durationSec)}</td>
                        <td className="py-1.5">
                          {callStatusLabel(line.status)}
                          {line.kind || line.place ? (
                            <span className="mt-0.5 block text-[11px] text-muted-foreground">
                              {[line.kind, line.place].filter(Boolean).join(" · ")}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-1.5">{line.campaignName}</td>
                        <td className="py-1.5 tabular-nums">{line.area || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rounded-2xl bg-[#f6f5f1] px-4 py-3">
                <p className="text-[11px] font-medium text-muted-foreground">ממוצע לשיחה ביום הזה</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{formatDuration(open.avg)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {durationWords(open.duration)} ביום, {open.count.toLocaleString("he-IL")} שיחות, ממוצע {durationWords(open.avg ?? 0)} לשיחה.
                </p>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function DayTable({
  title,
  hint,
  leadName,
  rows,
  onOpen,
}: {
  title: string;
  hint: string;
  leadName: string;
  rows: DayRollup[];
  onOpen: (day: string) => void;
}) {
  const total = rows.reduce(
    (acc, row) => {
      acc.cost += row.cost;
      acc.leads += row.leads;
      acc.clicks += row.clicks;
      acc.impressions += row.impressions;
      return acc;
    },
    { cost: 0, leads: 0, clicks: 0, impressions: 0 },
  );
  const price = total.leads > 0 ? total.cost / total.leads : null;
  return (
    <section className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
      <header className="border-b border-black/[0.06] px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </header>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">אין תנועה בטווח הזה.</p>
      ) : (
        <div className="max-h-96 overflow-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-black/[0.06] text-[11px] text-muted-foreground">
                <th className="px-4 py-2 text-start font-medium">תאריך</th>
                <th className="px-3 py-2 text-start font-medium">הוצאה</th>
                <th className="px-3 py-2 text-start font-medium">{leadName}</th>
                <th className="px-3 py-2 text-start font-medium">מחיר</th>
                <th className="px-3 py-2 text-start font-medium">קליקים</th>
                <th className="px-3 py-2 text-start font-medium">חשיפות</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const rowPrice = row.leads > 0 ? row.cost / row.leads : null;
                return (
                  <tr
                    key={row.day}
                    className="cursor-pointer border-b border-black/[0.04] hover:bg-black/[0.03]"
                    onClick={() => onOpen(row.day)}
                  >
                    <td className="px-4 py-2 tabular-nums">{dayLabel(row.day)}</td>
                    <td className="px-3 py-2 tabular-nums">{money(row.cost)}</td>
                    <td className="px-3 py-2 tabular-nums">{row.leads.toLocaleString("he-IL")}</td>
                    <td className="px-3 py-2 tabular-nums">{rowPrice == null ? "—" : money(rowPrice)}</td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{row.clicks.toLocaleString("he-IL")}</td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{row.impressions.toLocaleString("he-IL")}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-black/[0.08] font-medium">
                <td className="px-4 py-2">סה״כ</td>
                <td className="px-3 py-2 tabular-nums">{money(total.cost)}</td>
                <td className="px-3 py-2 tabular-nums">{total.leads.toLocaleString("he-IL")}</td>
                <td className="px-3 py-2 tabular-nums">{price == null ? "—" : money(price)}</td>
                <td className="px-3 py-2 tabular-nums">{total.clicks.toLocaleString("he-IL")}</td>
                <td className="px-3 py-2 tabular-nums">{total.impressions.toLocaleString("he-IL")}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

function DayDetail({
  day,
  channel,
  campaigns,
  calls,
}: {
  day: string;
  channel: "google" | "facebook";
  campaigns: (CampaignRow & { channel: "google" | "facebook" })[];
  calls: GoogleCallLine[];
}) {
  const rows = campaigns
    .map((row) => {
      const point = row.points.find((item) => item.day === day);
      return point ? { name: row.name, ...point } : null;
    })
    .filter((row): row is CampaignPoint & { name: string } => row != null && (row.cost > 0 || row.leads > 0 || row.clicks > 0))
    .sort((a, b) => b.cost - a.cost || b.leads - a.leads);
  const cost = rows.reduce((sum, row) => sum + row.cost, 0);
  const leads = rows.reduce((sum, row) => sum + row.leads, 0);
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  const noun = channel === "google" ? "שיחות" : "טפסים";
  const answered = calls.filter((row) => row.status === "RECEIVED").length;
  const missed = calls.filter((row) => row.status === "MISSED").length;
  const duration = calls.reduce((sum, row) => sum + row.durationSec, 0);
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {dayLabel(day)} · {channel === "google" ? "גוגל" : "פייסבוק"}
        </DialogTitle>
        <DialogDescription>
          {channel === "google"
            ? "השיחות הן מה שגוגל ספר על המודעות ביום הזה."
            : "הטפסים הם מילוי אחד באתר. פייסבוק לא נספרת פעמיים."}
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="הוצאה" value={money(cost)} />
        <Metric label={noun} value={leads.toLocaleString("he-IL")} />
        <Metric label="קליקים" value={clicks.toLocaleString("he-IL")} />
        <Metric label="חשיפות" value={impressions.toLocaleString("he-IL")} />
      </div>
      <p className="text-sm text-muted-foreground">
        {leads > 0 ? `מחיר = ${money(cost)} ÷ ${leads.toLocaleString("he-IL")} = ${money(cost / leads)}.` : "אין מה לחלק, כי אין תוצאה ביום הזה."}
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/[0.06] text-[11px] text-muted-foreground">
            <th className="py-2 text-start font-medium">קמפיין</th>
            <th className="py-2 text-start font-medium">הוצאה</th>
            <th className="py-2 text-start font-medium">{noun}</th>
            <th className="py-2 text-start font-medium">קליקים</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-b border-black/[0.04]">
              <td className="py-2">{row.name}</td>
              <td className="py-2 tabular-nums">{money(row.cost)}</td>
              <td className="py-2 tabular-nums">{row.leads.toLocaleString("he-IL")}</td>
              <td className="py-2 tabular-nums text-muted-foreground">{row.clicks.toLocaleString("he-IL")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {channel === "google" && calls.length > 0 ? (
        <div>
          <p className="text-sm font-medium">כל שיחה שגוגל החזירה</p>
          <p className="text-xs text-muted-foreground">
            {calls.length.toLocaleString("he-IL")} שיחות · {answered.toLocaleString("he-IL")} נענו · {missed.toLocaleString("he-IL")} לא נענו · משך כולל {durationWords(duration)}
            {calls.length > 0 ? ` · ממוצע ${durationWords(duration / calls.length)}` : ""}
          </p>
          <div className="mt-2 max-h-64 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-muted-foreground">
                  <th className="py-1 text-start font-medium">שעה</th>
                  <th className="py-1 text-start font-medium">משך</th>
                  <th className="py-1 text-start font-medium">מה קרה</th>
                  <th className="py-1 text-start font-medium">קמפיין</th>
                  <th className="py-1 text-start font-medium">קידומת</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((row) => (
                  <tr key={`${row.at}-${row.campaignName}-${row.durationSec}`} className="border-t border-black/[0.04]">
                    <td className="py-1.5 tabular-nums">{row.time || "—"}</td>
                    <td className="py-1.5 tabular-nums">{formatDuration(row.durationSec)}</td>
                    <td className="py-1.5">{callStatusLabel(row.status)}</td>
                    <td className="py-1.5">{row.campaignName}</td>
                    <td className="py-1.5 tabular-nums">{row.area || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      {channel === "google" && calls.length === 0 && leads > 0 ? (
        <p className="text-sm text-muted-foreground">
          גוגל ספרה {leads.toLocaleString("he-IL")} שיחות ביום הזה. שעה ומשך של כל שיחה לא חזרו מהחשבון.
        </p>
      ) : null}
    </>
  );
}

function callStatusLabel(status: string): string {
  if (status === "RECEIVED") return "נענתה";
  if (status === "MISSED") return "לא נענתה";
  return "לא ידוע";
}

function ExplainLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] items-baseline gap-3 border-t border-black/[0.06] py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function ExplainBody(props: {
  id: "spend" | "leads" | "cpl" | "active" | null;
  channel: Channel;
  spend: number;
  googleSpend: number;
  facebookSpend: number;
  leads: number;
  googleLeads: number;
  facebookLeads: number;
  cpl: number | null;
  activeCount: number;
  clicks: number;
  impressions: number;
  googleCallCount: number;
  rows: { row: CampaignRow & { channel: "google" | "facebook" }; sum: ReturnType<typeof sumPoints> }[];
}) {
  if (!props.id) return null;
  const noun = leadLabel(props.channel);
  const shown =
    props.id === "active"
      ? props.rows.filter((item) => item.row.active)
      : props.id === "leads"
        ? props.rows.filter((item) => item.sum.leads > 0)
        : props.rows.filter((item) => item.sum.cost > 0 || item.sum.leads > 0);
  const sorted = shown.slice().sort((a, b) => {
    if (props.id === "leads") return b.sum.leads - a.sum.leads || b.sum.cost - a.sum.cost;
    return b.sum.cost - a.sum.cost || b.sum.leads - a.sum.leads;
  });
  const title =
    props.id === "spend" ? "הוצאה" : props.id === "leads" ? noun : props.id === "cpl" ? priceLabel(props.channel) : "פעילים עכשיו";
  const value =
    props.id === "spend"
      ? money(props.spend)
      : props.id === "leads"
        ? props.leads.toLocaleString("he-IL")
        : props.id === "cpl"
          ? props.cpl == null
            ? "—"
            : money(props.cpl)
          : props.activeCount.toLocaleString("he-IL");
  const note =
    props.id === "spend"
      ? "סכום מה ששולם על הקמפיינים בטווח."
      : props.id === "leads"
        ? props.channel === "google"
          ? "כל מספר כאן הוא שיחה שגוגל ספר על המודעה. שיחה אחת = אחת."
          : props.channel === "facebook"
            ? "כל מספר כאן הוא טופס שנשלח. טופס אחד נספר פעם אחת."
            : "ב«הכל» מחברים שני דברים שונים: שיחות מגוגל, וטפסים מפייסבוק."
        : props.id === "cpl"
          ? props.cpl == null
            ? "אין תוצאה בטווח, אז אין במה לחלק."
            : "ההוצאה חלקי התוצאה באותו טווח."
          : "קמפיינים שדולקים עכשיו. התאריך למעלה לא משנה את המספר הזה.";
  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{note}</DialogDescription>
      </DialogHeader>
      <p className="text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
      <div>
        {props.channel === "all" && props.id === "spend" ? (
          <>
            <ExplainLine label="גוגל" value={money(props.googleSpend)} />
            <ExplainLine label="פייסבוק" value={money(props.facebookSpend)} />
            <ExplainLine label="ביחד" value={money(props.spend)} />
          </>
        ) : null}
        {props.channel === "all" && props.id === "leads" ? (
          <>
            <ExplainLine label="שיחות גוגל" value={props.googleLeads.toLocaleString("he-IL")} />
            <ExplainLine label="טפסי פייסבוק" value={props.facebookLeads.toLocaleString("he-IL")} />
            <ExplainLine label="ביחד" value={props.leads.toLocaleString("he-IL")} />
          </>
        ) : null}
        {props.id === "cpl" ? (
          <>
            <ExplainLine label="הוצאה" value={money(props.spend)} />
            <ExplainLine label={noun} value={props.leads.toLocaleString("he-IL")} />
            <ExplainLine
              label="חישוב"
              value={props.cpl == null ? "—" : `${money(props.spend)} ÷ ${props.leads.toLocaleString("he-IL")}`}
            />
            {props.channel === "all" && props.googleLeads > 0 ? (
              <ExplainLine label="מחיר שיחה" value={money(props.googleSpend / props.googleLeads)} />
            ) : null}
            {props.channel === "all" && props.facebookLeads > 0 ? (
              <ExplainLine label="מחיר טופס" value={money(props.facebookSpend / props.facebookLeads)} />
            ) : null}
          </>
        ) : null}
        {props.id === "spend" || props.id === "leads" ? (
          <>
            <ExplainLine label="קליקים" value={props.clicks.toLocaleString("he-IL")} />
            <ExplainLine label="חשיפות" value={props.impressions.toLocaleString("he-IL")} />
          </>
        ) : null}
      </div>
      {props.id === "leads" && props.channel !== "facebook" && props.googleLeads > 0 && props.googleCallCount === 0 ? (
        <p className="text-sm text-muted-foreground">
          גוגל ספרה {props.googleLeads.toLocaleString("he-IL")} שיחות. רשימת שעה ומשך לכל שיחה לא חזרה מהחשבון בטווח הזה.
        </p>
      ) : null}
      <div className="max-h-80 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background">
            <tr className="border-b border-black/[0.06] text-[11px] text-muted-foreground">
              <th className="py-2 text-start font-medium">קמפיין</th>
              {props.channel === "all" ? <th className="py-2 text-start font-medium">ערוץ</th> : null}
              <th className="py-2 text-start font-medium">הוצאה</th>
              <th className="py-2 text-start font-medium">{noun}</th>
              <th className="py-2 text-start font-medium">מחיר</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => (
              <tr key={`${item.row.channel}:${item.row.id}`} className="border-b border-black/[0.04]">
                <td className="py-2">
                  {item.row.name}
                  {props.id === "active" ? <span className="ms-2 text-[11px] text-muted-foreground">{item.row.status}</span> : null}
                </td>
                {props.channel === "all" ? (
                  <td className="py-2 text-muted-foreground">{item.row.channel === "google" ? "גוגל" : "פייסבוק"}</td>
                ) : null}
                <td className="py-2 tabular-nums">{money(item.sum.cost)}</td>
                <td className="py-2 tabular-nums">{item.sum.leads.toLocaleString("he-IL")}</td>
                <td className="py-2 tabular-nums">{item.sum.cpl == null ? "—" : money(item.sum.cpl)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CampaignDetail({
  row,
  sum,
  from,
  to,
}: {
  row: CampaignRow & { channel: "google" | "facebook" };
  sum: ReturnType<typeof sumPoints>;
  from: string;
  to: string;
}) {
  const noun = row.channel === "google" ? "שיחות" : "טפסים";
  const ctr = sum.impressions > 0 ? (sum.clicks / sum.impressions) * 100 : null;
  return (
    <>
      <DialogHeader>
        <DialogTitle>{row.name}</DialogTitle>
        <DialogDescription>
          {row.channel === "google" ? "גוגל" : "פייסבוק"} · {row.status} · {dayLabel(from)} עד {dayLabel(to)}
        </DialogDescription>
      </DialogHeader>
      <p className="text-sm text-muted-foreground">
        {sum.cpl == null
          ? `אין ${noun} בטווח, אז אין מחיר.`
          : `מחיר = ${money(sum.cost)} ÷ ${sum.leads.toLocaleString("he-IL")} = ${money(sum.cpl)}.`}
        {row.channel === "google" ? " כל שיחה שגוגל ספר נספרת פעם אחת." : " כל טופס נספר פעם אחת."}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="הוצאה" value={money(sum.cost)} />
        <Metric label={noun} value={sum.leads.toLocaleString("he-IL")} />
        <Metric label="קליקים" value={sum.clicks.toLocaleString("he-IL")} />
        <Metric label="חשיפות" value={sum.impressions.toLocaleString("he-IL")} />
      </div>
      <p className="text-sm text-muted-foreground">
        {ctr == null ? "אין חשיפות, אז אין אחוז הקלקה." : `הקלקה מתוך חשיפה: ${ctr.toLocaleString("he-IL", { maximumFractionDigits: 1 })}%.`}
      </p>
      {sum.days.length === 0 ? (
        <p className="text-sm text-muted-foreground">אין תנועה בטווח.</p>
      ) : (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b border-black/[0.06] text-[11px] text-muted-foreground">
                <th className="py-2 text-start font-medium">תאריך</th>
                <th className="py-2 text-start font-medium">הוצאה</th>
                <th className="py-2 text-start font-medium">{noun}</th>
                <th className="py-2 text-start font-medium">קליקים</th>
              </tr>
            </thead>
            <tbody>
              {sum.days.map((day: CampaignPoint) => (
                <tr key={day.day} className="border-b border-black/[0.04]">
                  <td className="py-1.5 tabular-nums">{dayLabel(day.day)}</td>
                  <td className="py-1.5 tabular-nums">{money(day.cost)}</td>
                  <td className="py-1.5 tabular-nums">{day.leads.toLocaleString("he-IL")}</td>
                  <td className="py-1.5 tabular-nums text-muted-foreground">{day.clicks.toLocaleString("he-IL")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

