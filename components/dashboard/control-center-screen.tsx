"use client";

import { useMemo, useState, Fragment } from "react";
import {
  Building2,
  ChevronLeft,
  Package,
  PhoneIncoming,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { DashboardCampaignStrip } from "@/components/dashboard/dashboard-campaign-strip";
import { useOperatingBrand } from "@/components/finance/operating-brand-bar";
import { useLiveDashboard } from "@/components/layout/live-dashboard-provider";
import {
  agentAppointmentMonthKeys,
  buildControlCenterDetail,
  buildControlCenterSnapshot,
  formatControlMonth,
  type AgentAppointmentPeriod,
  type ControlCenterDetail,
  type ControlCenterDetailKind,
  type ControlCenterDetailRow,
} from "@/lib/sales-dashboard/control-center";
import {
  STATUS_LABEL,
  formatIls,
} from "@/lib/sales-dashboard/campaign-math";
import { formatLastUpdatedAt } from "@/lib/sales-dashboard/marketing-copy";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function formatDay(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso || "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

export function ControlCenterScreen() {
  const { dashboard, ready } = useLiveDashboard();
  const { brand, shemeshEmployeeNames } = useOperatingBrand();
  const [openKind, setOpenKind] = useState<ControlCenterDetailKind | null>(null);
  const [appointmentPeriod, setAppointmentPeriod] = useState<AgentAppointmentPeriod>({
    preset: "month",
  });
  const scope = useMemo(
    () => ({ brand, shemeshEmployeeNames }),
    [brand, shemeshEmployeeNames],
  );

  const snap = useMemo(
    () => buildControlCenterSnapshot(dashboard, new Date(), scope),
    [dashboard, scope],
  );
  const appointmentMonths = useMemo(
    () => agentAppointmentMonthKeys(dashboard),
    [dashboard],
  );
  const detail = useMemo(
    () =>
      openKind
        ? buildControlCenterDetail(dashboard, openKind, new Date(), scope, appointmentPeriod)
        : null,
    [dashboard, openKind, scope, appointmentPeriod],
  );
  const syncedLabel = formatLastUpdatedAt(snap?.syncedAt);

  if (!ready) {
    return (
      <div className="space-y-3 sm:space-y-4">
        <div className="h-44 animate-pulse rounded-[1.25rem] border border-black/[0.06] bg-white sm:h-40 sm:rounded-[var(--radius)]" />
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-[1.25rem] border border-black/[0.06] bg-white sm:rounded-[var(--radius)]"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!snap) {
    return (
      <div className="relative overflow-hidden rounded-[1.25rem] border border-black/[0.06] bg-white px-5 py-8 sm:rounded-[var(--radius)] sm:px-8 sm:py-10">
        <span className="absolute inset-x-0 top-0 h-1 bg-highlight" />
        <p className="text-base font-semibold text-foreground">אין נתונים שמורים עדיין</p>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
          לחצו על סנכרון בשורה העליונה כדי לטעון את האקסל. אחרי הסנכרון יופיעו כאן
          הפקות, פרמיה ומובילים.
        </p>
      </div>
    );
  }

  const sideKpis: {
    kind: ControlCenterDetailKind;
    label: string;
    value: string;
    hint: string;
    tone?: "warn" | "danger" | "ok";
  }[] = [
    {
      kind: "productions",
      label: "הפקות",
      value: String(snap.productions),
      hint: "הפקה פעילה",
    },
    {
      kind: "pending",
      label: "ממתינות",
      value: String(snap.pending),
      hint: "צינור פתוח",
      tone: snap.pending > 0 ? "warn" : "ok",
    },
    {
      kind: "cancelled",
      label: "ביטולים",
      value: String(snap.cancelled),
      hint: snap.monthLabel,
      tone: snap.cancelled > 0 ? "danger" : "ok",
    },
  ];

  const leaders: {
    kind: ControlCenterDetailKind;
    label: string;
    icon: LucideIcon;
    name: string;
    count?: number;
    premium?: number;
  }[] = [
    {
      kind: "agent",
      label: "עובד מוביל",
      icon: UserRound,
      name: snap.topAgent?.name ?? "—",
      count: snap.topAgent?.count,
      premium: snap.topAgent?.premium,
    },
    {
      kind: "product",
      label: "מוצר מוביל",
      icon: Package,
      name: snap.topProduct?.name ?? "—",
      count: snap.topProduct?.count,
      premium: snap.topProduct?.premium,
    },
    {
      kind: "source",
      label: "מקור מוביל",
      icon: PhoneIncoming,
      name: snap.topSource?.name ?? "—",
      count: snap.topSource?.count,
      premium: snap.topSource?.premium,
    },
    {
      kind: "company",
      label: "חברת ביטוח",
      icon: Building2,
      name: snap.topCompany?.name ?? "—",
      count: snap.topCompany?.count,
      premium: snap.topCompany?.premium,
    },
  ];

  return (
    <div className="space-y-3">
      <section className="relative overflow-hidden rounded-[1.25rem] border border-black/[0.06] bg-white shadow-[0_1px_0_rgba(17,17,17,0.03)] sm:rounded-[var(--radius)]">
        <span className="absolute inset-x-0 top-0 h-1 bg-highlight" />
        <div className="grid grid-cols-2 gap-px bg-black/[0.06] lg:grid-cols-4">
          <button
            type="button"
            onClick={() => setOpenKind("upcoming")}
            className="group bg-[#fffcf0] px-4 py-3 text-start transition-[background-color,transform] active:scale-[0.995] hover:bg-highlight/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/15 sm:px-5 sm:py-4"
          >
            <span className="rounded-full bg-highlight px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
              {snap.upcomingDateLabel}
            </span>
            <p className="mt-2 text-[11px] font-medium tracking-wide text-muted-foreground">
              הפקות ב־{snap.upcomingDateLabel}
            </p>
            <p className="mt-1 text-3xl font-semibold leading-none tracking-tight tabular-nums sm:text-4xl">
              {snap.upcomingPremiumLabel}
            </p>
            <p className="mt-2 flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
              <span className="min-w-0 truncate">
                {snap.upcomingCount.toLocaleString("he-IL")} הפקות · מהחודש {snap.upcomingMonthCount.toLocaleString("he-IL")} · נגררות {snap.carriedCount.toLocaleString("he-IL")}
              </span>
              <ChevronLeft className="size-3.5 shrink-0 opacity-40 transition-transform group-hover:-translate-x-0.5" />
            </p>
          </button>

          <button
            type="button"
            onClick={() => setOpenKind("premium")}
            className="group bg-white px-4 py-3 text-start transition-colors hover:bg-[#fffcf0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/15 sm:px-5 sm:py-4"
          >
            <span className="rounded-full bg-highlight/45 px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
              {snap.monthLabel}
            </span>
            <p className="mt-2 text-[11px] font-medium tracking-wide text-muted-foreground">
              הפקות החודש
            </p>
            <p className="mt-1 text-3xl font-semibold leading-none tracking-tight tabular-nums sm:text-4xl">
              {snap.premiumLabel}
            </p>
            <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
              <span>{snap.productions.toLocaleString("he-IL")} הפקות פעילות</span>
              <ChevronLeft className="size-3.5 opacity-40 transition-transform group-hover:-translate-x-0.5" />
            </p>
          </button>

          <button
            type="button"
            onClick={() => setOpenKind("monthSales")}
            className="group bg-white px-4 py-3 text-start transition-colors hover:bg-[#fffcf0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/15 sm:px-5 sm:py-4"
          >
            <span className="rounded-full bg-black/[0.04] px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
              העברה ליצרן
            </span>
            <p className="mt-2 text-[11px] font-medium tracking-wide text-muted-foreground">
              מכירות
            </p>
            <p className="mt-1 text-3xl font-semibold leading-none tracking-tight tabular-nums sm:text-4xl">
              {formatIls(snap.salesPremium)}
            </p>
            <p className="mt-2 flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
              <span className="min-w-0 truncate">
                {snap.salesCount.toLocaleString("he-IL")} מכירות · מהחודש {snap.salesMonthCount.toLocaleString("he-IL")} · נגררות {snap.salesCarriedCount.toLocaleString("he-IL")}
              </span>
              <ChevronLeft className="size-3.5 shrink-0 opacity-40 transition-transform group-hover:-translate-x-0.5" />
            </p>
          </button>

          <button
            type="button"
            onClick={() => setOpenKind("agentAppointment")}
            className="group bg-white px-4 py-3 text-start transition-colors hover:bg-[#fffcf0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/15 sm:px-5 sm:py-4"
          >
            <span className="rounded-full bg-black/[0.04] px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
              העברה ליצרן
            </span>
            <p className="mt-2 text-[11px] font-medium tracking-wide text-muted-foreground">
              מינוי סוכן
            </p>
            <p className="mt-1 text-3xl font-semibold leading-none tracking-tight tabular-nums sm:text-4xl">
              {snap.agentAppointmentPremiumLabel}
            </p>
            <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
              <span>{snap.agentAppointmentCount.toLocaleString("he-IL")} מינויים</span>
              <ChevronLeft className="size-3.5 opacity-40 transition-transform group-hover:-translate-x-0.5" />
            </p>
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-black/[0.06] px-4 py-2 text-[11px] sm:px-5">
          {syncedLabel ? (
            <span className="tabular-nums text-muted-foreground">עודכן {syncedLabel}</span>
          ) : null}
          {sideKpis.filter((kpi) => kpi.kind !== "productions").map((kpi) => (
            <button
              key={kpi.kind}
              type="button"
              onClick={() => setOpenKind(kpi.kind)}
              className="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-[#fffcf0]"
            >
              <span className="text-muted-foreground">{kpi.label}</span>
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  kpi.tone === "warn" && "text-amber-800",
                  kpi.tone === "danger" && "text-red-700",
                )}
              >
                {kpi.value}
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setOpenKind("pendingMonth")}
            className="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-[#fffcf0]"
          >
            <span className="text-muted-foreground">בתהליך</span>
            <span className="font-semibold tabular-nums text-amber-800">
              {snap.pendingInMonth.toLocaleString("he-IL")}
            </span>
          </button>
        </div>
      </section>

      <DashboardCampaignStrip />

      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-3 px-0.5">
          <h2 className="text-sm font-semibold tracking-tight">מובילים החודש</h2>
          <p className="text-[11px] text-muted-foreground">
            לחצו על קובייה לפירוט
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
          {leaders.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.kind}
                type="button"
                onClick={() => setOpenKind(item.kind)}
                className="group relative min-w-0 overflow-hidden rounded-[1.25rem] border border-black/[0.06] bg-white px-3 py-2.5 text-start transition-[transform,background-color,border-color] active:scale-[0.98] hover:border-black/10 hover:bg-[#fffcf0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 sm:rounded-[var(--radius)] sm:px-4 sm:py-3"
              >
                <span className="absolute inset-y-0 start-0 w-1 origin-top scale-y-100 bg-highlight transition-transform duration-300 group-hover:scale-y-110" />
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-highlight/35 sm:size-8">
                      <Icon className="size-3.5 text-foreground sm:size-4" />
                    </span>
                    <p className="truncate text-[11px] font-medium text-muted-foreground">
                      {item.label}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-semibold tabular-nums text-black/30">
                    #{index + 1}
                    <ChevronLeft className="size-3.5 opacity-50 transition-transform group-hover:-translate-x-0.5" />
                  </span>
                </div>
                <p className="mt-2 truncate text-base font-semibold tracking-tight">
                  {item.name}
                </p>
                <p className="mt-1 truncate text-[11px] tabular-nums text-muted-foreground">
                  {item.count != null && item.premium != null
                    ? `${item.count} הפקות · ${formatIls(item.premium)}`
                    : "אין סגירות בחודש"}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <ControlCenterDetailDialog
        detail={detail}
        open={Boolean(openKind && detail)}
        onOpenChange={(next) => {
          if (!next) setOpenKind(null);
        }}
        appointmentPeriod={appointmentPeriod}
        appointmentMonths={appointmentMonths}
        onAppointmentPeriod={setAppointmentPeriod}
      />
    </div>
  );
}

function shiftMonthKey(monthKey: string, delta: number): string {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  const index = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

function splitSalesRows(
  rows: ControlCenterDetailRow[],
  monthKey: string,
): { monthRows: ControlCenterDetailRow[]; carriedRows: ControlCenterDetailRow[] } {
  const carriedMonths = new Set([1, 2, 3].map((back) => shiftMonthKey(monthKey, -back)));
  const carriedRows = rows.filter(
    (row) => row.status === "pending" && carriedMonths.has(row.transferDate.slice(0, 7)),
  );
  const carriedKeys = new Set(carriedRows.map((row) => row.key));
  return {
    monthRows: rows.filter((row) => !carriedKeys.has(row.key)),
    carriedRows,
  };
}

function splitUpcomingRows(rows: ControlCenterDetailRow[]): {
  monthRows: ControlCenterDetailRow[];
  carriedRows: ControlCenterDetailRow[];
} {
  const start = rows.find((row) => /^\d{4}-\d{2}/.test(row.startDate))?.startDate.slice(0, 7);
  if (!start) return { monthRows: rows, carriedRows: [] };
  const viewed = shiftMonthKey(start, -1);
  const carried = new Set([1, 2, 3].map((back) => shiftMonthKey(viewed, -back)));
  return {
    monthRows: rows.filter((row) => row.transferDate.slice(0, 7) === viewed),
    carriedRows: rows.filter((row) => carried.has(row.transferDate.slice(0, 7))),
  };
}

function ControlCenterDetailDialog({
  detail,
  open,
  onOpenChange,
  appointmentPeriod,
  appointmentMonths,
  onAppointmentPeriod,
}: {
  detail: ControlCenterDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentPeriod: AgentAppointmentPeriod;
  appointmentMonths: string[];
  onAppointmentPeriod: (period: AgentAppointmentPeriod) => void;
}) {
  const grouped =
    detail?.kind === "upcoming"
      ? splitUpcomingRows(detail.rows)
      : detail?.kind === "monthSales" && detail.monthKey
        ? splitSalesRows(detail.rows, detail.monthKey)
        : null;
  const sections = grouped
    ? [
        { label: "מהחודש", rows: grouped.monthRows },
        { label: "נגררות", rows: grouped.carriedRows },
      ]
    : [{ label: "", rows: detail?.rows ?? [] }];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] max-w-[96vw] flex-col gap-0 overflow-hidden rounded-[1.35rem] p-0 sm:max-w-5xl sm:rounded-[var(--radius)]">
        {detail ? (
          <>
            <DialogHeader className="border-b border-black/[0.06] px-4 py-4 text-start sm:px-6">
              {detail.kind === "agentAppointment" ? (
                <div className="mb-3 flex flex-wrap items-center gap-1.5 pe-8">
                  {(
                    [
                      { preset: "month", label: "החודש" },
                      { preset: "prev", label: "חודש שעבר" },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.preset}
                      type="button"
                      onClick={() => onAppointmentPeriod({ preset: item.preset })}
                      className={cn(
                        "rounded-full px-3 py-1 text-[12px] font-semibold transition-colors",
                        appointmentPeriod.preset === item.preset
                          ? "bg-highlight text-foreground"
                          : "bg-black/[0.04] text-muted-foreground hover:bg-black/[0.06]",
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                  <select
                    aria-label="חודש לפי בחירה"
                    value={appointmentPeriod.preset === "pick" ? appointmentPeriod.monthKey : ""}
                    onChange={(event) => {
                      const monthKey = event.target.value;
                      if (monthKey) onAppointmentPeriod({ preset: "pick", monthKey });
                    }}
                    className={cn(
                      "rounded-full px-3 py-1 text-[12px] font-semibold outline-none",
                      appointmentPeriod.preset === "pick"
                        ? "bg-highlight text-foreground"
                        : "bg-black/[0.04] text-muted-foreground",
                    )}
                  >
                    <option value="">חודש לפי בחירה</option>
                    {appointmentMonths.map((monthKey) => (
                      <option key={monthKey} value={monthKey}>
                        {formatControlMonth(monthKey)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => onAppointmentPeriod({ preset: "ytd" })}
                    className={cn(
                      "rounded-full px-3 py-1 text-[12px] font-semibold transition-colors",
                      appointmentPeriod.preset === "ytd"
                        ? "bg-highlight text-foreground"
                        : "bg-black/[0.04] text-muted-foreground hover:bg-black/[0.06]",
                    )}
                  >
                    מתחילת שנה
                  </button>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 pe-8">
                <span className="rounded-full bg-highlight/40 px-2.5 py-0.5 text-[11px] font-semibold">
                  {detail.monthLabel}
                </span>
                <DialogTitle className="text-lg font-semibold tracking-tight">
                  {detail.title}
                </DialogTitle>
              </div>
              <DialogDescription className="mt-1 text-sm text-foreground">
                {detail.subtitle}
              </DialogDescription>
              <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">
                {detail.explanation}
              </p>
              {grouped ? (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    {
                      label: "מהחודש",
                      count: grouped.monthRows.length,
                      premium: grouped.monthRows.reduce((sum, row) => sum + row.premium, 0),
                    },
                    {
                      label: "נגררות",
                      count: grouped.carriedRows.length,
                      premium: grouped.carriedRows.reduce((sum, row) => sum + row.premium, 0),
                    },
                    {
                      label: "סה״כ",
                      count: detail.count,
                      premium: detail.premium,
                    },
                  ].map((cube) => (
                    <div key={cube.label} className="rounded-2xl bg-black/[0.03] px-3 py-2.5">
                      <p className="text-[11px] text-muted-foreground">{cube.label}</p>
                      <p className="mt-1 text-xl font-semibold tabular-nums leading-none">
                        {cube.count.toLocaleString("he-IL")}
                      </p>
                      <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                        {formatIls(cube.premium)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-5 text-sm">
                  <div>
                    <p className="text-[11px] text-muted-foreground">שורות</p>
                    <p className="font-semibold tabular-nums">{detail.count}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">סכום פרמיה</p>
                    <p className="font-semibold tabular-nums">{detail.premiumLabel}</p>
                  </div>
                </div>
              )}
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
              {detail.ranking.length > 1 ? (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground">
                    דירוג לפי פרמיה
                  </h3>
                  <div className="mt-2 overflow-hidden rounded-2xl border border-black/[0.06]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-black/[0.05] bg-background/60 text-[11px] text-muted-foreground">
                          <th className="px-3 py-2 text-start font-medium">#</th>
                          <th className="px-3 py-2 text-start font-medium">שם</th>
                          <th className="px-3 py-2 text-end font-medium">שורות</th>
                          <th className="px-3 py-2 text-end font-medium">פרמיה</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.ranking.map((row, idx) => (
                          <tr
                            key={`${row.name}-${idx}`}
                            className={cn(
                              "border-b border-black/[0.04] last:border-b-0",
                              idx === 0 && "bg-highlight/15",
                            )}
                          >
                            <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                              {idx + 1}
                            </td>
                            <td className="px-3 py-2.5 font-medium">{row.name}</td>
                            <td className="px-3 py-2.5 text-end tabular-nums">
                              {row.count}
                            </td>
                            <td className="px-3 py-2.5 text-end tabular-nums">
                              {formatIls(row.premium)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              <div>
                <h3 className="text-xs font-semibold text-muted-foreground">
                  {detail.kind === "monthSales"
                    ? "פירוט מכירות"
                    : detail.kind === "agentAppointment"
                      ? "פירוט מינוי סוכן"
                      : "פירוט הפקות"} ({detail.rows.length})
                </h3>
                {detail.rows.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">אין שורות להצגה.</p>
                ) : (
                  <>
                    {/* Mobile cards */}
                    <ul className="mt-2 space-y-2 sm:hidden">
                      {sections.map((section) => (
                        <li key={section.label || "all"} className="space-y-2">
                          {section.label ? (
                            <p className="px-1 pt-1 text-[11px] font-semibold text-muted-foreground">
                              {section.label} · {section.rows.length.toLocaleString("he-IL")}
                            </p>
                          ) : null}
                          <ul className="space-y-2">
                            {section.rows.map((row) => (
                              <li
                                key={row.key}
                                className="rounded-2xl border border-black/[0.06] bg-white px-3.5 py-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold">{row.client}</p>
                                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                                      תחילת ביטוח {formatDay(row.startDate)} · העברה ליצרן{" "}
                                      {formatDay(row.transferDate)} · {row.agent}
                                    </p>
                                  </div>
                                  <p className="shrink-0 text-sm font-semibold tabular-nums">
                                    {formatIls(row.premium)}
                                  </p>
                                </div>
                                <p className="mt-2 truncate text-[11px] text-muted-foreground">
                                  {row.product} · {row.source} · {row.company}
                                </p>
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                  {row.statusRaw && row.statusRaw !== "—" ? row.statusRaw : STATUS_LABEL[row.status]}
                                </p>
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>

                    {/* Desktop table */}
                    <div className="mt-2 hidden overflow-hidden rounded-xl border border-black/[0.06] sm:block">
                      <div className="max-h-[42vh] overflow-auto">
                        <table className="w-full min-w-[52rem] text-sm">
                          <thead className="sticky top-0 bg-white">
                            <tr className="border-b border-black/[0.05] text-[11px] text-muted-foreground">
                              <th className="px-3 py-2 text-start font-medium">תחילת ביטוח</th>
                              <th className="whitespace-nowrap px-3 py-2 text-start font-medium">
                                העברה ליצרן
                              </th>
                              <th className="px-3 py-2 text-start font-medium">לקוח</th>
                              <th className="px-3 py-2 text-start font-medium">משווק</th>
                              <th className="px-3 py-2 text-start font-medium">מוצר</th>
                              <th className="px-3 py-2 text-start font-medium">מקור</th>
                              <th className="px-3 py-2 text-start font-medium">חברה</th>
                              <th className="px-3 py-2 text-start font-medium">סטטוס</th>
                              <th className="px-3 py-2 text-end font-medium">פרמיה</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sections.map((section) => (
                              <Fragment key={section.label || "all"}>
                                {section.label ? (
                                  <tr className="bg-black/[0.03]">
                                    <td
                                      colSpan={9}
                                      className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground"
                                    >
                                      {section.label} · {section.rows.length.toLocaleString("he-IL")}
                                    </td>
                                  </tr>
                                ) : null}
                                {section.rows.map((row) => (
                                  <tr
                                    key={row.key}
                                    className="border-b border-black/[0.04] last:border-b-0"
                                  >
                                    <td className="px-3 py-2 tabular-nums text-muted-foreground">
                                      {formatDay(row.startDate)}
                                    </td>
                                    <td className="px-3 py-2 tabular-nums text-muted-foreground">
                                      {formatDay(row.transferDate)}
                                    </td>
                                    <td className="px-3 py-2 font-medium">{row.client}</td>
                                    <td className="px-3 py-2">{row.agent}</td>
                                    <td className="px-3 py-2">{row.product}</td>
                                    <td className="px-3 py-2">{row.source}</td>
                                    <td className="px-3 py-2">{row.company}</td>
                                    <td className="px-3 py-2">
                                      <span className="text-[11px] text-muted-foreground">
                                        {row.statusRaw && row.statusRaw !== "—" ? row.statusRaw : STATUS_LABEL[row.status]}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-end tabular-nums font-medium">
                                      {formatIls(row.premium)}
                                    </td>
                                  </tr>
                                ))}
                              </Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
