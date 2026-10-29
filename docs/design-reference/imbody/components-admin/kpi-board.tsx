"use client";

import { useEffect, useId, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { CountUp } from "@/components/admin/count-up";
import { TrendChart } from "@/components/admin/trend-chart";

const ranges = [7, 14, 30, 90] as const;
type Range = (typeof ranges)[number];
const aed = new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 });
const spring = { type: "spring" as const, stiffness: 420, damping: 34, mass: 0.7 };

export type KpiModel = {
  id: string;
  label: string;
  href: string;
  headline: number;
  money: boolean;
  ink: string;
  points: { day: string; value: number }[];
  breakdown: { label: string; value: number }[];
  top: { name: string; detail: string; href: string }[];
};

function formatAmount(value: number, money: boolean) {
  return money ? aed.format(Math.round(value)) : String(Math.round(value));
}

function windowSum(points: { value: number }[], range: number, offset: number) {
  const end = points.length - offset;
  const start = Math.max(0, end - range);
  return points.slice(start, end).reduce((sum, point) => sum + point.value, 0);
}

function delta(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 100);
}

function spark(values: number[]) {
  const width = 120;
  const height = 36;
  const peak = Math.max(...values, 1);
  const points = values.map((value, index) => ({
    x: values.length > 1 ? (index / (values.length - 1)) * width : width / 2,
    y: height - 8 - (value / peak) * (height - 14),
  }));
  let d = `M ${points[0]?.x ?? 0} ${points[0]?.y ?? height}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] ?? p2;
    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`;
  }
  return { d, area: `${d} L ${width} ${height} L 0 ${height} Z`, width, height };
}

export function KpiBoard({ cards }: { cards: KpiModel[] }) {
  const t = useTranslations();
  const titleId = useId();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState<{ card: KpiModel; rect: DOMRect } | null>(null);
  const [range, setRange] = useState<Range>(14);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const card = open?.card;
  const now = card ? windowSum(card.points, range, 0) : 0;
  const before = card ? windowSum(card.points, range, range) : 0;
  const change = delta(now, before);
  const up = change >= 0;
  const series = card
    ? card.points.slice(-range).map((point) => ({ label: point.day.slice(5), sales: point.value }))
    : [];
  const peak = card ? Math.max(...card.breakdown.map((row) => row.value), 1) : 1;
  const targetWidth = typeof window === "undefined" ? 640 : Math.min(640, window.innerWidth - 32);
  const targetHeight = typeof window === "undefined" ? 560 : Math.min(620, window.innerHeight - 32);

  return (
    <>
      <section className="enter enter-1 grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label={t("dashboard.kpis")}>
        {cards.map((item, index) => {
          const line = spark(item.points.slice(-14).map((point) => point.value));
          const week = windowSum(item.points, 7, 0);
          const prior = windowSum(item.points, 7, 7);
          const shift = delta(week, prior);
          const rising = shift >= 0;
          return (
            <button
              key={item.id}
              type="button"
              className="work-sheet lift press min-w-0 px-3 py-3 text-start sm:px-4"
              style={{ animationDelay: `${index * 50}ms` }}
              aria-haspopup="dialog"
              onClick={(event) => {
                setRange(14);
                setOpen({ card: item, rect: event.currentTarget.getBoundingClientRect() });
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <span dir="ltr" className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${rising ? "bg-[#e7f0eb] text-[#1d4333]" : "bg-[#fde8e6] text-[#9f2d2d]"}`}>
                  {rising ? "▲" : "▼"} {Math.abs(shift)}%
                </span>
              </div>
              <p className="console-title kpi-num mt-2 text-start text-[clamp(1.35rem,3.4vw,2rem)] leading-none">
                <CountUp value={item.headline} text={(value) => formatAmount(value, item.money)} />
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">{t("dashboard.vsLast")}</p>
              <svg viewBox={`0 0 ${line.width} ${line.height}`} className="spark mt-2 h-9 w-full" style={{ "--spark": item.ink } as CSSProperties} aria-hidden>
                <path d={line.area} className="spark-area" />
                <path className="spark-draw" pathLength={1} d={line.d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              </svg>
            </button>
          );
        })}
      </section>
      <AnimatePresence>
        {open && card ? (
          <motion.div
            className="kpi-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.18 }}
            onClick={() => setOpen(null)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              autoFocus
              tabIndex={-1}
              className="work-sheet overflow-auto p-4 shadow-[0_24px_64px_rgb(28_28_27_/_16%)] sm:p-5"
              initial={
                reduce
                  ? false
                  : mobile
                    ? { y: 28, opacity: 0 }
                    : {
                        left: open.rect.left,
                        top: open.rect.top,
                        width: open.rect.width,
                        height: open.rect.height,
                        borderRadius: 16,
                      }
              }
              animate={
                mobile
                  ? { y: 0, opacity: 1 }
                  : {
                      left: (window.innerWidth - targetWidth) / 2,
                      top: Math.max(16, (window.innerHeight - targetHeight) / 2),
                      width: targetWidth,
                      height: targetHeight,
                      borderRadius: 20,
                    }
              }
              exit={reduce ? undefined : mobile ? { y: 20, opacity: 0 } : { opacity: 0, scale: 0.98 }}
              transition={reduce ? { duration: 0 } : spring}
              onClick={(event) => event.stopPropagation()}
              style={
                mobile
                  ? { position: "fixed", left: 12, right: 12, bottom: 12, zIndex: 60, maxHeight: "88dvh" }
                  : { position: "fixed", zIndex: 60 }
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id={titleId} className="text-sm font-semibold">{card.label}</h2>
                  <p className="console-title mt-2 text-3xl leading-none">
                    <CountUp value={card.headline} text={(value) => formatAmount(value, card.money)} />
                  </p>
                </div>
                <button type="button" className="press nudge grid size-9 place-items-center rounded-full hover:bg-[#f4f4f2]" aria-label={t("dashboard.close")} onClick={() => setOpen(null)}>
                  <X className="size-4" />
                </button>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="kpi-range" dir="ltr" role="group" aria-label={t("dashboard.rangeDays", { count: range })}>
                  {ranges.map((item) => (
                    <button key={item} type="button" aria-pressed={item === range} aria-label={t("dashboard.rangeDays", { count: item })} onClick={() => setRange(item)}>
                      {item}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  <span dir="ltr" className={`me-2 rounded-full px-2 py-0.5 font-semibold ${up ? "bg-[#e7f0eb] text-[#1d4333]" : "bg-[#fde8e6] text-[#9f2d2d]"}`}>
                    {up ? "▲" : "▼"} {Math.abs(change)}%
                  </span>
                  {t("dashboard.compare")}
                </p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <p className="rounded-xl bg-[#f7f6f3] px-3 py-2">
                  <span className="block text-[11px] text-muted-foreground">{t("dashboard.rangeDays", { count: range })}</span>
                  <span dir="ltr" className="font-semibold tabular-nums">{formatAmount(now, card.money)}</span>
                </p>
                <p className="rounded-xl bg-[#f7f6f3] px-3 py-2">
                  <span className="block text-[11px] text-muted-foreground">{t("dashboard.previous")}</span>
                  <span dir="ltr" className="font-semibold tabular-nums">{formatAmount(before, card.money)}</span>
                </p>
              </div>
              <div className="mt-3">
                <TrendChart data={series} salesLabel={card.label} height={mobile ? 180 : 220} />
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground">{t("dashboard.breakdown")}</h3>
                  <ul className="mt-2 grid gap-2">
                    {card.breakdown.length === 0 ? <li className="text-sm text-muted-foreground">{t("dashboard.emptyDetail")}</li> : null}
                    {card.breakdown.map((row) => (
                      <li key={row.label}>
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate">{row.label}</span>
                          <span dir="ltr" className="tabular-nums text-muted-foreground">{formatAmount(row.value, card.money)}</span>
                        </div>
                        <div className="meter mt-1 h-1.5 overflow-hidden rounded-full">
                          <div className="meter-fill h-full rounded-full" style={{ width: `${row.value === 0 ? 0 : Math.max(6, (row.value / peak) * 100)}%`, "--bar": card.ink } as CSSProperties} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground">{t("dashboard.top")}</h3>
                  <ul className="mt-2 grid gap-1">
                    {card.top.length === 0 ? <li className="text-sm text-muted-foreground">{t("dashboard.emptyDetail")}</li> : null}
                    {card.top.map((row) => (
                      <li key={row.href + row.name}>
                        <Link href={row.href} className="row-link flex items-center justify-between gap-3 rounded-xl px-2 py-2" onClick={() => setOpen(null)}>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{row.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">{row.detail}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <Link href={card.href} className="press mt-4 inline-flex h-10 items-center rounded-full bg-primary px-4 text-sm text-primary-foreground" onClick={() => setOpen(null)}>
                {t("dashboard.openFull")}
              </Link>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
