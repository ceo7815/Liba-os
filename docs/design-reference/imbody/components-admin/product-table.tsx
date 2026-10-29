"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronRight, Search } from "lucide-react";
import { MenuField } from "@/components/admin/menu-field";
import { useTranslations } from "next-intl";

export type ProductTableRow = {
  handle: string;
  name: string;
  line: string;
  status: "active" | "hidden";
  price: string;
  priceValue: number;
  compareAt: string;
  screen: string;
  sku: string;
  image: string;
  stock: number | null;
};

export function ProductTable({ rows }: { rows: ProductTableRow[] }) {
  const t = useTranslations("catalog");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "hidden" | "low">("all");
  const [sort, setSort] = useState<"name" | "price">("name");
  const activeCount = rows.filter((row) => row.status === "active").length;
  const hiddenCount = rows.length - activeCount;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const next = rows.filter((row) => {
      if (status === "low" && !(row.stock != null && row.stock <= 2)) return false;
      if (status !== "all" && status !== "low" && row.status !== status) return false;
      if (!needle) return true;
      return [row.name, row.line, row.handle, row.screen, row.sku].join(" ").toLowerCase().includes(needle);
    });
    return next.toSorted((a, b) => (sort === "price" ? a.priceValue - b.priceValue : a.name.localeCompare(b.name)));
  }, [query, rows, sort, status]);

  const filters = [
    { id: "all" as const, label: t("all"), count: rows.length },
    { id: "active" as const, label: t("onSite"), count: activeCount },
    { id: "hidden" as const, label: t("hidden"), count: hiddenCount },
    { id: "low" as const, label: t("low"), count: rows.filter((row) => row.stock != null && row.stock <= 2).length },
  ];

  return (
    <section className="work-sheet overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-black/10 px-3 py-3">
        <div className="flex rounded-full bg-muted p-1">
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              aria-pressed={status === filter.id}
              onClick={() => setStatus(filter.id)}
              className={
                status === filter.id
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
          <span className="sr-only">{t("columns.product")}</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("columns.product")}
            className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
        <div className="w-40">
          <MenuField
            ariaLabel={t("sort")}
            value={sort}
            onChange={(value) => setSort(value === "price" ? "price" : "name")}
            options={[
              { value: "name", label: t("sortName") },
              { value: "price", label: t("sortPrice") },
            ]}
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-medium text-muted-foreground">
              <th className="px-4 py-3 text-start font-medium">{t("columns.product")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("columns.status")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("columns.price")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("columns.screen")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("columns.stock")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("columns.sku")}</th>
              <th className="w-10 px-3 py-3"><span className="sr-only">{t("edit")}</span></th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-muted-foreground">
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
                <td className="px-4 py-3">
                  <a href={`/admin/store/products/${row.handle}`} className="flex min-w-0 items-center gap-3">
                    <Image src={row.image} alt="" width={80} height={80} className="size-10 rounded-lg object-cover" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium tracking-[-0.02em]">{row.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{row.line}</span>
                    </span>
                  </a>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      row.status === "active"
                        ? "inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium"
                        : "inline-flex rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                    }
                  >
                    {row.status === "active" ? t("onSite") : t("hidden")}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-baseline gap-2 whitespace-nowrap">
                    <bdi className="font-medium tabular-nums">{row.price}</bdi>
                    {row.compareAt !== row.price ? (
                      <bdi className="text-xs text-muted-foreground line-through tabular-nums">{row.compareAt}</bdi>
                    ) : null}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <bdi>{row.screen}</bdi>
                </td>
                <td className="px-4 py-3 tabular-nums">
                  <a
                    href="/admin/store/inventory"
                    onClick={(event) => event.stopPropagation()}
                    className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {row.stock === null ? t("uncounted") : row.stock}
                  </a>
                </td>
                <td className="px-4 py-3">
                  <bdi className="tabular-nums">{row.sku}</bdi>
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-black/10 px-4 py-3 text-xs text-muted-foreground">{t("shown", { count: visible.length })}</p>
    </section>
  );
}
