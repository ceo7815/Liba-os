"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { CountUp } from "@/components/ui/count-up";
import { DateRangeField } from "@/components/ui/date-range-field";
import { formatCount, formatDelta, formatIls } from "@/lib/format/numbers";
import { formatShemeshMonth } from "@/lib/shemesh/format";
import { SHEMESH_SALES_SOURCE_LABEL } from "@/lib/shemesh/sales-source";
import {
  buildDashboard,
  shiftIso,
  type DashInput,
  type DashRange,
  type DashView,
} from "@/lib/shemesh/dashboard-model";

const STATUS_HE = { draft: "טיוטה", approved: "אושר", paid: "שולם" } as const;

function monthStart(today: string): string {
  return `${today.slice(0, 7)}-01`;
}

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) {
    return <span className="text-[11px] text-current/70">אין מגמה עדיין</span>;
  }
  const max = Math.max(...values, 1);
  const width = 92;
  const height = 28;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - (value / max) * (height - 2) - 1;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-7 w-24" aria-hidden>
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points} />
    </svg>
  );
}

function Delta({ current, previous, money = false }: { current: number | null; previous: number | null; money?: boolean }) {
  if (current == null || previous == null) return <span className="text-[11px] text-current/70">ממתין לתקופה קודמת</span>;
  const diff = current - previous;
  const label = money
    ? `${diff > 0 ? "+" : ""}${formatIls(diff)}`
    : formatDelta(current, previous);
  return <span className="text-[11px] font-semibold tabular-nums">{label ?? "—"} מול התקופה הקודמת</span>;
}

function Kpi({
  hero,
  tone,
  label,
  value,
  text,
  hint,
  delta,
  spark,
  pending,
}: {
  hero?: boolean;
  tone: "sun" | "green" | "violet" | "teal" | "coral";
  label: string;
  value: number | null;
  text: (value: number) => string;
  hint: string;
  delta: React.ReactNode;
  spark?: number[];
  pending?: string;
}) {
  return (
    <article className={`kpi-cube px-4 py-4 sm:px-5 ${hero ? "kpi-hero" : ""}`} data-accent={hero ? undefined : tone}>
      <div className="flex items-start justify-between gap-2">
        <span className="kpi-badge" data-tone={tone} aria-hidden />
        {spark ? <Spark values={spark} /> : null}
      </div>
      <p className="mt-3 text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold leading-none tracking-tight">
        {value == null ? "ממתין" : <CountUp value={value} text={text} />}
      </p>
      <p className="mt-2 text-[11px] text-muted-foreground">{pending ?? hint}</p>
      <div className="mt-1">{delta}</div>
    </article>
  );
}

function Attention({ title, items, empty, href }: { title: string; items: DashView["attention"]["sla"]; empty: string; href: string }) {
  return (
    <section className="glass px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Link href={href} className="text-[11px] font-medium text-[#2f86ea]">לרשימה</Link>
      </div>
      {items.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">{empty}</p> : (
        <ul className="mt-2 space-y-1">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-white/80">
                <span className="truncate font-medium">{item.title}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{item.detail}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ShemeshDashboard({ input, sourceOptions }: { input: DashInput; sourceOptions: string[] }) {
  const [range, setRange] = useState<DashRange>({ from: monthStart(input.today), to: input.today });
  const [source, setSource] = useState("all");
  const view = useMemo(() => buildDashboard(input, range, source), [input, range, source]);
  const exportHref = `/api/shemesh/export?kind=dashboard&from=${range.from}&to=${range.to}&source=${encodeURIComponent(source)}`;

  return (
    <div className="mx-auto min-w-0 max-w-[76rem] space-y-4">
      <header className="glass glass-noise flex flex-col gap-3 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground">שמש</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="kpi-badge" data-tone="sun"><LayoutDashboard className="size-4" /></span>
              <h1 className="text-2xl font-semibold tracking-tight">לוח ניהול</h1>
            </div>
          </div>
          <a href={exportHref} className="text-sm font-medium text-[#2f86ea]">ייצוא הלוח לאקסל</a>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeField from={range.from} to={range.to} onChange={setRange} />
          <button type="button" className="h-10 rounded-full bg-white/80 px-3 text-xs font-medium" onClick={() => setRange({ from: monthStart(input.today), to: input.today })}>החודש</button>
          <button type="button" className="h-10 rounded-full bg-white/80 px-3 text-xs font-medium" onClick={() => setRange({ from: shiftIso(input.today, -29), to: input.today })}>30 יום</button>
          <select aria-label="מקור" value={source} onChange={(event) => setSource(event.target.value)} className="h-10 rounded-full border border-white/80 bg-white/80 px-3 text-xs">
            <option value="all">כל המקורות</option>
            {sourceOptions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <p className="text-[11px] text-muted-foreground">מכירות וגבייה רק מ־{SHEMESH_SALES_SOURCE_LABEL}. תיקים וספר הם תפעול.</p>
      </header>

      <section className="kpi-band grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi hero tone="sun" label="נמכר בתקופה" value={view.sold} text={formatIls} hint="לפי תאריך עסקה בדוח שמש" pending={view.salesReady ? undefined : "השלב הבא: ייבוא דוח המכירות בחיבורים"} delta={<Delta current={view.sold} previous={view.soldPrev} money />} spark={view.sparkSold} />
        <Kpi tone="green" label="נגבה בתקופה" value={view.collected} text={formatIls} hint="גיליון הגבייה בדוח שמש" pending={view.salesReady ? undefined : "ממתין לאותו דוח"} delta={<Delta current={view.collected} previous={view.collectedPrev} money />} spark={view.sparkCollected} />
        <Kpi tone="violet" label="פתוח לגבייה" value={view.openToCollect} text={formatIls} hint="נמכר פחות נגבה, בדוח שמש" pending={view.salesReady ? undefined : "ממתין לאותו דוח"} delta={<Delta current={view.openToCollect} previous={view.openToCollectPrev} money />} />
        <Kpi tone="teal" label="תיקים פעילים" value={view.activeCases} text={formatCount} hint="נפתחו בתקופה ועדיין פתוחים" delta={<Delta current={view.activeCases} previous={view.activeCasesPrev} />} />
        <Kpi tone="coral" label="חריגות SLA" value={view.slaBreaches} text={formatCount} hint="יעד שעבר והתיק עדיין פתוח" delta={<span className="text-[11px] text-current/70">מצב נוכחי, בלי היסטוריה שמורה</span>} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">דורש טיפול היום</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Attention title="חריגות SLA" items={view.attention.sla} empty="אין חריגה בתקופה." href="/shemesh/cases?focus=sla" />
          <Attention title="מסמכים חסרים" items={view.attention.docs} empty="אין מסמך חובה חסר בתיקים הפתוחים." href="/shemesh/cases?focus=docs" />
          <Attention title="יעדים בתקופה" items={view.attention.deadlines} empty="אין יעד שנשמר בתוך התאריכים." href="/shemesh/cases?focus=week" />
          <Attention title="בלי מטפל" items={view.attention.unassigned} empty="כל תיק שנפתח בתקופה משויך." href="/shemesh/cases?focus=unassigned" />
          <Attention title="לידים שנתקעו" items={view.attention.stale} empty={view.attention.stalePending ? "ימי SLA לא אומתו בהגדרות, ולכן אין סימון ליד תקוע." : "אין ליד שעבר את ימי ה-SLA."} href="/shemesh/cases?focus=stale" />
        </div>
      </section>

      <section className="glass px-4 py-4">
        <h2 className="text-sm font-semibold">משפך התיקים</h2>
        <p className="mt-1 text-[11px] text-muted-foreground">ספירה של תיקים שנפתחו בתקופה. אחוז המעבר הוא מול השלב הקודם. הימים הם מאז הפתיחה, אין חותמת כניסה לכל שלב.</p>
        <ol className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {view.funnel.map((stage, index) => {
            const max = Math.max(1, ...view.funnel.map((item) => item.count));
            return (
            <li key={stage.id} className="rounded-2xl border border-white/80 bg-white/70 px-3 py-3">
              <p className="text-[11px] text-muted-foreground">{formatCount(index + 1)}</p>
              <p className="mt-1 text-sm font-semibold">{stage.label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{formatCount(stage.count)}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                מעבר {stage.conversion == null ? "—" : `${formatCount(stage.conversion)}%`}
                {" · "}
                ימים {stage.avgDays == null ? "—" : formatCount(stage.avgDays)}
              </p>
              <div className="mt-2 h-1.5 rounded-full bg-white">
                <div className="h-1.5 rounded-full" style={{ width: `${(stage.count / max) * 100}%`, background: "linear-gradient(90deg, #9fd0ff, #2f86ea)" }} />
              </div>
            </li>
          );
          })}
        </ol>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="glass px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">גבייה בדוח שמש</h2>
            <Link href="/shemesh/gviya" className="text-[11px] font-medium text-[#2f86ea]">לפדיונות</Link>
          </div>
          {view.trend.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">אין עמודת גבייה. השלב הבא: ייבוא «דוח מכירות שמש פדיונות 2» במסך החיבורים.</p>
          ) : (
            <ul className="mt-4 flex items-end gap-2">
              {view.trend.map((row) => {
                const max = Math.max(...view.trend.map((item) => item.collected), 1);
                return (
                  <li key={row.month} className="group flex min-w-0 flex-1 flex-col items-center gap-1">
                    <span className="text-[10px] font-semibold tabular-nums opacity-0 transition-opacity group-hover:opacity-100">{formatIls(row.collected)}</span>
                    <div className="flex h-28 w-full items-end">
                      <div
                        className="w-full rounded-t-xl transition-transform group-hover:scale-[1.03]"
                        style={{ height: `${Math.max(8, (row.collected / max) * 100)}%`, background: "linear-gradient(180deg, #fff1a8, #ffd60a 42%, #ff7a3c)" }}
                        title={formatIls(row.collected)}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{formatShemeshMonth(row.month)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="glass px-4 py-4">
          <h2 className="text-sm font-semibold">שכר טרחה והתחשבנות</h2>
          <p className="mt-2 text-sm">
            שורות פתוחות בספר: {formatCount(view.openFeeRows)}. סכום שכר טרחה: {view.feesPending ? "ממתין לאימות השיעור" : formatIls(view.openFeeKnown)}.
          </p>
          <p className="mt-2 text-sm">
            {view.settlement
              ? `התחשבנות ${view.settlement.period}: ${STATUS_HE[view.settlement.status]}. עמלות ליבה ${formatIls(view.settlement.liba)}, ביטוח ${formatIls(view.settlement.insurance)}, חשבון ליבה ${formatIls(view.settlement.redemption)}.`
              : "אין טיוטת התחשבנות. השלב הבא: שמירה במסך ההתחשבנות."}
          </p>
          <Link href="/shemesh/settlement" className="mt-3 inline-block text-xs font-medium text-[#2f86ea]">להתחשבנות</Link>
        </section>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="glass px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">שיווק</h2>
            <Link href="/shemesh/marketing" className="text-[11px] font-medium text-[#2f86ea]">לקמפיינים</Link>
          </div>
          {view.sources.length === 0 && view.cpl == null ? (
            <p className="mt-3 text-sm text-muted-foreground">אין מקורות בדוח ואין לידים מקמפיין. השלב הבא: ייבוא הדוח וסנכרון חשבון המודעות.</p>
          ) : (
            <>
              <p className="mt-2 text-xs text-muted-foreground">
                עלות לליד {view.cpl == null ? "ממתין לסנכרון פרסום" : formatIls(view.cpl)}
                {" · "}
                ליד לתיק {view.leadToCase == null ? "ממתין ללידים" : `${formatCount(view.leadToCase)}%`}
              </p>
              <ul className="mt-3 space-y-2">
                {view.sources.map((row) => {
                  const max = Math.max(1, ...view.sources.map((item) => item.deals));
                  return (
                    <li key={row.name}>
                      <Link href="/shemesh/sales" className="block rounded-xl px-2 py-1.5 transition-colors hover:bg-white/80">
                        <div className="mb-1 flex justify-between gap-3 text-sm">
                          <span className="truncate font-medium">{row.name}</span>
                          <span className="tabular-nums">{formatCount(row.deals)} עסקאות</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/80">
                          <div className="h-1.5 rounded-full" style={{ width: `${(row.deals / max) * 100}%`, background: "linear-gradient(90deg, #b7b0ff, #5b4de0)" }} />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
        <section className="glass px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">צוות</h2>
            <Link href="/shemesh/cases" className="text-[11px] font-medium text-[#2f86ea]">לתיקים</Link>
          </div>
          {view.team.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">אין תיקים שנפתחו בתקופה. תיק חדש נפתח ממסך התיקים.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {view.team.map((row, index) => {
                const max = Math.max(1, ...view.team.map((item) => item.cases));
                const tones = ["sun", "teal", "violet", "green", "coral"] as const;
                return (
                  <li key={row.handler}>
                    <Link href="/shemesh/cases" className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/80">
                      <span className="kpi-badge !size-8 text-[11px] font-bold" data-tone={tones[index % tones.length]}>{row.handler.slice(0, 1)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex justify-between gap-2 text-sm">
                          <span className="truncate font-medium">{row.handler}</span>
                          <span className="tabular-nums text-muted-foreground">{formatCount(row.cases)} · {formatCount(row.sla)} חריגות</span>
                        </span>
                        <span className="mt-1 block h-1.5 rounded-full bg-white/80">
                          <span className="block h-1.5 rounded-full" style={{ width: `${(row.cases / max) * 100}%`, background: "linear-gradient(90deg, #7eefe8, #0e8f9c)" }} />
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="glass px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">פעילות אחרונה</h2>
          <Link href="/shemesh/access" className="text-[11px] font-medium text-[#2f86ea]">ליומן הגישה</Link>
        </div>
        {view.activity.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">אין שורות יומן בתקופה. פעולה על תיק או על ספר נרשמת כאן.</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/70">
            {view.activity.map((row) => (
              <li key={row.id}>
                <Link href="/shemesh/access" className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 text-sm transition-colors hover:bg-white/80">
                  <span>{row.summary}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{row.createdAt.slice(0, 16).replace("T", " ")}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
