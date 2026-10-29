"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronRight, Search } from "lucide-react";
import { MenuField } from "@/components/admin/menu-field";
import { useTranslations } from "next-intl";

export type PromotionRow = {
  handle: string;
  name: string;
  line: string;
  image: string;
  live: boolean;
  note: string;
  price: string;
  compareAt: string;
  percent: number;
};

export function PromotionsTable({ rows }: { rows: PromotionRow[] }) {
  const t = useTranslations("promotionsDesk");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [state, setState] = useState<"all" | "active" | "inactive">("all");
  const [sort, setSort] = useState<"name" | "off">("off");
  const activeCount = rows.filter((row) => row.live).length;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const next = rows.filter((row) => {
      if (state === "active" && !row.live) return false;
      if (state === "inactive" && row.live) return false;
      if (!needle) return true;
      return [row.name, row.line, row.handle].join(" ").toLowerCase().includes(needle);
    });
    return next.toSorted((a, b) => (sort === "off" ? b.percent - a.percent || a.name.localeCompare(b.name) : a.name.localeCompare(b.name)));
  }, [query, rows, sort, state]);

  const filters = [
    { id: "all" as const, label: t("all"), count: rows.length },
    { id: "active" as const, label: t("active"), count: activeCount },
    { id: "inactive" as const, label: t("inactive"), count: rows.length - activeCount },
  ];

  return (
    <section className="work-sheet overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-black/10 px-3 py-3">
        <div className="flex rounded-full bg-muted p-1">
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              aria-pressed={state === filter.id}
              onClick={() => setState(filter.id)}
              className={
                state === filter.id
                  ? "rounded-full bg-background px-3 py-1.5 text-sm font-medium"
                  : "rounded-full px-3 py-1.5 text-sm text-muted-foreground"
              }
            >
              {filter.label}
              <span className="ms-1 tabular-nums">{filter.count}</span>
            </button>
          ))}
        </div>
        <label className="flex h-10 min-w-48 flex-1 items-center gap-2 rounded-full border border-black/10 px-3">
          <Search className="size-4 text-muted-foreground" />
          <span className="sr-only">{t("search")}</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("search")}
            className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
        <div className="w-40">
          <MenuField
            ariaLabel={t("sort")}
            value={sort}
            onChange={(value) => setSort(value === "name" ? "name" : "off")}
            options={[
              { value: "off", label: t("sortOff") },
              { value: "name", label: t("sortName") },
            ]}
          />
        </div>
      </div>
      <table className="w-full table-fixed border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-xs font-medium text-muted-foreground">
            <th className="px-4 py-3 text-start font-medium">{t("product")}</th>
            <th className="w-28 px-3 py-3 text-start font-medium">{t("state")}</th>
            <th className="w-36 px-3 py-3 text-start font-medium">{t("regular")}</th>
            <th className="w-36 px-3 py-3 text-start font-medium">{t("sale")}</th>
            <th className="w-24 px-3 py-3 text-start font-medium">{t("off")}</th>
            <th className="w-10 px-3 py-3"><span className="sr-only">{t("sort")}</span></th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-muted-foreground">
                {t("none")}
              </td>
            </tr>
          ) : null}
          {visible.map((row) => (
            <tr
              key={row.handle}
              tabIndex={0}
              onClick={() => router.push(`/admin/store/products/${row.handle}`)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  router.push(`/admin/store/products/${row.handle}`);
                }
              }}
              data-clickable=""
              className="border-b border-border last:border-b-0 hover:bg-muted/70 focus-visible:bg-muted focus-visible:outline-none"
            >
              <td className="overflow-hidden px-4 py-3">
                <span className="flex min-w-0 items-center gap-3">
                  <Image src={row.image} alt="" width={80} height={80} className="size-10 rounded-lg object-cover" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium tracking-[-0.02em]">{row.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{row.note || row.line}</span>
                  </span>
                </span>
              </td>
              <td className="px-3 py-3">
                <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                  {row.live ? t("active") : t("inactive")}
                </span>
              </td>
              <td className="px-3 py-3 text-muted-foreground">
                <bdi className="tabular-nums">{row.compareAt}</bdi>
              </td>
              <td className="px-3 py-3">
                <bdi className="font-medium tabular-nums">{row.price}</bdi>
              </td>
              <td className="px-3 py-3 tabular-nums">{row.percent > 0 ? `${row.percent}%` : t("noOff")}</td>
              <td className="px-3 py-3 text-muted-foreground">
                <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-black/10 px-4 py-3 text-xs text-muted-foreground">{t("shown", { count: visible.length })}</p>
    </section>
  );
}
