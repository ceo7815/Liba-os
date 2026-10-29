"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { MenuField } from "@/components/admin/menu-field";
import { DateField, MonthField } from "@/components/admin/date-field";
import { Button } from "@/components/ui/button";
import type { OrderDetail } from "@/lib/admin/orders";
import { money } from "@/lib/admin/money";
import { markTransferPaid } from "@/lib/store/mark-paid";

const PAGE = 20;
const PRESETS = ["all", "today", "yesterday", "days7", "days30", "thisMonth", "lastMonth"] as const;
const PAYMENTS = ["unpaid", "paid", "partially_refunded", "refunded"] as const;
const STATUSES = ["pending_payment", "paid", "processing", "installed", "completed", "cancelled", "refunded", "partially_refunded", "expired"] as const;

type Preset = (typeof PRESETS)[number] | "range";
type SortKey = "number" | "date" | "customer" | "total";

export function OrdersTable({ orders }: { orders: OrderDetail[] }) {
  const t = useTranslations("ordersDesk");
  const locale = useLocale();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [payment, setPayment] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "date", dir: "desc" });
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const day = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", {
        dateStyle: "medium",
        timeZone: "Asia/Dubai",
      }),
    [locale],
  );
  const active = matchingPreset(from, to);
  const month = monthValue(from, to);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const next = orders.filter((order) => {
      const day = orderDay(order.placedAt);
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (payment !== "all" && order.paymentStatus !== payment) return false;
      if (status !== "all" && order.status !== status) return false;
      if (!needle) return true;
      const haystack = [
        `IMB-${order.number}`,
        order.customer,
        order.email,
        order.phone,
        order.city,
        order.emirate,
        order.source,
        ...order.items.flatMap((item) => [item.nameEn, item.nameAr, item.sku]),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return next.toSorted((a, b) => {
      if (sort.key === "number") return (a.number - b.number) * dir;
      if (sort.key === "total") return (a.total - b.total) * dir;
      if (sort.key === "customer") return a.customer.localeCompare(b.customer, locale) * dir;
      return a.placedAt.localeCompare(b.placedAt) * dir;
    });
  }, [from, locale, orders, payment, query, sort.dir, sort.key, status, to]);

  const pages = Math.max(1, Math.ceil(visible.length / PAGE));
  const safePage = Math.min(page, pages - 1);
  const pageRows = visible.slice(safePage * PAGE, safePage * PAGE + PAGE);
  const pendingIds = selected.filter((id) => orders.some((order) => order.id === id && order.status === "pending_payment"));
  const rangeStart = visible.length === 0 ? 0 : safePage * PAGE + 1;
  const rangeEnd = Math.min(visible.length, (safePage + 1) * PAGE);

  function choosePreset(next: Exclude<Preset, "range">) {
    setPage(0);
    if (next === "all") {
      setFrom("");
      setTo("");
      return;
    }
    const range = presetRange(next);
    setFrom(range.from);
    setTo(range.to);
  }

  function toggleSort(key: SortKey) {
    setSort((current) =>
      current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "customer" ? "asc" : "desc" },
    );
  }

  function togglePage(ids: string[]) {
    setSelected((current) => {
      const all = ids.length > 0 && ids.every((id) => current.includes(id));
      return all ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])];
    });
  }

  return (
    <section className="work-sheet overflow-hidden">
      <div className="grid gap-3 border-b border-border px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-10 min-w-52 flex-1 items-center gap-2 rounded-full border border-border px-3 focus-within:ring-2 focus-within:ring-ring">
            <Search className="size-4 text-muted-foreground" />
            <span className="sr-only">{t("search")}</span>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
              placeholder={t("search")}
              className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
          <div className="w-44">
            <MenuField
              ariaLabel={t("columns.payment")}
              value={payment}
              onChange={(value) => {
                setPayment(value);
                setPage(0);
              }}
              options={[{ value: "all", label: `${t("columns.payment")}: ${t("all")}` }, ...PAYMENTS.map((id) => ({ value: id, label: t(`pay.${id}`) }))]}
            />
          </div>
          <div className="w-44">
            <MenuField
              ariaLabel={t("columns.fulfillment")}
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPage(0);
              }}
              options={[{ value: "all", label: `${t("columns.fulfillment")}: ${t("all")}` }, ...STATUSES.map((id) => ({ value: id, label: t(`status.${id}`) }))]}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={active === id}
              onClick={() => choosePreset(id)}
              className={
                active === id
                  ? "rounded-full bg-foreground px-3 py-1.5 text-sm font-medium text-background"
                  : "rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
              }
            >
              {t(id)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-44">
            <DateField
              label={t("from")}
              value={from}
              onChange={(value) => {
                setFrom(value);
                setPage(0);
              }}
            />
          </div>
          <div className="w-44">
            <DateField
              label={t("to")}
              value={to}
              onChange={(value) => {
                setTo(value);
                setPage(0);
              }}
            />
          </div>
          <div className="w-44">
            <MonthField
              label={t("month")}
              value={month}
              onChange={(value) => {
                setPage(0);
                if (!value) {
                  setFrom("");
                  setTo("");
                  return;
                }
                const [year, monthNumber] = value.split("-").map(Number);
                const bounds = monthBounds(year, monthNumber);
                setFrom(bounds.from);
                setTo(bounds.to);
              }}
            />
          </div>
        </div>
      </div>
      {pendingIds.length > 0 ? (
        <form action={markTransferPaid} className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <span className="text-sm text-muted-foreground">{t("selected", { count: pendingIds.length })}</span>
          {pendingIds.map((id) => (
            <input key={id} type="hidden" name="id" value={id} />
          ))}
          <Button type="submit" className="rounded-full px-4">
            {t("markPaid")}
          </Button>
        </form>
      ) : null}
      <div className="overflow-x-hidden">
      <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-medium text-muted-foreground">
              <th className="w-10 px-3 py-3 text-start">
                <input
                  type="checkbox"
                  checked={pageRows.length > 0 && pageRows.every((order) => selected.includes(order.id))}
                  onChange={() => togglePage(pageRows.map((order) => order.id))}
                  aria-label={t("selectPage")}
                  className="size-4 accent-foreground"
                />
              </th>
              <SortHead label={t("columns.order")} active={sort.key === "number"} dir={sort.dir} onClick={() => toggleSort("number")} className="w-28" />
              <SortHead label={t("columns.date")} active={sort.key === "date"} dir={sort.dir} onClick={() => toggleSort("date")} className="w-36" />
              <SortHead label={t("columns.customer")} active={sort.key === "customer"} dir={sort.dir} onClick={() => toggleSort("customer")} />
              <th className="w-32 px-3 py-3 text-start font-medium">{t("columns.payment")}</th>
              <th className="w-36 px-3 py-3 text-start font-medium">{t("columns.fulfillment")}</th>
              <SortHead label={t("columns.total")} active={sort.key === "total"} dir={sort.dir} onClick={() => toggleSort("total")} className="w-28" />
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-muted-foreground">
                  {t("empty")}
                </td>
              </tr>
            ) : null}
            {pageRows.map((order) => (
              <tr
                key={order.id}
                tabIndex={0}
                onClick={() => router.push(`/admin/orders/${order.id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(`/admin/orders/${order.id}`);
                  }
                }}
                data-clickable=""
                className="border-b border-border last:border-b-0 hover:bg-muted/70 focus-visible:bg-muted focus-visible:outline-none"
              >
                <td className="px-3 py-3" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.includes(order.id)}
                    onChange={() => setSelected((current) => (current.includes(order.id) ? current.filter((id) => id !== order.id) : [...current, order.id]))}
                    aria-label={`IMB-${order.number}`}
                    className="size-4 accent-foreground"
                  />
                </td>
                <td className="px-3 py-3 font-medium tabular-nums">
                  <Link href={`/admin/orders/${order.id}`} className="hover:underline" onClick={(event) => event.stopPropagation()}>
                    IMB-{order.number}
                  </Link>
                </td>
                <td className="px-3 py-3 tabular-nums text-muted-foreground">{order.placedAt ? day.format(new Date(order.placedAt)) : ""}</td>
                <td className="overflow-hidden px-3 py-3">
                  <span className="block truncate">{order.customer}</span>
                  <span className="block truncate text-xs text-muted-foreground">{[order.city, itemLabel(t, order)].filter(Boolean).join(" · ")}</span>
                </td>
                <td className="px-3 py-3">
                  <Pill>{known(PAYMENTS, order.paymentStatus) ? t(`pay.${order.paymentStatus}`) : order.paymentStatus}</Pill>
                </td>
                <td className="px-3 py-3">
                  <Pill>{known(STATUSES, order.status) ? t(`status.${order.status}`) : order.status}</Pill>
                </td>
                <td className="px-3 py-3 font-medium tabular-nums">{money(order.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-muted-foreground">
        <span className="tabular-nums">{t("page", { from: rangeStart, to: rangeEnd, count: visible.length })}</span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="rounded-full" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
            {t("prev")}
          </Button>
          <Button type="button" variant="outline" className="rounded-full" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)}>
            {t("next")}
          </Button>
        </div>
      </div>
    </section>
  );
}

function SortHead({
  label,
  active,
  dir,
  onClick,
  className = "",
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  className?: string;
}) {
  const Icon = dir === "asc" ? ChevronUp : ChevronDown;
  return (
    <th className={`px-3 py-3 text-start font-medium ${className}`} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1 rounded-md hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        {label}
        {active ? <Icon className="size-3.5" /> : null}
      </button>
    </th>
  );
}

function Pill({ children }: { children: string }) {
  return <span className="inline-flex max-w-full whitespace-normal rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{children}</span>;
}

function itemLabel(t: (key: string, values?: Record<string, string | number>) => string, order: OrderDetail) {
  if (order.items.length === 1) return t("itemOne", { name: order.items[0].nameEn, qty: order.items[0].qty });
  const count = order.items.reduce((sum, item) => sum + item.qty, 0);
  return t("itemMany", { count });
}

function known<T extends string>(list: readonly T[], value: string): value is T {
  return (list as readonly string[]).includes(value);
}

function orderDay(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function dubaiToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return { year, month, key: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
}

function isoDay(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
}

function shiftDay(key: string, days: number) {
  const [year, month, day] = key.split("-").map(Number);
  return isoDay(year, month - 1, day + days);
}

function monthBounds(year: number, month: number) {
  return { from: isoDay(year, month - 1, 1), to: isoDay(year, month, 0) };
}

function presetRange(preset: Exclude<Preset, "all" | "range">) {
  const today = dubaiToday();
  if (preset === "today") return { from: today.key, to: today.key };
  if (preset === "yesterday") {
    const key = shiftDay(today.key, -1);
    return { from: key, to: key };
  }
  if (preset === "days7") return { from: shiftDay(today.key, -6), to: today.key };
  if (preset === "days30") return { from: shiftDay(today.key, -29), to: today.key };
  if (preset === "thisMonth") return monthBounds(today.year, today.month);
  const previous = today.month === 1 ? { year: today.year - 1, month: 12 } : { year: today.year, month: today.month - 1 };
  return monthBounds(previous.year, previous.month);
}

function matchingPreset(from: string, to: string): Preset {
  if (!from && !to) return "all";
  for (const preset of PRESETS) {
    if (preset === "all") continue;
    const range = presetRange(preset);
    if (range.from === from && range.to === to) return preset;
  }
  return "range";
}

function monthValue(from: string, to: string) {
  if (!from || from.slice(0, 7) !== to.slice(0, 7)) return "";
  const [year, month] = from.split("-").map(Number);
  const bounds = monthBounds(year, month);
  return bounds.from === from && bounds.to === to ? from.slice(0, 7) : "";
}
