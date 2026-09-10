"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Copy, ExternalLink, ChevronLeft, Search } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { addCampaignExpense } from "@/app/actions/marketing-campaigns";
import { cn } from "@/lib/utils";
import {
  CHANNEL_LABEL,
  STATUS_LABEL,
  campaignPnl,
  cubeMarketingTotals,
  formatIls,
  formatIlsSigned,
  facebookAdsRollup,
  googleAdsRollup,
  inDateRange,
  isGoogleAdsCube,
  jerusalemYmd,
  type AgentRate,
  type CampaignExpense,
  type DateRange,
  type ExpenseChannel,
  type FacebookAdsCampaignRow,
  type FacebookAdsDailyStat,
  type GoogleAdsCampaignRow,
  type GoogleAdsDailyStat,
} from "@/lib/sales-dashboard/campaign-math";
import {
  formatCampaignOwnerCopy,
  groupWorkers,
  workerWageBreakdown,
  type WorkerWageBreakdown,
  type WorkerWageDetailLine,
} from "@/lib/sales-dashboard/marketing-copy";
import {
  wageForOneProduction,
  buildMonthlyAgentPremiumTotals,
  productionDateOf,
  type EmployeePayProfile,
  type WageExplainReason,
} from "@/lib/employees/contract";
import { monthLabel } from "@/lib/employees/review";
import type { SourcePnlKind } from "@/lib/sales-dashboard/columns";
import type { MarketingProduction } from "@/lib/sales-dashboard/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FacebookAdsCubePanel } from "@/components/marketing-dashboard/facebook-ads-panel";
import type { GoogleAdsConnection } from "@/app/actions/google-ads";
import { EXPENSES_PATH } from "@/lib/finance/access";

function ils(n: number): string {
  return formatIls(n);
}

export function Money({
  value,
  signed,
  minus,
  className,
}: {
  value: number;
  signed?: boolean;
  minus?: boolean;
  className?: string;
}) {
  const text = minus
    ? `-${formatIls(value)}`
    : signed
      ? formatIlsSigned(value)
      : formatIls(value);
  return (
    <span dir="ltr" className={cn("inline-block tabular-nums", className)}>
      {text}
    </span>
  );
}

export type CampaignLineKind = "premium" | "income" | "wage" | "marketing" | "net";

type TabId =
  | "overview"
  | "productions"
  | "expenses"
  | "workers"
  | "google"
  | "facebook";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  asOf: string;
  rangeLabel: string;
  range: DateRange;
  productions: MarketingProduction[];
  excelRows: MarketingProduction[];
  excelHeaders: string[];
  expenses: CampaignExpense[];
  rates: AgentRate[];
  payProfiles?: EmployeePayProfile[];
  wageKind?: SourcePnlKind;
  wageContextRows?: MarketingProduction[];
  defaultMultiplier: number;
  insurerMultiplier: number;
  googleAds: GoogleAdsConnection;
  googleCampaigns: GoogleAdsCampaignRow[];
  googleStats: GoogleAdsDailyStat[];
  facebookCampaigns: FacebookAdsCampaignRow[];
  facebookStats: FacebookAdsDailyStat[];
  onChanged: () => void;
};

export function CampaignDialog({
  open,
  onOpenChange,
  name,
  asOf,
  rangeLabel,
  range,
  productions,
  excelRows = [],
  excelHeaders = [],
  expenses,
  rates,
  payProfiles = [],
  wageKind = "volume",
  wageContextRows,
  defaultMultiplier,
  insurerMultiplier,
  googleCampaigns,
  googleStats,
  facebookCampaigns,
  facebookStats,
}: Props) {
  const [tab, setTab] = useState<TabId>("productions");

  useEffect(() => {
    setTab(isGoogleAdsCube(name) ? "google" : "productions");
  }, [name]);

  const active = productions.filter((row) => row.status === "active");
  const pendingRows = productions.filter((row) => row.status === "pending");
  const premium = active.reduce((sum, row) => sum + row.premium, 0);
  const pendingPremium = pendingRows.reduce((sum, row) => sum + row.premium, 0);
  const google = googleAdsRollup(name, googleCampaigns, googleStats, range);
  const facebook = facebookAdsRollup(name, facebookCampaigns, facebookStats, range);
  const marketing = cubeMarketingTotals(
    name,
    expenses,
    google.cost,
    google.campaigns.length,
    facebook.cost,
    facebook.campaigns.length,
  );
  const adsTotal = marketing.adsTotal;
  const workers = useMemo(
    () =>
      groupWorkers(productions, rates, defaultMultiplier, {
        profiles: payProfiles,
        kind: wageKind,
        contextRows: wageContextRows ?? productions,
      }),
    [productions, rates, defaultMultiplier, payProfiles, wageKind, wageContextRows],
  );
  const wageTotal = workers.reduce((sum, row) => sum + row.wage, 0);
  const pnl = campaignPnl({
    premium,
    wageTotal,
    adsTotal,
    insurerMultiplier,
  });
  const copyText = formatCampaignOwnerCopy({
    name,
    asOf,
    rangeLabel,
    activeCount: active.length,
    premium,
    pendingCount: pendingRows.length,
    pendingPremium,
    expenses,
    wageTotal,
    workers,
    insurerMultiplier,
  });

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(copyText);
      toast.success("הסיכום הועתק");
    } catch {
      toast.error("לא ניתן להעתיק");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fixed inset-x-2 top-[max(0.5rem,env(safe-area-inset-top))] bottom-[max(0.5rem,env(safe-area-inset-bottom))] flex h-auto max-h-none w-auto max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-[1.25rem] border-black/[0.08] p-0 shadow-[0_24px_80px_-24px_rgba(17,17,17,0.45)] data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0 data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0 sm:inset-auto sm:bottom-auto sm:left-[50%] sm:right-auto sm:top-[50%] sm:h-auto sm:max-h-[min(92dvh,calc(100dvh-1.5rem))] sm:w-[min(96vw,72rem)] sm:max-w-[72rem] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-[1.5rem] sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%] sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%]">
        <DialogHeader className="relative shrink-0 space-y-0 overflow-hidden border-b border-black/[0.06] bg-white px-4 pb-4 pt-5 text-start sm:px-7 sm:pb-6 sm:pt-6">
          <span className="absolute inset-x-0 top-0 h-1 bg-highlight" />
          <div className="flex flex-col gap-3 pe-10 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4 sm:pe-8">
            <div className="min-w-0">
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground">
                מקור פנייה · כל שורות האקסל
              </p>
              <DialogTitle className="mt-1.5 line-clamp-2 text-[1.35rem] font-semibold leading-tight tracking-tight sm:text-3xl sm:leading-none">
                {name}
              </DialogTitle>
              <DialogDescription className="mt-2 text-[12px] text-muted-foreground sm:text-sm">
                <span className="font-medium text-foreground">{rangeLabel}</span>
                <span className="mx-2 text-black/20">·</span>
                נכון ל־{asOf}
              </DialogDescription>
            </div>
            <StatusBadge status={pnl.status} amount={pnl.net} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:grid-cols-3 sm:gap-2.5 lg:grid-cols-6">
            <Mini
              label="הפקות פעילות"
              value={String(active.length)}
              hint={`${productions.length} הפקות`}
            />
            <Mini label="פרמיה שנסגרה" value={<Money value={premium} />} />
            <Mini
              label={`הכנסה ×${insurerMultiplier}`}
              value={<Money value={pnl.income} />}
              hint={`עובדים ${workers.length} · גוגל ${google.campaigns.length} · פייסבוק ${facebook.campaigns.length}`}
            />
            <Mini label="שכר עובדים" value={<Money value={wageTotal} minus />} />
            <Mini label="שיווק והוצאות" value={<Money value={adsTotal} minus />} />
            <Mini
              label="רווח / הפסד"
              value={<Money value={pnl.net} signed />}
              emphasize={pnl.status === "profit" ? "profit" : pnl.status === "loss" ? "loss" : undefined}
            />
          </div>
          <div className="mt-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 hide-scrollbar sm:mx-0 sm:mt-5 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
            <TabButton id="overview" tab={tab} onClick={setTab} label="סיכום" />
            <TabButton
              id="productions"
              tab={tab}
              onClick={setTab}
              label="אקסל"
              count={excelRows.length}
            />
            <TabButton
              id="expenses"
              tab={tab}
              onClick={setTab}
              label="הוצאות"
              count={expenses.length}
            />
            <TabButton
              id="workers"
              tab={tab}
              onClick={setTab}
              label="שכר"
              count={workers.length}
            />
            <TabButton
              id="google"
              tab={tab}
              onClick={setTab}
              label="גוגל אדס"
              count={google.campaigns.length}
            />
            <TabButton
              id="facebook"
              tab={tab}
              onClick={setTab}
              label="פייסבוק"
              count={facebook.campaigns.length}
            />
            <button
              type="button"
              onClick={() => void copySummary()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-highlight px-3.5 py-2 text-xs font-bold text-black transition-transform active:scale-95 sm:ms-auto"
            >
              <Copy className="size-3.5" />
              העתק סיכום
            </button>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#fafafa] px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7 sm:py-6 sm:pb-6">
          {tab === "overview" ? (
            <OverviewPanel
              workers={workers}
              wageTotal={wageTotal}
              adsTotal={adsTotal}
              income={pnl.income}
              net={pnl.net}
              insurerMultiplier={insurerMultiplier}
              byChannel={marketing.byChannel}
              expenses={expenses}
              googleCost={google.cost}
              facebookCost={facebook.cost}
              premium={premium}
              activeCount={active.length}
              pendingCount={pendingRows.length}
              pendingPremium={pendingPremium}
            />
          ) : null}
          {tab === "productions" ? (
            <ProductionsTable
              rows={excelRows}
              rangeRows={productions}
              headers={excelHeaders}
              rangeLabel={rangeLabel}
              range={range}
              rates={rates}
              payProfiles={payProfiles}
              wageKind={wageKind}
              wageContextRows={wageContextRows ?? productions}
              defaultMultiplier={defaultMultiplier}
            />
          ) : null}
          {tab === "expenses" ? (
            <ExpensesReadonlyPanel
              expenses={expenses}
              byChannel={marketing.byChannel}
              adsTotal={adsTotal}
              googleCost={google.cost}
              facebookCost={facebook.cost}
            />
          ) : null}
          {tab === "workers" ? (
            <WorkersTable
              workers={workers}
              productions={productions}
              rates={rates}
              payProfiles={payProfiles}
              wageKind={wageKind}
              wageContextRows={wageContextRows ?? productions}
              defaultMultiplier={defaultMultiplier}
            />
          ) : null}
          {tab === "google" ? (
            <AdsCampaignReadonlyTable
              title="גוגל אדס"
              rangeLabel={rangeLabel}
              emptyText={`אין קמפיינים של גוגל אדס המשויכים ל«${name}» בטווח.`}
              rows={google.campaigns.map((row) => ({
                id: row.googleCampaignId,
                name: row.googleCampaignName,
                status: row.status,
                cost: row.cost,
                clicks: row.clicks,
                impressions: row.impressions,
              }))}
            />
          ) : null}
          {tab === "facebook" ? (
            <FacebookAdsCubePanel
              sourceName={name}
              rangeLabel={rangeLabel}
              mapped={facebook.campaigns}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({
  status,
  amount,
}: {
  status: "profit" | "loss" | "no-cost";
  amount: number;
}) {
  const map = {
    profit: { label: "רווח", className: "bg-emerald-600 text-white" },
    loss: { label: "הפסד", className: "bg-red-600 text-white" },
    "no-cost": { label: "אין סגירות", className: "bg-zinc-100 text-zinc-700" },
  } as const;
  const item = map[status];
  return (
    <div
      className={cn(
        "inline-flex w-fit max-w-full shrink-0 flex-wrap items-center gap-2 rounded-2xl px-3 py-1.5 text-sm font-semibold shadow-[0_1px_0_rgba(17,17,17,0.04)] sm:px-3.5 sm:py-2",
        item.className,
      )}
    >
      {item.label}
      <span className="text-xs font-medium opacity-90">
        <Money value={amount} signed />
      </span>
    </div>
  );
}

function Mini({
  label,
  value,
  hint,
  emphasize,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  emphasize?: "profit" | "loss";
}) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-[#fafafa] px-2.5 py-2 shadow-[0_1px_0_rgba(17,17,17,0.02)] sm:px-3 sm:py-2.5">
      <p className="truncate text-[10px] font-medium text-muted-foreground sm:text-[11px]">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 break-words text-[13px] font-semibold leading-tight tracking-tight tabular-nums sm:text-sm",
          emphasize === "profit" && "text-emerald-700",
          emphasize === "loss" && "text-red-700",
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function TabButton({
  id,
  tab,
  onClick,
  label,
  count,
}: {
  id: TabId;
  tab: TabId;
  onClick: (id: TabId) => void;
  label: string;
  count?: number;
}) {
  const selected = tab === id;
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={cn(
        "shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors active:scale-95 sm:py-1.5",
        selected
          ? "bg-black text-white"
          : "bg-muted/70 text-muted-foreground hover:bg-muted",
      )}
    >
      {label}
      {count != null ? (
        <span className="ms-1.5 tabular-nums opacity-80">{count}</span>
      ) : null}
    </button>
  );
}

function OverviewPanel({
  workers,
  wageTotal,
  adsTotal,
  income,
  net,
  insurerMultiplier,
  byChannel,
  expenses,
  googleCost,
  facebookCost,
  premium,
  activeCount,
  pendingCount,
  pendingPremium,
}: {
  workers: { name: string; count: number; sum: number; multiplier: number; wage: number }[];
  wageTotal: number;
  adsTotal: number;
  income: number;
  net: number;
  insurerMultiplier: number;
  byChannel: Record<ExpenseChannel, number>;
  expenses: CampaignExpense[];
  googleCost: number;
  facebookCost: number;
  premium: number;
  activeCount: number;
  pendingCount: number;
  pendingPremium: number;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[1.25rem] border border-black/[0.06] bg-white p-4 shadow-[0_1px_0_rgba(17,17,17,0.03)] sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold tracking-tight">שכר עובדים</h3>
            <Money value={wageTotal} className="text-sm font-semibold" />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            מחושב אוטומטית לפי הסכם העובד — היקף בדוח היקף, נפרעים בדוח נפרעים.
          </p>
          {workers.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">אין סגירות פעילות בטווח.</p>
          ) : (
            <ul className="mt-3 max-h-56 space-y-1.5 overflow-y-auto text-sm">
              {workers.map((worker) => (
                <li key={worker.name} className="flex items-baseline justify-between gap-3">
                  <span>
                    {worker.name}
                    <span className="ms-2 text-xs text-muted-foreground">
                      {ils(worker.sum)} × {worker.multiplier}
                    </span>
                  </span>
                  <span className="font-semibold">
                    <Money value={worker.wage} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-[1.25rem] border border-black/[0.06] bg-white p-4 shadow-[0_1px_0_rgba(17,17,17,0.03)] sm:p-5">
          <h3 className="text-sm font-semibold tracking-tight">רווח מדויק</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex justify-between gap-3">
              <span className="text-muted-foreground">
                פרמיה שנסגרה ({activeCount} הפקות)
              </span>
              <Money value={premium} />
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-muted-foreground">
                הכנסה מחברות ×{insurerMultiplier}
              </span>
              <Money value={income} />
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-muted-foreground">שכר עובדים</span>
              <Money value={wageTotal} minus />
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-muted-foreground">גוגל אדס</span>
              <Money value={byChannel.google || googleCost} minus />
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-muted-foreground">פייסבוק</span>
              <Money value={byChannel.facebook || facebookCost} minus />
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-muted-foreground">הוצאות משויכות</span>
              <Money value={byChannel.manual} minus />
            </li>
            <li className="flex justify-between gap-3 border-t border-black/[0.06] pt-2 font-semibold">
              <span>רווח / הפסד</span>
              <Money value={net} signed />
            </li>
          </ul>
          {pendingCount > 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {pendingCount} הפקות בתהליך לא נספרות
              {pendingPremium > 0 ? (
                <>
                  {" "}
                  (<Money value={pendingPremium} className="text-xs" />)
                </>
              ) : null}
            </p>
          ) : null}
        </section>
      </div>

      <section className="rounded-[1.25rem] border border-black/[0.06] bg-white p-4 shadow-[0_1px_0_rgba(17,17,17,0.03)] sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">הוצאות משויכות למקור</h3>
            <p className="mt-1 text-[11px] text-muted-foreground">
              מגיעות מקטגוריית «הוצאות» לפי שיוך מקור · סה״כ שיווק והוצאות{" "}
              <Money value={adsTotal} className="text-xs font-semibold" />
            </p>
          </div>
          <Link
            href={EXPENSES_PATH}
            className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.08] bg-[#fafafa] px-3 py-2 text-xs font-semibold transition-colors hover:bg-muted active:scale-95"
          >
            לעריכת הוצאות
            <ExternalLink className="size-3.5" />
          </Link>
        </div>
        {expenses.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            אין הוצאות משויכות בטווח — הוסיפו בהוצאות עם שיוך למקור.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/[0.06] text-[11px] text-muted-foreground">
                  <th className="py-2 text-start font-semibold">תאריך</th>
                  <th className="py-2 text-start font-semibold">סוג</th>
                  <th className="py-2 text-start font-semibold">פירוט</th>
                  <th className="py-2 text-start font-semibold">סכום</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((row) => (
                  <tr key={row.id} className="border-b border-black/[0.04] last:border-0">
                    <td className="py-2.5 tabular-nums">{row.occurredAt}</td>
                    <td className="py-2.5">{CHANNEL_LABEL[row.channel]}</td>
                    <td className="py-2.5 text-muted-foreground">{row.note || "—"}</td>
                    <td dir="ltr" className="py-2.5 font-semibold tabular-nums">
                      {ils(row.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function ExpensesReadonlyPanel({
  expenses,
  byChannel,
  adsTotal,
  googleCost,
  facebookCost,
}: {
  expenses: CampaignExpense[];
  byChannel: Record<ExpenseChannel, number>;
  adsTotal: number;
  googleCost: number;
  facebookCost: number;
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Mini label="סה״כ שיווק והוצאות" value={<Money value={adsTotal} minus />} />
        <Mini label="גוגל אדס" value={<Money value={byChannel.google || googleCost} minus />} />
        <Mini label="פייסבוק" value={<Money value={byChannel.facebook || facebookCost} minus />} />
        <Mini label="משויכות" value={<Money value={byChannel.manual} minus />} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/[0.06] bg-background px-4 py-3">
        <p className="text-sm text-muted-foreground">
          הוצאות נרשמות ונערכות רק בקטגוריית «הוצאות» עם שיוך למקור. כאן תצוגה בלבד.
        </p>
        <Link
          href={EXPENSES_PATH}
          className="inline-flex items-center gap-1.5 rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white"
        >
          מעבר להוצאות
          <ExternalLink className="size-3.5" />
        </Link>
      </div>
      {expenses.length === 0 ? (
        <p className="text-sm text-muted-foreground">אין הוצאות משויכות בטווח הזה.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-black/[0.06]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/[0.06] bg-background text-[11px] text-muted-foreground">
                <th className="px-4 py-2.5 text-start font-semibold">תאריך</th>
                <th className="px-4 py-2.5 text-start font-semibold">סוג</th>
                <th className="px-4 py-2.5 text-start font-semibold">פירוט</th>
                <th className="px-4 py-2.5 text-start font-semibold">סכום</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((row) => (
                <tr key={row.id} className="border-b border-black/[0.04] last:border-0">
                  <td className="px-4 py-2.5 tabular-nums">{row.occurredAt}</td>
                  <td className="px-4 py-2.5">{CHANNEL_LABEL[row.channel]}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{row.note || "—"}</td>
                  <td dir="ltr" className="px-4 py-2.5 font-semibold tabular-nums">
                    {ils(row.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-black/[0.1] font-semibold">
                <td className="px-4 py-3" colSpan={3}>
                  סה״כ הוצאות משויכות
                </td>
                <td dir="ltr" className="px-4 py-3 tabular-nums">
                  {ils(expenses.reduce((s, r) => s + r.amount, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function AdsCampaignReadonlyTable({
  title,
  rangeLabel,
  emptyText,
  rows,
}: {
  title: string;
  rangeLabel: string;
  emptyText: string;
  rows: {
    id: string;
    name: string;
    status: string;
    cost: number;
    clicks: number;
    impressions: number;
  }[];
}) {
  const totalCost = rows.reduce((sum, row) => sum + row.cost, 0);
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{rangeLabel} · תצוגה בלבד</p>
        </div>
        <Money value={totalCost} minus className="text-sm font-semibold" />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-black/[0.06]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/[0.06] bg-background text-[11px] text-muted-foreground">
              <th className="px-4 py-2.5 text-start font-semibold">קמפיין</th>
              <th className="px-4 py-2.5 text-start font-semibold">סטטוס</th>
              <th className="px-4 py-2.5 text-start font-semibold">קליקים</th>
              <th className="px-4 py-2.5 text-start font-semibold">חשיפות</th>
              <th className="px-4 py-2.5 text-start font-semibold">עלות</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-black/[0.04] last:border-0">
                <td className="px-4 py-2.5 font-medium">{row.name}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{row.status}</td>
                <td className="px-4 py-2.5 tabular-nums">{row.clicks.toLocaleString("he-IL")}</td>
                <td className="px-4 py-2.5 tabular-nums">
                  {row.impressions.toLocaleString("he-IL")}
                </td>
                <td dir="ltr" className="px-4 py-2.5 font-semibold tabular-nums">
                  {ils(row.cost)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function fieldValue(row: MarketingProduction, header: string): string {
  const fromFields = row.fields?.[header];
  if (fromFields) return fromFields;
  if (header.includes("לקוח")) return row.client === "—" ? "" : row.client;
  if (header.includes("משווק")) return row.agent === "—" ? "" : row.agent;
  if (header.includes("מוצר")) return row.product === "—" ? "" : row.product;
  if (header.includes("חבר")) return row.company === "—" ? "" : row.company;
  if (header.includes("העברה")) return row.transferDate === "—" ? "" : row.transferDate;
  if (header.includes("תחילת")) return row.startDate === "—" ? "" : (row.startDate ?? "");
  if (header.includes("סטאטוס") || header.includes("סטטוס")) return row.statusRaw || STATUS_LABEL[row.status];
  if (header.includes("פרמיה")) return row.premium ? String(row.premium) : "";
  if (header.includes("תהליך")) return row.process ?? "";
  if (header.includes("מקור")) return row.source;
  return "";
}

function resolveExcelHeaders(rows: MarketingProduction[], headers: string[]): string[] {
  if (headers.length > 0) return headers;
  const seen = new Set<string>();
  const order: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row.fields ?? {})) {
      if (seen.has(key)) continue;
      seen.add(key);
      order.push(key);
    }
  }
  if (order.length > 0) return order;
  return ["שם לקוח", "משווק", "סוג המוצר", "חברת הביטוח", "תאריך העברה ליצרן", "סטאטוס פוליסה", "פרמיה"];
}

function ProductionsTable({
  rows,
  rangeRows,
  headers,
  rangeLabel,
  range,
  rates,
  payProfiles = [],
  wageKind = "volume",
  wageContextRows,
  defaultMultiplier,
}: {
  rows: MarketingProduction[];
  rangeRows: MarketingProduction[];
  headers: string[];
  rangeLabel: string;
  range: DateRange;
  rates: AgentRate[];
  payProfiles?: EmployeePayProfile[];
  wageKind?: SourcePnlKind;
  wageContextRows?: MarketingProduction[];
  defaultMultiplier: number;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("הכל");
  const [scope, setScope] = useState<"excel" | "range">("excel");
  const cols = resolveExcelHeaders(rows, headers);
  const rangeKeys = useMemo(() => new Set(rangeRows.map((row) => row.key)), [rangeRows]);
  const wageTotals = useMemo(
    () => buildMonthlyAgentPremiumTotals(wageContextRows ?? rangeRows),
    [wageContextRows, rangeRows],
  );

  const statusOptions = useMemo(() => {
    const names = new Set<string>();
    for (const row of rows) names.add(row.statusRaw || STATUS_LABEL[row.status]);
    return ["הכל", ...Array.from(names).sort((a, b) => a.localeCompare(b, "he"))];
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (scope === "range" && !rangeKeys.has(row.key) && !inDateRange(productionDateOf(row), range)) {
        return false;
      }
      const statusText = row.statusRaw || STATUS_LABEL[row.status];
      if (statusFilter !== "הכל" && statusText !== statusFilter) return false;
      if (!q) return true;
      const hay = [
        row.client,
        row.agent,
        row.product,
        row.company,
        row.source,
        statusText,
        ...Object.values(row.fields ?? {}),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, scope, rangeKeys, range, statusFilter, query]);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        אין שורות באקסל למקור הזה. לחצו «סנכרן הכל» כדי למשוך את הקובץ מחדש.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-[1.25rem] border border-black/[0.06] bg-white px-3.5 py-3.5 shadow-[0_1px_0_rgba(17,17,17,0.03)] sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:px-5">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight">שורות מהאקסל</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {visible.length.toLocaleString("he-IL")} מתוך{" "}
            {rows.length.toLocaleString("he-IL")} שורות
            <span className="mx-1.5 text-black/20">·</span>
            {cols.length} עמודות
          </p>
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 hide-scrollbar sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          <button
            type="button"
            onClick={() => setScope("excel")}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors active:scale-95 sm:py-1.5",
              scope === "excel"
                ? "bg-black text-white"
                : "bg-muted/70 text-muted-foreground hover:bg-muted",
            )}
          >
            כל האקסל
          </button>
          <button
            type="button"
            onClick={() => setScope("range")}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors active:scale-95 sm:py-1.5",
              scope === "range"
                ? "bg-black text-white"
                : "bg-muted/70 text-muted-foreground hover:bg-muted",
            )}
          >
            רק {rangeLabel}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-[1.25rem] border border-black/[0.06] bg-white p-3.5 shadow-[0_1px_0_rgba(17,17,17,0.03)] sm:p-4">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="חיפוש לקוח, עובד, מוצר…"
            className="h-11 rounded-2xl border-black/[0.06] bg-[#fafafa] ps-10 text-start focus-visible:ring-highlight/40"
          />
        </div>
        <div className="min-w-0">
          <p className="mb-2 text-[11px] font-medium text-muted-foreground">סטטוס</p>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 hide-scrollbar">
            {statusOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setStatusFilter(option)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors active:scale-95",
                  statusFilter === option
                    ? "bg-black text-white"
                    : "bg-muted/70 text-muted-foreground hover:bg-muted",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="-mx-1 max-h-[min(28rem,50dvh)] overflow-auto rounded-[1.25rem] border border-black/[0.06] bg-white shadow-[0_1px_0_rgba(17,17,17,0.03)] sm:mx-0 sm:max-h-[28rem]">
        <table className="w-max min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-[#f7f7f7]/backdrop-blur">
            <tr className="border-b border-black/[0.06] text-[11px] text-muted-foreground">
              {cols.map((header) => (
                <th
                  key={header}
                  className="whitespace-nowrap px-3.5 py-3 text-start font-semibold tracking-tight"
                >
                  {header}
                </th>
              ))}
              <th className="whitespace-nowrap px-3.5 py-3 text-start font-semibold tracking-tight">
                שכר (מערכת)
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row, index) => {
              const wage =
                row.status === "active"
                  ? wageForOneProduction(row, {
                      profiles: payProfiles,
                      rates,
                      fallback: 0,
                      kind: wageKind,
                      volumeByAgent: new Map(),
                      settledByAgent: new Map(),
                      monthlyTotals: wageTotals,
                    })
                  : 0;
              return (
                <tr
                  key={`${row.key}-${index}`}
                  className="border-b border-black/[0.04] transition-colors last:border-0 odd:bg-black/[0.015] hover:bg-highlight/15"
                >
                  {cols.map((header) => {
                    const value = fieldValue(row, header);
                    const money = header.includes("פרמיה");
                    return (
                      <td
                        key={header}
                        dir={money ? "ltr" : undefined}
                        className={cn(
                          "whitespace-nowrap px-3.5 py-2.5",
                          header.includes("לקוח") && "font-medium",
                          money && "tabular-nums font-medium",
                          row.status !== "active" && "text-muted-foreground",
                        )}
                      >
                        {value || "—"}
                      </td>
                    );
                  })}
                  <td
                    dir="ltr"
                    className={cn(
                      "whitespace-nowrap px-3.5 py-2.5 font-medium tabular-nums",
                      row.status !== "active" && "text-muted-foreground",
                    )}
                  >
                    {row.status === "active" ? ils(wage) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-black/[0.08] bg-white px-4 py-8 text-center text-sm text-muted-foreground">
          אין שורות שמתאימות לסינון.
        </p>
      ) : null}
    </div>
  );
}

function formatIsoDay(iso: string): string {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}.${month}.${year}`;
}

function formatWageMultiplier(value: number, reason?: WageExplainReason): string {
  if (!value) return "×0";
  if (reason === "travel" || reason === "freelancer" || reason === "appointment" || reason === "freelancers_1" || reason === "freelancers_2") {
    const percent = value * 100;
    const pretty =
      Number.isInteger(percent) || Math.abs(percent - Math.round(percent)) < 0.05
        ? String(Math.round(percent))
        : percent.toLocaleString("he-IL", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
    return `${pretty}%`;
  }
  const pretty = Number.isInteger(value)
    ? String(value)
    : value.toLocaleString("he-IL", { maximumFractionDigits: 2 });
  return `×${pretty}`;
}

function wageReasonLabel(reason: WageExplainReason): string {
  if (reason === "travel") return "נסיעות %";
  if (reason === "freelancer") return "עמלת עצמאי";
  if (reason === "freelancers_1") return "נפרעים 1 · שוטף 60 ונגרר";
  if (reason === "freelancers_2") return "נפרעים 2 · 9.3% · שוטף 60 ונגרר";
  if (reason === "tier") return "מדרגת היקף";
  if (reason === "appointment") return "מינוי סוכן";
  if (reason === "settled_blocked") return "שכיר — אין שכר נפרעים";
  if (reason === "unpaid") return "ללא שכר";
  if (reason === "inactive") return "לא פעילה";
  return "אין חישוב";
}

function uniquePaidMultipliers(lines: WorkerWageDetailLine[]): number[] {
  return [...new Set(lines.filter((line) => line.wage > 0).map((line) => line.multiplier))];
}

function monthGroups(lines: WorkerWageDetailLine[]) {
  const map = new Map<
    string,
    {
      month: string;
      monthProduction: number;
      multiplier: number;
      tierLabel: string;
      reason: WageExplainReason;
      premium: number;
      wage: number;
      count: number;
    }
  >();
  for (const line of lines) {
    const key = `${line.month}|${line.multiplier}|${line.reason}|${line.tierLabel}`;
    const current = map.get(key) ?? {
      month: line.month,
      monthProduction: line.monthProduction,
      multiplier: line.multiplier,
      tierLabel: line.tierLabel,
      reason: line.reason,
      premium: 0,
      wage: 0,
      count: 0,
    };
    current.premium += line.premium;
    current.wage += line.wage;
    current.count += 1;
    map.set(key, current);
  }
  return Array.from(map.values());
}

function WorkersTable({
  workers,
  productions,
  rates,
  payProfiles,
  wageKind,
  wageContextRows,
  defaultMultiplier,
}: {
  workers: { name: string; count: number; sum: number; multiplier: number; wage: number }[];
  productions: MarketingProduction[];
  rates: AgentRate[];
  payProfiles: EmployeePayProfile[];
  wageKind: SourcePnlKind;
  wageContextRows: MarketingProduction[];
  defaultMultiplier: number;
}) {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const selected = useMemo(() => {
    if (!selectedName) return null;
    return workerWageBreakdown(selectedName, productions, rates, defaultMultiplier, {
      profiles: payProfiles,
      kind: wageKind,
      contextRows: wageContextRows,
    });
  }, [selectedName, productions, rates, defaultMultiplier, payProfiles, wageKind, wageContextRows]);

  if (workers.length === 0) {
    return <p className="text-sm text-muted-foreground">אין עובדים עם הפקות פעילות בטווח הזה.</p>;
  }
  const premiumTotal = workers.reduce((sum, row) => sum + row.sum, 0);
  const wageTotal = workers.reduce((sum, row) => sum + row.wage, 0);
  const countTotal = workers.reduce((sum, row) => sum + row.count, 0);
  if (selected) {
    return (
      <WageFormulaPanel
        breakdown={selected}
        blendedMultiplier={
          selectedName ? workers.find((row) => row.name === selectedName)?.multiplier ?? 0 : 0
        }
        onBack={() => setSelectedName(null)}
      />
    );
  }

  return (
    <div className="-mx-1 overflow-x-auto overscroll-x-contain sm:mx-0">
      <table className="w-max min-w-full text-sm">
        <thead>
          <tr className="border-b border-black/[0.06] text-[11px] text-muted-foreground">
            <th className="whitespace-nowrap px-2 py-2 text-start font-semibold">עובד</th>
            <th className="whitespace-nowrap px-2 py-2 text-start font-semibold">סגירות</th>
            <th className="whitespace-nowrap px-2 py-2 text-start font-semibold">פרמיה</th>
            <th className="whitespace-nowrap px-2 py-2 text-start font-semibold">שכר בקמפיין</th>
          </tr>
        </thead>
        <tbody>
          {workers.map((worker) => (
            <tr key={worker.name} className="border-b border-black/[0.04] last:border-0">
              <td className="max-w-[9rem] truncate px-2 py-3 font-medium sm:max-w-none">
                {worker.name}
              </td>
              <td className="px-2 py-3 tabular-nums">{worker.count}</td>
              <td className="px-2 py-3 tabular-nums">
                <span dir="ltr" className="inline-block">{ils(worker.sum)}</span>
              </td>
              <td className="px-2 py-3">
                <button
                  type="button"
                  onClick={() => setSelectedName(worker.name)}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-start active:scale-95 hover:border-black/40 hover:bg-black/[0.03] sm:min-h-0 sm:rounded-lg sm:px-2.5 sm:py-1.5"
                >
                  <span dir="ltr" className="font-semibold tabular-nums">
                    {ils(worker.wage)}
                  </span>
                  <span className="text-[11px] font-medium text-muted-foreground">פירוט</span>
                  <ChevronLeft className="size-3.5 text-muted-foreground" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-black/[0.12] text-sm font-semibold">
            <td className="py-3">סה״כ שכר עובדים</td>
            <td className="py-3 tabular-nums">{countTotal}</td>
            <td className="py-3 tabular-nums">
              <span dir="ltr" className="inline-block">{ils(premiumTotal)}</span>
            </td>
            <td className="py-3 tabular-nums">
              <span dir="ltr" className="inline-block">{ils(wageTotal)}</span>
            </td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-3 text-xs text-muted-foreground">
        לחצו על «פירוט» ליד הסכום — שם מופיעה הנוסחה לכל מכירה. רק הפקות פעילות בדוח הזה.
      </p>
    </div>
  );
}

function WageFormulaPanel({
  breakdown,
  blendedMultiplier,
  onBack,
}: {
  breakdown: WorkerWageBreakdown;
  blendedMultiplier: number;
  onBack: () => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onBack();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onBack]);

  const groups = monthGroups(breakdown.lines);
  const employment =
    breakdown.employmentKind === "salaried"
      ? "שכיר"
      : breakdown.employmentKind === "freelancer"
        ? "עצמאי"
        : breakdown.employmentKind === "unpaid"
          ? "ללא שכר"
          : null;

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        חזרה לרשימת העובדים
      </button>
      <div>
        <h2 className="text-lg font-semibold leading-none tracking-tight">פירוט חישוב שכר</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {breakdown.workerName}
          {employment ? ` · ${employment}` : ""}
          {` · ${breakdown.lines.length} סגירות בקמפיין`}
        </p>
      </div>

      <div className="rounded-xl border border-black/[0.08] bg-muted/40 px-4 py-3">
        <p className="text-xs text-muted-foreground">שכר בקמפיין</p>
        <p dir="ltr" className="mt-1 text-2xl font-semibold tabular-nums">
          {ils(breakdown.wageTotal)}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {breakdown.employmentKind === "salaried"
            ? "לכל מכירה: פרמיה × מכפיל המדרגה של חודש השכר. המדרגה לפי סה״כ ההיקף של העובד באותו חודש בכל המקורות."
            : breakdown.employmentKind === "freelancer"
              ? "עצמאי: לכל מכירה פרמיה × אחוז מההסכם."
              : "החישוב לפי הסכם העובד לכל הפקה בנפרד."}
          {blendedMultiplier > 0 && uniquePaidMultipliers(breakdown.lines).length !== 1
            ? ` אין מכפיל אחד. הממוצע בקמפיין הוא ×${blendedMultiplier}.`
            : ""}
        </p>
      </div>

      {groups.length > 0 ? (
        <div className="space-y-2">
          {groups.map((group) => (
            <div
              key={`${group.month}|${group.multiplier}|${group.reason}|${group.tierLabel}`}
              className="rounded-lg border border-black/[0.06] bg-muted/40 px-3 py-2.5 text-sm"
            >
              <p className="font-medium">
                {group.month ? monthLabel(group.month) : "בלי חודש שכר"}
                {" · "}
                {wageReasonLabel(group.reason)}
              </p>
              {group.reason === "tier" ? (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  היקף החודש בכל המקורות {ils(group.monthProduction)}
                  {group.tierLabel !== "—" ? ` → מדרגה ${group.tierLabel}` : ""}
                  {" → "}
                  {formatWageMultiplier(group.multiplier, group.reason)}
                  . כל מכירה בקמפיין: פרמיה {formatWageMultiplier(group.multiplier, group.reason)}
                </p>
              ) : (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {group.count} מכירות · פרמיה {ils(group.premium)} {formatWageMultiplier(group.multiplier, group.reason)} = {ils(group.wage)}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">אין הפקות פעילות לעובד בקמפיין הזה.</p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/[0.06] text-[11px] text-muted-foreground">
              <th className="py-2 text-start font-semibold">תאריך</th>
              <th className="py-2 text-start font-semibold">לקוח</th>
              <th className="py-2 text-start font-semibold">פרמיה</th>
              <th className="py-2 text-start font-semibold">מכפיל</th>
              <th className="py-2 text-start font-semibold">חישוב</th>
              <th className="py-2 text-start font-semibold">שכר</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.lines.map((line) => (
              <tr key={line.key} className="border-b border-black/[0.04] last:border-0">
                <td className="py-2 tabular-nums">{formatIsoDay(line.date)}</td>
                <td className="py-2">{line.client}</td>
                <td dir="ltr" className="py-2 tabular-nums">{ils(line.premium)}</td>
                <td className="py-2 tabular-nums">{formatWageMultiplier(line.multiplier, line.reason)}</td>
                <td dir="ltr" className="py-2 text-xs tabular-nums text-muted-foreground">
                  {ils(line.premium)} {formatWageMultiplier(line.multiplier, line.reason)}
                </td>
                <td dir="ltr" className="py-2 font-medium tabular-nums">{ils(line.wage)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-black/[0.12] text-sm font-semibold">
              <td className="py-3" colSpan={2}>סה״כ</td>
              <td dir="ltr" className="py-3 tabular-nums">{ils(breakdown.premiumTotal)}</td>
              <td />
              <td />
              <td dir="ltr" className="py-3 tabular-nums">{ils(breakdown.wageTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {breakdown.employmentKind === "salaried" ? (
        <p className="text-xs text-muted-foreground">
          שעות, נסיעות וימי חופש של שכיר לא מוקצים לקמפיין — כאן רק שכר מדרגות על ההפקות האלה. הפירוט המלא בכרטיס העובד.
        </p>
      ) : null}
    </div>
  );
}

export function QuickExpenseDialog({
  open,
  sourceName,
  onOpenChange,
  onChanged,
}: {
  open: boolean;
  sourceName: string;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [occurredAt, setOccurredAt] = useState(jerusalemYmd());
  const [channel, setChannel] = useState<ExpenseChannel>("manual");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent) {
    event.preventDefault();
    startTransition(() => {
      void addCampaignExpense({
        sourceName,
        channel,
        amount,
        occurredAt,
        note,
      }).then((result) => {
        if (!result.ok) {
          toast.error(result.error ?? "שגיאה");
          return;
        }
        setAmount("");
        setNote("");
        toast.success("ההוצאה נוספה");
        onChanged();
        onOpenChange(false);
      });
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92dvh,calc(100dvh-1.25rem))] w-[calc(100%-1.25rem)] max-w-md overflow-y-auto overscroll-contain rounded-[1.25rem] border-black/[0.08] p-0 shadow-[0_24px_80px_-24px_rgba(17,17,17,0.45)] sm:rounded-[1.5rem]">
        <DialogHeader className="relative space-y-0 border-b border-black/[0.06] px-4 py-5 pe-12 text-start sm:px-6 sm:pe-6">
          <span className="absolute inset-x-0 top-0 h-1 bg-highlight" />
          <DialogTitle className="text-xl font-semibold tracking-tight">
            הוצאה לקמפיין
          </DialogTitle>
          <DialogDescription className="mt-1 line-clamp-2 text-sm">{sourceName}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-5">
          <div className="space-y-1.5">
            <Label htmlFor="expense-amount">סכום</Label>
            <Input
              id="expense-amount"
              className="h-11 rounded-xl border-black/[0.06]"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expense-date">תאריך</Label>
            <Input
              id="expense-date"
              className="h-11 rounded-xl border-black/[0.06]"
              type="date"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>מקור הוצאה</Label>
            <Select
              value={channel}
              onValueChange={(value) => setChannel(value as ExpenseChannel)}
            >
              <SelectTrigger className="h-11 rounded-xl border-black/[0.06]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="google">{CHANNEL_LABEL.google}</SelectItem>
                <SelectItem value="facebook">{CHANNEL_LABEL.facebook}</SelectItem>
                <SelectItem value="manual">{CHANNEL_LABEL.manual}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expense-note">הערה</Label>
            <Input
              id="expense-note"
              className="h-11 rounded-xl border-black/[0.06]"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="חשבונית / פייסבוק / גוגל"
            />
          </div>
          <Button
            type="submit"
            disabled={pending}
            className="mt-1 h-11 rounded-xl active:scale-95"
          >
            {pending ? "שומר…" : "שמירה"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const LINE_COPY: Record<CampaignLineKind, { title: string; hint: string }> = {
  premium: {
    title: "פרמיה שנסגרה",
    hint: "כל ההפקות הפעילות שנסגרו בקמפיין בטווח התאריכים. בוטלה / גניזה לא נספרות בכסף.",
  },
  income: {
    title: "הכנסה מחברות",
    hint: "על כל פרמיה שנסגרה ליבה מקבלת מהחברות את הפרמיה כפול המכפיל.",
  },
  wage: {
    title: "שכר עובדים",
    hint: "שכר לפי הסכם העובד. לחצו על «פירוט» ליד הסכום לנוסחה המדויקת.",
  },
  marketing: {
    title: "שיווק והוצאות",
    hint: "גוגל ופייסבוק מהחשבונות המחוברים, והוצאות משויכות מקטגוריית הוצאות — תצוגה בלבד.",
  },
  net: {
    title: "רווח / הפסד",
    hint: "הכנסה מחברות − שכר עובדים − שיווק והוצאות.",
  },
};

export function CampaignLineDialog({
  open,
  onOpenChange,
  kind,
  name,
  rangeLabel,
  range,
  productions,
  expenses,
  rates,
  payProfiles = [],
  wageKind = "volume",
  wageContextRows,
  defaultMultiplier,
  insurerMultiplier,
  googleAds,
  googleCampaigns,
  googleStats,
  facebookCampaigns,
  facebookStats,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: CampaignLineKind;
  name: string;
  rangeLabel: string;
  range: DateRange;
  productions: MarketingProduction[];
  expenses: CampaignExpense[];
  rates: AgentRate[];
  payProfiles?: EmployeePayProfile[];
  wageKind?: SourcePnlKind;
  wageContextRows?: MarketingProduction[];
  defaultMultiplier: number;
  insurerMultiplier: number;
  googleAds: GoogleAdsConnection;
  googleCampaigns: GoogleAdsCampaignRow[];
  googleStats: GoogleAdsDailyStat[];
  facebookCampaigns: FacebookAdsCampaignRow[];
  facebookStats: FacebookAdsDailyStat[];
  onChanged: () => void;
}) {
  const copy = LINE_COPY[kind];
  const active = productions.filter((row) => row.status === "active");
  const pendingRows = productions.filter((row) => row.status === "pending");
  const premium = active.reduce((sum, row) => sum + row.premium, 0);
  const google = googleAdsRollup(name, googleCampaigns, googleStats, range);
  const facebook = facebookAdsRollup(name, facebookCampaigns, facebookStats, range);
  const marketing = cubeMarketingTotals(
    name,
    expenses,
    google.cost,
    google.campaigns.length,
    facebook.cost,
    facebook.campaigns.length,
  );
  const adsTotal = marketing.adsTotal;
  const workers = useMemo(
    () =>
      groupWorkers(productions, rates, defaultMultiplier, {
        profiles: payProfiles,
        kind: wageKind,
        contextRows: wageContextRows ?? productions,
      }),
    [productions, rates, defaultMultiplier, payProfiles, wageKind, wageContextRows],
  );
  const wageTotal = workers.reduce((sum, row) => sum + row.wage, 0);
  const pnl = campaignPnl({
    premium,
    wageTotal,
    adsTotal,
    insurerMultiplier,
  });
  const byChannel = marketing.byChannel;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fixed inset-x-2 top-[max(0.5rem,env(safe-area-inset-top))] bottom-[max(0.5rem,env(safe-area-inset-bottom))] flex h-auto max-h-none w-auto max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-[1.25rem] border-black/[0.08] p-0 shadow-[0_24px_80px_-24px_rgba(17,17,17,0.45)] data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0 data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0 sm:inset-auto sm:bottom-auto sm:left-[50%] sm:right-auto sm:top-[50%] sm:h-auto sm:max-h-[min(92dvh,calc(100dvh-1.5rem))] sm:w-[min(96vw,48rem)] sm:max-w-3xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-[1.5rem] sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%] sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%]">
        <DialogHeader className="relative shrink-0 space-y-0 overflow-hidden border-b border-black/[0.06] bg-white px-4 pb-4 pt-5 text-start sm:px-7 sm:pb-6 sm:pt-6">
          <span className="absolute inset-x-0 top-0 h-1 bg-highlight" />
          <div className="pe-10 sm:pe-8">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground">
              {name}
              <span className="mx-1.5 text-black/20">·</span>
              לקריאה בלבד
            </p>
            <DialogTitle className="mt-1.5 text-[1.35rem] font-semibold leading-tight tracking-tight sm:text-2xl sm:leading-none">
              {copy.title}
            </DialogTitle>
            <DialogDescription className="mt-2 text-[12px] text-muted-foreground sm:text-sm">
              <span className="font-medium text-foreground">{rangeLabel}</span>
              {kind === "income" ? (
                <>
                  <span className="mx-2 text-black/20">·</span>
                  מכפיל חברות ×{insurerMultiplier}
                </>
              ) : null}
            </DialogDescription>
            <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
              {copy.hint}
            </p>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#fafafa] px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7 sm:py-6 sm:pb-6">
          {kind === "premium" ? (
            <LineProductions
              rows={active}
              pendingCount={pendingRows.length}
              pendingPremium={pendingRows.reduce((sum, row) => sum + row.premium, 0)}
              total={premium}
            />
          ) : null}
          {kind === "income" ? (
            <LineIncome rows={active} insurerMultiplier={insurerMultiplier} total={pnl.income} />
          ) : null}
          {kind === "wage" ? (
            <WorkersTable
              workers={workers}
              productions={productions}
              rates={rates}
              payProfiles={payProfiles}
              wageKind={wageKind}
              wageContextRows={wageContextRows ?? productions}
              defaultMultiplier={defaultMultiplier}
            />
          ) : null}
          {kind === "marketing" ? (
            <div className="space-y-6">
              <LineMarketing expenses={expenses} adsTotal={adsTotal} byChannel={byChannel} />
              <AdsCampaignReadonlyTable
                title="גוגל אדס"
                rangeLabel={rangeLabel}
                emptyText={`אין קמפיינים של גוגל אדס המשויכים ל«${name}» בטווח.`}
                rows={google.campaigns.map((row) => ({
                  id: row.googleCampaignId,
                  name: row.googleCampaignName,
                  status: row.status,
                  cost: row.cost,
                  clicks: row.clicks,
                  impressions: row.impressions,
                }))}
              />
              <FacebookAdsCubePanel
                sourceName={name}
                rangeLabel={rangeLabel}
                mapped={facebook.campaigns}
              />
            </div>
          ) : null}
          {kind === "net" ? (
            <LineNet
              premium={premium}
              income={pnl.income}
              wageTotal={wageTotal}
              adsTotal={adsTotal}
              net={pnl.net}
              insurerMultiplier={insurerMultiplier}
              workers={workers}
              byChannel={byChannel}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LineProductions({
  rows,
  pendingCount,
  pendingPremium,
  total,
}: {
  rows: MarketingProduction[];
  pendingCount: number;
  pendingPremium: number;
  total: number;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">אין סגירות פעילות בטווח הזה.</p>;
  }
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/[0.06] text-[11px] text-muted-foreground">
              <th className="py-2 text-start font-semibold">לקוח</th>
              <th className="py-2 text-start font-semibold">עובד</th>
              <th className="py-2 text-start font-semibold">מוצר</th>
              <th className="py-2 text-start font-semibold">חברה</th>
              <th className="py-2 text-start font-semibold">תאריך הפקה</th>
              <th className="py-2 text-start font-semibold">פרמיה</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.key}-${index}`} className="border-b border-black/[0.04] last:border-0">
                <td className="py-2.5 font-medium">{row.client}</td>
                <td className="py-2.5">{row.agent}</td>
                <td className="py-2.5">{row.product}</td>
                <td className="py-2.5">{row.company}</td>
                <td className="py-2.5 tabular-nums">{productionDateOf(row) || row.transferDate}</td>
                <td dir="ltr" className="py-2.5 font-semibold tabular-nums">
                  {ils(row.premium)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-black/[0.12] text-sm font-semibold">
              <td className="py-3" colSpan={5}>
                סה״כ {rows.length} סגירות
              </td>
              <td dir="ltr" className="py-3 tabular-nums">
                {ils(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {pendingCount > 0 ? (
        <p className="text-xs text-muted-foreground">
          {pendingCount} הפקות בתהליך לא נספרות כאן
          {pendingPremium > 0 ? (
            <>
              {" "}
              (<span dir="ltr" className="inline-block tabular-nums">{ils(pendingPremium)}</span>)
            </>
          ) : null}
          .
        </p>
      ) : null}
    </div>
  );
}

function LineIncome({
  rows,
  insurerMultiplier,
  total,
}: {
  rows: MarketingProduction[];
  insurerMultiplier: number;
  total: number;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">אין סגירות פעילות בטווח הזה.</p>;
  }
  const premiumTotal = rows.reduce((sum, row) => sum + row.premium, 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/[0.06] text-[11px] text-muted-foreground">
            <th className="py-2 text-start font-semibold">לקוח</th>
            <th className="py-2 text-start font-semibold">עובד</th>
            <th className="py-2 text-start font-semibold">מוצר</th>
            <th className="py-2 text-start font-semibold">פרמיה</th>
            <th className="py-2 text-start font-semibold">חישוב</th>
            <th className="py-2 text-start font-semibold">הכנסה</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const income = row.premium * insurerMultiplier;
            return (
              <tr key={`${row.key}-${index}`} className="border-b border-black/[0.04] last:border-0">
                <td className="py-2.5 font-medium">{row.client}</td>
                <td className="py-2.5">{row.agent}</td>
                <td className="py-2.5">{row.product}</td>
                <td dir="ltr" className="py-2.5 tabular-nums">
                  {ils(row.premium)}
                </td>
                <td dir="ltr" className="py-2.5 text-xs tabular-nums text-muted-foreground">
                  {ils(row.premium)} × {insurerMultiplier}
                </td>
                <td dir="ltr" className="py-2.5 font-semibold tabular-nums">
                  {ils(income)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-black/[0.12] text-sm font-semibold">
            <td className="py-3" colSpan={3}>
              סה״כ
            </td>
            <td dir="ltr" className="py-3 tabular-nums">
              {ils(premiumTotal)}
            </td>
            <td />
            <td dir="ltr" className="py-3 tabular-nums">
              {ils(total)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function LineMarketing({
  expenses,
  adsTotal,
  byChannel,
}: {
  expenses: CampaignExpense[];
  adsTotal: number;
  byChannel: Record<ExpenseChannel, number>;
}) {
  return (
    <div className="space-y-4">
      <ul className="space-y-1.5 rounded-xl border border-black/[0.06] bg-background p-4 text-sm">
        {(Object.keys(CHANNEL_LABEL) as ExpenseChannel[]).map((channel) => (
          <li key={channel} className="flex items-baseline justify-between gap-3">
            <span className="text-muted-foreground">{CHANNEL_LABEL[channel]}</span>
            <Money value={byChannel[channel]} minus />
          </li>
        ))}
        <li className="flex items-baseline justify-between gap-3 border-t border-black/[0.06] pt-2 font-semibold">
          <span>סה״כ שיווק והוצאות</span>
          <Money value={adsTotal} minus />
        </li>
      </ul>
      {expenses.length === 0 ? (
        <p className="text-sm text-muted-foreground">אין הוצאות שיווק בטווח הזה.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/[0.06] text-[11px] text-muted-foreground">
              <th className="py-2 text-start font-semibold">תאריך</th>
              <th className="py-2 text-start font-semibold">ערוץ</th>
              <th className="py-2 text-start font-semibold">הערה</th>
              <th className="py-2 text-start font-semibold">סכום</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((row) => (
              <tr key={row.id} className="border-b border-black/[0.04] last:border-0">
                <td className="py-2.5 tabular-nums">{row.occurredAt}</td>
                <td className="py-2.5">{CHANNEL_LABEL[row.channel]}</td>
                <td className="py-2.5 text-muted-foreground">{row.note || "—"}</td>
                <td dir="ltr" className="py-2.5 font-semibold tabular-nums">
                  {ils(row.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function LineNet({
  premium,
  income,
  wageTotal,
  adsTotal,
  net,
  insurerMultiplier,
  workers,
  byChannel,
}: {
  premium: number;
  income: number;
  wageTotal: number;
  adsTotal: number;
  net: number;
  insurerMultiplier: number;
  workers: { name: string; count: number; sum: number; multiplier: number; wage: number }[];
  byChannel: Record<ExpenseChannel, number>;
}) {
  return (
    <div className="space-y-4">
      <ul className="space-y-2 rounded-xl border border-black/[0.06] bg-background p-4 text-sm">
        <li className="flex items-baseline justify-between gap-3">
          <span className="text-muted-foreground">פרמיה שנסגרה</span>
          <Money value={premium} />
        </li>
        <li className="flex items-baseline justify-between gap-3">
          <span className="text-muted-foreground">הכנסה מחברות ×{insurerMultiplier}</span>
          <Money value={income} />
        </li>
        <li className="flex items-baseline justify-between gap-3">
          <span className="text-muted-foreground">שכר עובדים</span>
          <Money value={wageTotal} minus />
        </li>
        <li className="flex items-baseline justify-between gap-3">
          <span className="text-muted-foreground">שיווק והוצאות</span>
          <Money value={adsTotal} minus />
        </li>
        <li className="flex items-baseline justify-between gap-3 border-t border-black/[0.08] pt-2 text-base font-semibold">
          <span>רווח / הפסד</span>
          <Money
            value={net}
            signed
            className={cn(net > 0 && "text-emerald-700", net < 0 && "text-red-700")}
          />
        </li>
      </ul>
      {workers.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">שכר לפי עובד</p>
          <ul className="space-y-1.5 text-sm">
            {workers.map((worker) => (
              <li key={worker.name} className="flex items-baseline justify-between gap-3">
                <span>
                  {worker.name}
                  <span className="ms-2 text-xs text-muted-foreground">
                    {worker.count} סגירות · {ils(worker.sum)} × {worker.multiplier}
                  </span>
                </span>
                <Money value={worker.wage} minus />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {adsTotal > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">שיווק לפי ערוץ</p>
          <ul className="space-y-1.5 text-sm">
            {(Object.keys(CHANNEL_LABEL) as ExpenseChannel[]).map((channel) =>
              byChannel[channel] > 0 ? (
                <li key={channel} className="flex items-baseline justify-between gap-3">
                  <span>{CHANNEL_LABEL[channel]}</span>
                  <Money value={byChannel[channel]} minus />
                </li>
              ) : null,
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
