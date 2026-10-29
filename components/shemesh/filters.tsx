"use client";

import { HebrewDateRange } from "@/components/shemesh/hebrew-date";
import { useShemeshFilter } from "@/components/shemesh/use-shemesh-view";
import {
  AD_PLATFORM_LABEL,
  AD_PLATFORMS,
  INCOME_KIND_LABEL,
  INCOME_KINDS,
} from "@/lib/shemesh/model";

const fieldClass =
  "h-8 rounded-lg border border-border bg-card px-2 text-xs font-medium text-foreground";

export function ShemeshFilters({
  showPlatform = false,
  showIncome = false,
}: {
  showPlatform?: boolean;
  showCampaign?: boolean;
  showIncome?: boolean;
}) {
  const { filter, setFilter } = useShemeshFilter();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <HebrewDateRange from={filter.from} to={filter.to} onChange={(next) => setFilter(next)} />
      {showPlatform ? (
        <select
          aria-label="מקור פרסום"
          value={filter.adPlatform}
          onChange={(event) =>
            setFilter({ adPlatform: event.target.value as typeof filter.adPlatform })
          }
          className={fieldClass}
        >
          <option value="all">כל המקורות</option>
          {AD_PLATFORMS.filter((platform) => platform !== "other").map((platform) => (
            <option key={platform} value={platform}>
              {AD_PLATFORM_LABEL[platform]}
            </option>
          ))}
        </select>
      ) : null}
      {showIncome ? (
        <select
          aria-label="סוג הכנסה"
          value={filter.incomeKind}
          onChange={(event) =>
            setFilter({ incomeKind: event.target.value as typeof filter.incomeKind })
          }
          className={fieldClass}
        >
          <option value="all">כל סוגי ההכנסה</option>
          {INCOME_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {INCOME_KIND_LABEL[kind]}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
