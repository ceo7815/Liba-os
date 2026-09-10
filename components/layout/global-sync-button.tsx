"use client";

import { useCallback, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { syncEmployeesFromExcel } from "@/app/actions/finance-people";
import { syncFacebookAds } from "@/app/actions/facebook-ads";
import { syncGoogleAds } from "@/app/actions/google-ads";
import { publishLiveDashboard } from "@/lib/sales-dashboard/client-snapshot";
import type { DashboardData } from "@/lib/sales-dashboard/types";
import { cn } from "@/lib/utils";

export const GLOBAL_SYNC_EVENT = "liba-global-sync-done";

type SyncStep = "idle" | "excel" | "google" | "facebook";

type StepStatus = "pending" | "active" | "done";

const GOOGLE_SYNC_TIMEOUT_MS = 120_000;
const FACEBOOK_SYNC_TIMEOUT_MS = 180_000;

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
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<SyncStep>("idle");
  const [excelStatus, setExcelStatus] = useState<StepStatus>("pending");
  const [googleStatus, setGoogleStatus] = useState<StepStatus>("pending");
  const [facebookStatus, setFacebookStatus] = useState<StepStatus>("pending");

  const syncAll = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setStep("excel");
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
        setStep("google");
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

        setStep("facebook");
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
      setStep("idle");
      setBusy(false);
    }
  }, [busy, canSyncAds]);

  const label = !busy
    ? "סנכרן הכל · אקסל · גוגל · פייסבוק"
    : step === "excel"
      ? "מסנכרן אקסל…"
      : step === "google"
        ? "מסנכרן גוגל אדס…"
        : step === "facebook"
          ? "מסנכרן פייסבוק…"
          : "מסנכרן…";

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        disabled={busy}
        onClick={() => void syncAll()}
        className="inline-flex size-10 items-center justify-center rounded-xl bg-black text-white transition-transform active:scale-95 disabled:opacity-70 sm:h-auto sm:w-auto sm:gap-1.5 sm:rounded-full sm:px-3 sm:py-1.5"
        aria-label="סנכרון מלא של המערכת"
      >
        <RefreshCw className={cn("size-4 shrink-0 sm:size-3.5", busy && "animate-spin")} />
        <span className="hidden whitespace-nowrap text-xs font-semibold xl:inline">{label}</span>
        <span className="hidden whitespace-nowrap text-xs font-semibold sm:inline xl:hidden">
          {busy ? label.replace("מסנכרן ", "") : "סנכרן הכל"}
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
