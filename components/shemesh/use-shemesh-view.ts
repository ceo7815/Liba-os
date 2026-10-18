"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { buildShemeshView, campaignOptions, defaultShemeshRange } from "@/lib/shemesh/engine";
import {
  AD_PLATFORMS,
  EMPTY_SHEMESH_SNAPSHOT,
  INCOME_KINDS,
  type AdPlatform,
  type IncomeKind,
  type ShemeshFilter,
} from "@/lib/shemesh/model";

function isPlatform(value: string | null): value is AdPlatform {
  return AD_PLATFORMS.some((platform) => platform === value);
}

function isIncome(value: string | null): value is IncomeKind {
  return INCOME_KINDS.some((kind) => kind === value);
}

export function useShemeshFilter() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const range = defaultShemeshRange();

  const filter = useMemo<ShemeshFilter>(() => {
    const platform = params.get("platform");
    const income = params.get("income");
    const campaign = params.get("campaign");
    return {
      from: params.get("from") || range.from,
      to: params.get("to") || range.to,
      adPlatform: isPlatform(platform) ? platform : "all",
      campaignId: campaign || "all",
      incomeKind: isIncome(income) ? income : "all",
    };
  }, [params, range.from, range.to]);

  function setFilter(patch: Partial<ShemeshFilter>) {
    const next = new URLSearchParams(params.toString());
    const write = (key: string, value: string | null | undefined, allValue?: string) => {
      if (!value || value === allValue) next.delete(key);
      else next.set(key, value);
    };
    if ("from" in patch) write("from", patch.from);
    if ("to" in patch) write("to", patch.to);
    if ("adPlatform" in patch) write("platform", patch.adPlatform, "all");
    if ("campaignId" in patch) write("campaign", patch.campaignId, "all");
    if ("incomeKind" in patch) write("income", patch.incomeKind, "all");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return { filter, setFilter };
}

export function useShemeshView() {
  const { filter, setFilter } = useShemeshFilter();
  const view = useMemo(() => buildShemeshView(EMPTY_SHEMESH_SNAPSHOT, filter), [filter]);
  return {
    filter,
    setFilter,
    view,
    campaigns: campaignOptions(EMPTY_SHEMESH_SNAPSHOT),
  };
}
