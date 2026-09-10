"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  ChevronLeft,
  Package,
  PhoneIncoming,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useLiveDashboard } from "@/components/layout/live-dashboard-provider";
import {
  buildControlCenterDetail,
  buildControlCenterSnapshot,
  type ControlCenterDetail,
  type ControlCenterDetailKind,
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
  const [openKind, setOpenKind] = useState<ControlCenterDetailKind | null>(null);

  const snap = useMemo(
    () => buildControlCenterSnapshot(dashboard),
    [dashboard],
  );
  const detail = useMemo(
    () =>
      openKind ? buildControlCenterDetail(dashboard, openKind) : null,
    [dashboard, openKind],
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
      hint: "מכירות פעילות",
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
    <div className="space-y-4 sm:space-y-5">
      <section className="relative overflow-hidden rounded-[1.25rem] border border-black/[0.06] bg-white shadow-[0_1px_0_rgba(17,17,17,0.03)] sm:rounded-[var(--radius)]">
        <span className="absolute inset-x-0 top-0 h-1 bg-highlight" />
        <div className="flex flex-col gap-4 px-4 py-4 sm:gap-6 sm:px-7 sm:py-6 lg:flex-row lg:items-stretch lg:gap-0">
          <button
            type="button"
            onClick={() => setOpenKind("premium")}
            className="group min-w-0 flex-1 rounded-2xl text-start transition-[background-color,transform] active:scale-[0.985] hover:bg-[#fffcf0]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 lg:pe-8"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-highlight/45 px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
                {snap.monthLabel}
              </span>
              {syncedLabel ? (
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  עודכן {syncedLabel}
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-[11px] font-medium tracking-wide text-muted-foreground sm:mt-4">
              פרמיה פעילה החודש
            </p>
            <p className="mt-1 text-[2.15rem] font-semibold leading-none tracking-tight tabular-nums sm:text-5xl">
              {snap.premiumLabel}
            </p>
            <p className="mt-2.5 flex items-center gap-1 text-sm text-muted-foreground">
              <span>
                {snap.productions} הפקות פעילות
              </span>
              <ChevronLeft className="size-3.5 opacity-40 transition-transform group-hover:-translate-x-0.5" />
            </p>
          </button>

          <div className="grid min-w-0 grid-cols-3 gap-px overflow-hidden rounded-2xl border border-black/[0.06] bg-black/[0.06] lg:w-[min(100%,28rem)] lg:shrink-0">
            {sideKpis.map((kpi) => (
              <button
                key={kpi.kind}
                type="button"
                onClick={() => setOpenKind(kpi.kind)}
                className="flex min-w-0 flex-col justify-between bg-white px-2 py-3.5 text-start transition-[background-color,transform] active:scale-[0.98] hover:bg-[#fffcf0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/15 sm:px-4 sm:py-4"
              >
                <p className="truncate text-[10px] font-medium text-muted-foreground sm:text-[11px]">
                  {kpi.label}
                </p>
                <p
                  className={cn(
                    "mt-2 text-lg font-semibold tabular-nums tracking-tight sm:mt-3 sm:text-3xl",
                    kpi.tone === "warn" && "text-amber-800",
                    kpi.tone === "danger" && "text-red-700",
                  )}
                >
                  {kpi.value}
                </p>
                <p className="mt-1 truncate text-[10px] leading-tight text-muted-foreground sm:text-[11px]">
                  {kpi.hint}
                </p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-2.5 sm:space-y-3">
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
                className="group relative min-w-0 overflow-hidden rounded-[1.25rem] border border-black/[0.06] bg-white px-3.5 py-3.5 text-start transition-[transform,background-color,border-color] active:scale-[0.98] hover:border-black/10 hover:bg-[#fffcf0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 sm:rounded-[var(--radius)] sm:px-5 sm:py-4"
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
                <p className="mt-3 truncate text-base font-semibold tracking-tight sm:mt-4 sm:text-lg">
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
      />
    </div>
  );
}

function ControlCenterDetailDialog({
  detail,
  open,
  onOpenChange,
}: {
  detail: ControlCenterDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] max-w-[96vw] flex-col gap-0 overflow-hidden rounded-[1.35rem] p-0 sm:max-w-5xl sm:rounded-[var(--radius)]">
        {detail ? (
          <>
            <DialogHeader className="border-b border-black/[0.06] px-4 py-4 text-start sm:px-6">
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
                          <th className="px-3 py-2 text-end font-medium">הפקות</th>
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
                  פירוט הפקות ({detail.rows.length})
                </h3>
                {detail.rows.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">אין שורות להצגה.</p>
                ) : (
                  <>
                    {/* Mobile cards */}
                    <ul className="mt-2 space-y-2 sm:hidden">
                      {detail.rows.map((row) => (
                        <li
                          key={row.key}
                          className="rounded-2xl border border-black/[0.06] bg-white px-3.5 py-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{row.client}</p>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                {formatDay(row.date)} · {row.agent}
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
                            {STATUS_LABEL[row.status] ?? row.statusRaw}
                          </p>
                        </li>
                      ))}
                    </ul>

                    {/* Desktop table */}
                    <div className="mt-2 hidden overflow-hidden rounded-xl border border-black/[0.06] sm:block">
                      <div className="max-h-[42vh] overflow-auto">
                        <table className="w-full min-w-[44rem] text-sm">
                          <thead className="sticky top-0 bg-white">
                            <tr className="border-b border-black/[0.05] text-[11px] text-muted-foreground">
                              <th className="px-3 py-2 text-start font-medium">תאריך</th>
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
                            {detail.rows.map((row) => (
                              <tr
                                key={row.key}
                                className="border-b border-black/[0.04] last:border-b-0"
                              >
                                <td className="px-3 py-2 tabular-nums text-muted-foreground">
                                  {formatDay(row.date)}
                                </td>
                                <td className="px-3 py-2 font-medium">{row.client}</td>
                                <td className="px-3 py-2">{row.agent}</td>
                                <td className="px-3 py-2">{row.product}</td>
                                <td className="px-3 py-2">{row.source}</td>
                                <td className="px-3 py-2">{row.company}</td>
                                <td className="px-3 py-2">
                                  <span className="text-[11px] text-muted-foreground">
                                    {STATUS_LABEL[row.status] ?? row.statusRaw}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-end tabular-nums font-medium">
                                  {formatIls(row.premium)}
                                </td>
                              </tr>
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
