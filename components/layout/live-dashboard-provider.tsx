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
import {
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
    if (dashboard) return;
    let cancelled = false;
    void loadLiveDashboardUntilSync()
      .then((next) => {
        if (!cancelled && next) setDashboard(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [dashboard]);

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
