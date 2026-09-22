"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { GLOBAL_SYNC_EVENT } from "@/components/layout/global-sync-button";
import {
  LIVE_DASHBOARD_DATA_EVENT,
  loadLiveDashboardUntilSync,
  readCachedLiveDashboard,
  subscribeLiveDashboard,
} from "@/lib/sales-dashboard/client-snapshot";
import type { DashboardData } from "@/lib/sales-dashboard/types";

type LiveDashboardContextValue = {
  dashboard: DashboardData | null;
  ready: boolean;
};

const LiveDashboardContext = createContext<LiveDashboardContextValue>({
  dashboard: null,
  ready: false,
});

function isLiveDashboard(value: unknown): value is DashboardData {
  if (!value || typeof value !== "object") return false;
  const data = value as DashboardData;
  return data.source === "live" && Array.isArray(data.marketing?.productions);
}

export function LiveDashboardProvider({ children }: { children: ReactNode }) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    setDashboard(readCachedLiveDashboard());
    setReady(true);
  }, []);

  useEffect(() => {
    return subscribeLiveDashboard(() => {
      setDashboard(readCachedLiveDashboard());
    });
  }, []);

  useEffect(() => {
    const onSyncDone = () => {
      setDashboard(readCachedLiveDashboard());
      void loadLiveDashboardUntilSync()
        .then((next) => {
          if (next) setDashboard(next);
        })
        .catch(() => undefined);
    };
    const onData = (event: Event) => {
      const detail = (event as CustomEvent<DashboardData>).detail;
      if (isLiveDashboard(detail)) setDashboard(detail);
    };
    window.addEventListener(GLOBAL_SYNC_EVENT, onSyncDone);
    window.addEventListener(LIVE_DASHBOARD_DATA_EVENT, onData as EventListener);
    return () => {
      window.removeEventListener(GLOBAL_SYNC_EVENT, onSyncDone);
      window.removeEventListener(
        LIVE_DASHBOARD_DATA_EVENT,
        onData as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const adopt = (next: DashboardData | null) => {
      if (!cancelled && next) setDashboard(next);
    };
    void loadLiveDashboardUntilSync().then(adopt).catch(() => undefined);

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void loadLiveDashboardUntilSync().then(adopt).catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  const value = useMemo(
    () => ({ dashboard, ready }),
    [dashboard, ready],
  );

  return (
    <LiveDashboardContext.Provider value={value}>
      {children}
    </LiveDashboardContext.Provider>
  );
}

export function useLiveDashboard() {
  return useContext(LiveDashboardContext);
}
