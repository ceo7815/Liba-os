"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { MenuField } from "@/components/admin/menu-field";
import { DateField } from "@/components/admin/date-field";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type DeskRecord = {
  id: string;
  title: string;
  detail?: string;
  facet?: string;
  date?: string;
  href?: string;
  fields: { label: string; value: string }[];
};

export type DeskCube = {
  id: string;
  label: string;
  value: string;
  note?: string;
  series?: number[];
  records: DeskRecord[];
};

export function RecordDesk({
  title,
  lede,
  cubes,
  action,
  heading = "h1",
  appearance = "grid",
  header = true,
}: {
  title: string;
  lede?: string;
  cubes: DeskCube[];
  action?: ReactNode;
  heading?: "h1" | "h2";
  appearance?: "grid" | "board";
  header?: boolean;
}) {
  const t = useTranslations("dashboard");
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [facet, setFacet] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const cube = cubes.find((item) => item.id === openId) ?? null;
  const facets = useMemo(() => {
    const names = new Set<string>();
    for (const record of cube?.records ?? []) {
      if (record.facet) names.add(record.facet);
    }
    return [...names];
  }, [cube]);
  const dated = (cube?.records ?? []).some((record) => Boolean(record.date));
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (cube?.records ?? []).filter((record) => {
      if (facet !== "all" && record.facet !== facet) return false;
      if (from || to) {
        if (!record.date) return false;
        const day = record.date.slice(0, 10);
        if (from && day < from) return false;
        if (to && day > to) return false;
      }
      if (!needle) return true;
      const haystack = [record.title, record.detail, record.facet, ...record.fields.flatMap((field) => [field.label, field.value])]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [cube, facet, from, query, to]);

  function openCube(id: string) {
    setOpenId(id);
    setQuery("");
    setFacet("all");
    setFrom("");
    setTo("");
  }

  return (
    <section className="flex flex-col gap-5">
      {header ? (
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            {heading === "h1" ? (
              <h1 className={appearance === "board" ? "console-title text-4xl" : "console-title text-3xl"}>{title}</h1>
            ) : (
              <h2 className="console-title text-xl">{title}</h2>
            )}
            {lede ? <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{lede}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className={appearance === "board" ? "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" : "grid grid-cols-2 gap-3 sm:grid-cols-4"}>
        {cubes.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => openCube(item.id)}
            style={{ "--i": index } as CSSProperties}
            className="press lift metric-card work-sheet px-4 py-4 text-start"
          >
            <span className="block text-sm text-muted-foreground">{item.label}</span>
            <span className="console-title mt-3 block text-3xl tabular-nums">{item.value}</span>
            {item.series ? <Spark values={item.series} index={index} /> : null}
            {item.note ? <span className="mt-2 block text-sm text-muted-foreground">{item.note}</span> : null}
          </button>
        ))}
      </div>
      <Dialog open={cube !== null} onOpenChange={(next) => { if (!next) setOpenId(null); }}>
        <DialogContent className="flex max-h-[min(42rem,calc(100%-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="px-6 pt-6 pe-14">
            <DialogTitle className="console-title text-2xl">{cube?.label}</DialogTitle>
            <DialogDescription className="text-base tabular-nums">{cube?.value}</DialogDescription>
          </DialogHeader>
          <div className={`grid gap-3 px-6 py-4 ${dated ? "sm:grid-cols-[minmax(0,1fr)_9.5rem_8.5rem_8.5rem]" : "sm:grid-cols-[minmax(0,1fr)_12rem]"}`}>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("deskSearch")}
              aria-label={t("deskSearch")}
              className="h-11 rounded-full border border-black/10 bg-background px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <MenuField
              ariaLabel={t("deskFilter")}
              value={facet}
              onChange={setFacet}
              options={[{ value: "all", label: t("deskAll") }, ...facets.map((name) => ({ value: name, label: name }))]}
            />
            {dated ? (
              <>
                <div className="w-44">
                  <DateField ariaLabel={t("deskFrom")} value={from} onChange={setFrom} />
                </div>
                <div className="w-44">
                  <DateField ariaLabel={t("deskTo")} value={to} onChange={setTo} />
                </div>
              </>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto border-t border-black/10">
            {rows.length === 0 ? <p className="px-6 py-8 text-sm text-muted-foreground">{t("deskEmpty")}</p> : null}
            <ul>
              {rows.map((record) => (
                <li key={record.id} className="border-b border-black/10 px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium">{record.title}</p>
                      {record.detail ? <p className="mt-1 text-sm text-muted-foreground">{record.detail}</p> : null}
                    </div>
                    {record.href ? (
                      <a href={record.href} className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">
                        {t("deskEdit")}
                      </a>
                    ) : null}
                  </div>
                  <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                    {record.fields.map((field) => (
                      <div key={`${record.id}-${field.label}`}>
                        <dt className="text-xs text-muted-foreground">{field.label}</dt>
                        <dd className="mt-1 text-sm">{field.value}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Spark({ values, index }: { values: number[]; index: number }) {
  const width = 160;
  const height = 46;
  const peak = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const points = values.map((value, point) => {
    const x = point * step;
    const y = height - 4 - (value / peak) * (height - 10);
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  const line = `M${points.join(" L")}`;
  const area = `${line} L${width} ${height} L0 ${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-4 h-12 w-full text-foreground" aria-hidden style={{ "--i": index } as CSSProperties}>
      <path d={area} fill="currentColor" opacity="0.08" />
      <path d={line} pathLength={1} fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" className="spark-line" />
    </svg>
  );
}
