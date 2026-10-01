"use client";

import { useCallback, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { syncEmployeesFromExcel } from "@/app/actions/finance-people";
import { syncFacebookAds } from "@/app/actions/facebook-ads";
import { syncGoogleAds } from "@/app/actions/google-ads";
import { useLiveDashboard } from "@/components/layout/live-dashboard-provider";
import { publishLiveDashboard } from "@/lib/sales-dashboard/client-snapshot";
import type { DashboardData } from "@/lib/sales-dashboard/types";
import { cn } from "@/lib/utils";

export const GLOBAL_SYNC_EVENT = "liba-global-sync-done";

type StepStatus = "pending" | "active" | "done";

const GOOGLE_SYNC_TIMEOUT_MS = 120_000;
const FACEBOOK_SYNC_TIMEOUT_MS = 180_000;

function formatSyncStamp(iso: string | null | undefined): string {
  if (!iso) return "טרם סונכרן";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "טרם סונכרן";
  const day = date.toLocaleDateString("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const time = date.toLocaleTimeString("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${day} · ${time}`;
}

function notifyGlobalSyncDone() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(GLOBAL_SYNC_EVENT));
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} חרג מזמן (${Math.round(ms / 1000)} שנ׳) — נסו שוב`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function GlobalSyncButton({ canSyncAds = true }: { canSyncAds?: boolean }) {
  const { dashboard } = useLiveDashboard();
  const [busy, setBusy] = useState(false);
  const [excelStatus, setExcelStatus] = useState<StepStatus>("pending");
  const [googleStatus, setGoogleStatus] = useState<StepStatus>("pending");
  const [facebookStatus, setFacebookStatus] = useState<StepStatus>("pending");

  const syncAll = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setExcelStatus("active");
    setGoogleStatus("pending");
    setFacebookStatus("pending");

    try {
      toast.message("מסנכרן אקסל…");
      const excelRes = await fetch(`/api/sales-dashboard?force=1&t=${Date.now()}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!excelRes.ok) {
        throw new Error(
          excelRes.status === 401 ? "אין הרשאה לסנכרון אקסל" : "סנכרון אקסל נכשל",
        );
      }
      const excelData = (await excelRes.json()) as DashboardData;
      publishLiveDashboard(excelData);
      setExcelStatus("done");

      const people = await syncEmployeesFromExcel();
      if (people.error) {
        toast.error(people.error);
      } else if (people.added > 0) {
        toast.success(
          `עודכנו ${people.added} כרטיסי עובדים מהאקסל (${people.found} משווקים)`,
        );
      }

      if (canSyncAds) {
        setGoogleStatus("active");
        toast.message("מסנכרן גוגל אדס…");
        try {
          const google = await withTimeout(
            syncGoogleAds(),
            GOOGLE_SYNC_TIMEOUT_MS,
            "סנכרון גוגל",
          );
          if (!google.ok) {
            toast.error(google.error ?? "סנכרון גוגל נכשל");
          } else if (!google.skipped) {
            toast.success("גוגל עודכן");
          }
        } catch (err: unknown) {
          toast.error(err instanceof Error ? err.message : "סנכרון גוגל נכשל");
        }
        setGoogleStatus("done");

        setFacebookStatus("active");
        toast.message("מסנכרן פייסבוק…");
        try {
          const facebook = await withTimeout(
            syncFacebookAds(),
            FACEBOOK_SYNC_TIMEOUT_MS,
            "סנכרון פייסבוק",
          );
          if (!facebook.ok) {
            toast.error(facebook.error ?? "סנכרון פייסבוק נכשל");
          } else if (!facebook.skipped) {
            toast.success("פייסבוק עודכן");
          }
        } catch (err: unknown) {
          toast.error(err instanceof Error ? err.message : "סנכרון פייסבוק נכשל");
        }
        setFacebookStatus("done");
      } else {
        setGoogleStatus("done");
        setFacebookStatus("done");
      }

      notifyGlobalSyncDone();
      toast.success("הסנכרון הסתיים — מוצג העדכון האחרון");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "שגיאה בסנכרון");
      setExcelStatus((s) => (s === "active" ? "done" : s));
      setGoogleStatus((s) => (s === "active" || s === "pending" ? "done" : s));
      setFacebookStatus((s) => (s === "active" || s === "pending" ? "done" : s));
      notifyGlobalSyncDone();
    } finally {
      setBusy(false);
    }
  }, [busy, canSyncAds]);

  const syncedStamp = formatSyncStamp(dashboard?.syncedAt);
  const statusLine = `סנכרון אחרון · ${syncedStamp}`;

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        disabled={busy}
        onClick={() => void syncAll()}
        aria-label={`סנכרון מערכת. ${statusLine}`}
        className="inline-flex h-10 items-center gap-2 rounded-2xl border border-white/10 bg-black py-1 pe-3 ps-1 text-white shadow-[0_10px_24px_-16px_rgba(0,0,0,0.8)] transition-transform active:scale-[0.98] disabled:opacity-80 sm:h-11 sm:gap-2.5 sm:rounded-full sm:pe-4 sm:ps-1.5"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-highlight text-black sm:size-8 sm:rounded-full">
          <RefreshCw className={cn("size-3.5", busy && "animate-spin")} />
        </span>
        <span className="flex min-w-0 flex-col items-start text-start leading-none">
          <span className="text-[12px] font-semibold tracking-tight sm:text-[13px]">סנכרון מערכת</span>
          <span className="mt-1 whitespace-nowrap text-[10px] font-medium text-white/60">
            {statusLine}
          </span>
        </span>
      </button>

      {busy ? (
        <div className="absolute end-0 top-[calc(100%+0.5rem)] z-50 w-[min(16.5rem,calc(100vw-1.5rem))] rounded-2xl border border-black/[0.08] bg-white/95 p-3 shadow-[0_18px_40px_-18px_rgba(17,17,17,0.45)] backdrop-blur-md">
          <p className="text-[11px] font-semibold text-foreground">סנכרון מערכת…</p>
          <div className="mt-2 space-y-1.5">
            <SyncStepRow label="אקסל" status={excelStatus} />
            <SyncStepRow label="גוגל אדס" status={googleStatus} />
            <SyncStepRow label="פייסבוק" status={facebookStatus} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SyncStepRow({
  label,
  status,
}: {
  label: string;
  status: StepStatus;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg px-1.5 py-1 text-xs",
        status === "active" && "bg-highlight/25 text-foreground",
        status === "done" && "text-muted-foreground",
        status === "pending" && "text-muted-foreground/50",
      )}
    >
      {status === "done" ? (
        <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">
          ✓
        </span>
      ) : status === "active" ? (
        <RefreshCw className="size-3.5 shrink-0 animate-spin" />
      ) : (
        <span className="inline-flex size-4 shrink-0 rounded-full border border-black/10" />
      )}
      <span className={cn(status === "active" && "animate-pulse font-medium")}>
        {label}
      </span>
    </div>
  );
}
