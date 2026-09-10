"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { listShemeshEmployeeNames } from "@/app/actions/finance-operating-brand";
import {
  DEFAULT_OPERATING_BRAND,
  OPERATING_BRANDS,
  OPERATING_BRAND_LABEL,
  OPERATING_BRAND_STORAGE_KEY,
  parseOperatingBrand,
  type OperatingBrandId,
} from "@/lib/finance/operating-brand";
import { cn } from "@/lib/utils";

type OperatingBrandContextValue = {
  brand: OperatingBrandId;
  setBrand: (next: OperatingBrandId) => void;
  shemeshEmployeeNames: string[];
};

const OperatingBrandContext = createContext<OperatingBrandContextValue | null>(null);

export function OperatingBrandProvider({ children }: { children: ReactNode }) {
  const [brand, setBrandState] = useState<OperatingBrandId>(DEFAULT_OPERATING_BRAND);
  const [shemeshEmployeeNames, setShemeshEmployeeNames] = useState<string[]>([]);

  useLayoutEffect(() => {
    try {
      const saved = parseOperatingBrand(localStorage.getItem(OPERATING_BRAND_STORAGE_KEY));
      if (saved) setBrandState(saved);
    } catch {
      /* private mode */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void listShemeshEmployeeNames().then((result) => {
      if (cancelled || result.error) return;
      setShemeshEmployeeNames(result.names);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setBrand = useCallback((next: OperatingBrandId) => {
    setBrandState(next);
    try {
      localStorage.setItem(OPERATING_BRAND_STORAGE_KEY, next);
    } catch {
      /* quota / private mode */
    }
  }, []);

  const value = useMemo(
    () => ({ brand, setBrand, shemeshEmployeeNames }),
    [brand, setBrand, shemeshEmployeeNames],
  );

  return (
    <OperatingBrandContext.Provider value={value}>{children}</OperatingBrandContext.Provider>
  );
}

export function useOperatingBrand(): OperatingBrandContextValue {
  const ctx = useContext(OperatingBrandContext);
  if (!ctx) {
    return {
      brand: DEFAULT_OPERATING_BRAND,
      setBrand: () => undefined,
      shemeshEmployeeNames: [],
    };
  }
  return ctx;
}

export function OperatingBrandBar() {
  const { brand, setBrand } = useOperatingBrand();

  return (
    <div className="mb-0 flex flex-col gap-2.5 rounded-[1.25rem] border border-black/[0.06] bg-white px-3.5 py-3 shadow-[0_1px_0_rgba(17,17,17,0.03)] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:rounded-[var(--radius)] sm:px-5">
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-muted-foreground">מותג תצוגה</p>
        <p className="mt-0.5 text-sm font-semibold tracking-tight">ליבה · שמש</p>
      </div>
      <div
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 hide-scrollbar sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
        role="tablist"
        aria-label="בחירת מותג"
      >
        {OPERATING_BRANDS.map((id) => {
          const selected = brand === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setBrand(id)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors active:scale-95 sm:py-1.5",
                selected && id === "shemesh" && "bg-amber-700 text-white",
                selected && id === "liba" && "bg-black text-white",
                selected && id === "all" && "bg-zinc-700 text-white",
                !selected && "bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {OPERATING_BRAND_LABEL[id]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
