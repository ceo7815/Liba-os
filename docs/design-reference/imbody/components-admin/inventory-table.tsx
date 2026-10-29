"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import type { StockMove, StockRow } from "@/lib/admin/stock";

const reasons = ["invoice", "manual_in", "manual_out", "order", "refund"] as const;
const unitStates = ["available", "allocated", "returned", "issued"] as const;

export function InventoryTable({
  rows,
  moves,
  locale,
}: {
  rows: StockRow[];
  moves: StockMove[];
  locale: string;
}) {
  const t = useTranslations("stock");
  const catalog = useTranslations("catalog");
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      rows.filter((row) => {
        if (!needle) return true;
        return [row.name, row.sku, row.handle, ...row.units.map((unit) => unit.serial)].join(" ").toLowerCase().includes(needle);
      }),
    [needle, rows],
  );
  const history = useMemo(
    () =>
      moves.filter((move) => {
        if (!needle) return true;
        return [move.handle, move.reference, move.reason].join(" ").toLowerCase().includes(needle);
      }),
    [moves, needle],
  );
  const names = new Map(rows.map((row) => [row.handle, row.name]));

  function unitLabel(status: string) {
    return unitStates.includes(status as (typeof unitStates)[number]) ? t(`units.${status as (typeof unitStates)[number]}`) : status;
  }

  function reasonLabel(reason: string) {
    return reasons.includes(reason as (typeof reasons)[number]) ? t(`reasons.${reason as (typeof reasons)[number]}`) : reason;
  }

  function formatWhen(at: string) {
    const date = new Date(at);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Dubai",
    }).format(date);
  }

  return (
    <div className="flex flex-col gap-5">
      <label className="flex h-10 max-w-md items-center gap-2 rounded-full border border-black/10 bg-background px-3">
        <Search className="size-4 text-muted-foreground" />
        <span className="sr-only">{t("search")}</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("search")}
          className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>
      <section className="work-sheet overflow-hidden">
        <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr className="border-b border-black/10 text-xs font-medium text-muted-foreground">
                <th className="px-4 py-3 text-start font-medium">{t("columns.product")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("columns.sku")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("columns.onHand")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-muted-foreground">
                    {catalog("none")}
                  </td>
                </tr>
              ) : null}
              {visible.map((row) => (
                <tr key={row.handle} className="border-b border-black/10 last:border-b-0">
                  <td className="px-4 py-3">
                    <span className="block font-medium tracking-[-0.02em]">{row.name}</span>
                    <span className="block text-xs text-muted-foreground">{row.handle}</span>
                    {row.units.length > 0 ? (
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        {row.units.map((unit) => (
                          <span key={unit.serial} className="inline-flex items-center gap-1.5 rounded-full border border-black/10 px-2 py-1 text-xs">
                            <bdi>{unit.serial}</bdi>
                            <span className="text-muted-foreground">{unitLabel(unit.status)}</span>
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3"><bdi className="tabular-nums">{row.sku}</bdi></td>
                  <td className="px-4 py-3 tabular-nums">{row.onHand === null ? catalog("uncounted") : row.onHand}</td>
                </tr>
              ))}
            </tbody>
          </table>
      </section>
      <section className="work-sheet overflow-hidden">
        <h2 className="border-b border-black/10 px-4 py-3 text-sm font-medium">{t("moves")}</h2>
        <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr className="border-b border-black/10 text-xs font-medium text-muted-foreground">
                <th className="px-4 py-3 text-start font-medium">{t("columns.when")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("columns.reason")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("columns.reference")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("columns.product")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("columns.qty")}</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-muted-foreground">
                    {t("noMoves")}
                  </td>
                </tr>
              ) : null}
              {history.map((move) => (
                <tr key={move.id} className="border-b border-black/10 last:border-b-0">
                  <td className="px-4 py-3 text-muted-foreground">{formatWhen(move.at)}</td>
                  <td className="px-4 py-3">{reasonLabel(move.reason)}</td>
                  <td className="px-4 py-3">{move.reference}</td>
                  <td className="px-4 py-3">{names.get(move.handle) ?? move.handle}</td>
                  <td className="px-4 py-3 tabular-nums">{move.qty > 0 ? `+${move.qty}` : move.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
      </section>
    </div>
  );
}
