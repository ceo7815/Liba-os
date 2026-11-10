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

export function OperatingBrandProvider({
  children,
  lockedBrand,
}: {
  children: ReactNode;
  lockedBrand?: OperatingBrandId;
}) {
  const [brand, setBrandState] = useState<OperatingBrandId>(lockedBrand ?? DEFAULT_OPERATING_BRAND);
  const [shemeshEmployeeNames, setShemeshEmployeeNames] = useState<string[]>([]);

  useLayoutEffect(() => {
    if (lockedBrand) return;
    try {
      const saved = parseOperatingBrand(localStorage.getItem(OPERATING_BRAND_STORAGE_KEY));
      if (saved) setBrandState(saved);
    } catch {
      /* private mode */
    }
  }, [lockedBrand]);

  useEffect(() => {
    let cancelled = false;
    void listShemeshEmployeeNames()
      .then((result) => {
        if (cancelled || result.error) return;
        setShemeshEmployeeNames(result.names);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const setBrand = useCallback((next: OperatingBrandId) => {
    if (lockedBrand) return;
    setBrandState(next);
    try {
      localStorage.setItem(OPERATING_BRAND_STORAGE_KEY, next);
    } catch {
      /* quota / private mode */
    }
  }, [lockedBrand]);

  const value = useMemo(
    () => ({ brand: lockedBrand ?? brand, setBrand, shemeshEmployeeNames }),
    [lockedBrand, brand, setBrand, shemeshEmployeeNames],
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
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-3 py-2.5 shadow-[0_1px_0_rgba(17,17,17,0.03)] sm:flex-row sm:items-center sm:justify-between sm:px-4">
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-muted-foreground">מותג תצוגה</p>
        <p className="text-sm font-semibold tracking-tight">הכל · ליבה · שמש</p>
      </div>
      <div
        className="flex items-center gap-1 self-start rounded-full bg-[#f6f5f1] p-1 sm:self-auto"
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
                "h-8 rounded-full px-3.5 text-xs font-semibold transition-colors",
                selected && id === "shemesh" && "bg-amber-700 text-white",
                selected && id === "liba" && "bg-[#1a1a1a] text-white",
                selected && id === "all" && "bg-highlight text-highlight-foreground",
                !selected && "text-muted-foreground hover:bg-card",
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
