"use client";

import { useMemo, useState } from "react";
import { ClipboardCheck, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { downloadEntryAuditExcel } from "@/lib/sales-dashboard/entry-audit-excel";
import { printEntryAudit } from "@/lib/sales-dashboard/entry-audit-print";
import {
  auditWorkbookEntry,
  entryGapMonths,
  filterEntryGaps,
  summarizeEntryGaps,
} from "@/lib/sales-dashboard/entry-audit";
import type { WorkbookSheet } from "@/lib/sales-dashboard/workbook-grid";
import { cn } from "@/lib/utils";

type RangeMode = "all" | "month" | "prev" | "year" | "custom";

function jerusalemToday(): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [year, month, day] = parts.split("-").map(Number);
  return { year, month, day };
}

function isoDay(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function utcDay(iso: string): number | null {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function presetBounds(mode: "month" | "prev" | "year"): { from: string; to: string; label: string } {
  const { year, month, day } = jerusalemToday();
  if (mode === "year") return { from: isoDay(year, 1, 1), to: isoDay(year, month, day), label: `שנת ${year}` };
  if (mode === "month") return { from: isoDay(year, month, 1), to: isoDay(year, month, day), label: "החודש" };
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const lastDay = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
  return { from: isoDay(prevYear, prevMonth, 1), to: isoDay(prevYear, prevMonth, lastDay), label: "חודש קודם" };
}

function displayDay(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return iso;
  return `${Number(match[3])}.${Number(match[2])}.${match[1].slice(2)}`;
}

function printedAtLabel(): string {
  const { year, month, day } = jerusalemToday();
  return `${day}.${month}.${year}`;
}

export function SalesEntryAudit({ sheets }: { sheets: WorkbookSheet[] }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<RangeMode>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [agent, setAgent] = useState<string | null>(null);
  const [fieldId, setFieldId] = useState<string | null>(null);
  const audit = useMemo(() => auditWorkbookEntry(sheets), [sheets]);
  const months = useMemo(() => entryGapMonths(audit.gaps), [audit.gaps]);

  const range = useMemo(() => {
    if (mode === "all") return { from: null as number | null, to: null as number | null, label: "כל התאריכים" };
    if (mode === "month" || mode === "prev" || mode === "year") {
      const bounds = presetBounds(mode);
      return { from: utcDay(bounds.from), to: utcDay(bounds.to), label: bounds.label };
    }
    const from = customFrom || "";
    const to = customTo || "";
    const label = from || to ? `${from ? displayDay(from) : "…"} עד ${to ? displayDay(to) : "…"}` : "טווח";
    return { from: from ? utcDay(from) : null, to: to ? utcDay(to) : null, label };
  }, [mode, customFrom, customTo]);

  const ranged = useMemo(() => filterEntryGaps(audit.gaps, range.from, range.to), [audit.gaps, range.from, range.to]);
  const byAgentName = (row: { agent: string }) => (row.agent || "בלי משווק") === agent;
  const hasField = (row: { missing: { id: string }[] }) => row.missing.some((field) => field.id === fieldId);
  const agentSummary = useMemo(
    () => summarizeEntryGaps(fieldId ? ranged.matched.filter(hasField) : ranged.matched),
    [ranged.matched, fieldId],
  );
  const forAgent = useMemo(
    () => (agent ? ranged.matched.filter(byAgentName) : ranged.matched),
    [ranged.matched, agent],
  );
  const fieldSummary = useMemo(() => summarizeEntryGaps(forAgent), [forAgent]);
  const rows = useMemo(() => {
    const list = fieldId ? forAgent.filter(hasField) : forAgent;
    return [...list].sort((a, b) => (b.transferAt ?? 0) - (a.transferAt ?? 0) || a.excelRow - b.excelRow);
  }, [forAgent, fieldId]);
  const severalSheets = new Set(rows.map((row) => row.sheet)).size > 1;
  const activeMonth = months.find((month) => month.from === customFrom && month.to === customTo && mode === "custom");

  function resetSlice() {
    setAgent(null);
    setFieldId(null);
  }

  function downloadPdf() {
    printEntryAudit({
      title: `בקרת הזנה — ${range.label}`,
      rangeLabel: range.label,
      printedAt: printedAtLabel(),
      rows,
      fields: summarizeEntryGaps(rows).byField,
    });
  }

  function downloadExcel() {
    void downloadEntryAuditExcel({ rangeLabel: range.label, rows });
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <ClipboardCheck className="size-4" />
        בקרת הזנה
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[11px] tabular-nums",
            audit.gaps.length > 0 ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800",
          )}
        >
          {audit.gaps.length.toLocaleString("he-IL")}
        </span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[min(92dvh,52rem)] w-[min(96vw,72rem)] max-w-none flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="space-y-1 border-b border-black/[0.06] px-5 py-4 pe-14 text-start">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <DialogTitle>בקרת הזנה</DialogTitle>
                <DialogDescription>
                  {rows.length === 0
                    ? "אין שורות להשלמה בטווח הזה."
                    : `${rows.length.toLocaleString("he-IL")} שורות להשלמה · ${range.label}. בדחייה, בוטלה וגניזה לא נספרים תחילת ביטוח ופרמיה.`}
                </DialogDescription>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button type="button" size="sm" variant="outline" disabled={rows.length === 0} onClick={downloadExcel}>
                  <Download className="size-4" />
                  אקסל
                </Button>
                <Button type="button" size="sm" disabled={rows.length === 0} onClick={downloadPdf}>
                  <Download className="size-4" />
                  PDF
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="sticky top-0 z-10 -mx-5 space-y-3 bg-background px-5 pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">תאריך</span>
                <div className="flex items-center gap-1 rounded-full bg-[#f6f5f1] p-1">
                  {(
                    [
                      ["all", "הכל"],
                      ["month", "החודש"],
                      ["prev", "חודש קודם"],
                      ["year", "השנה"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setMode(id);
                        resetSlice();
                      }}
                      className={cn(
                        "h-7 rounded-full px-2.5 text-xs",
                        mode === id ? "bg-highlight font-medium text-[#1a1a1a]" : "text-muted-foreground",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input
                  type="date"
                  value={mode === "custom" ? customFrom : ""}
                  onChange={(event) => {
                    setMode("custom");
                    setCustomFrom(event.target.value);
                    resetSlice();
                  }}
                  aria-label="מתאריך"
                  className="h-8 rounded-full border border-black/[0.08] bg-white px-3 text-[13px]"
                />
                <span className="text-xs text-muted-foreground">עד</span>
                <input
                  type="date"
                  value={mode === "custom" ? customTo : ""}
                  onChange={(event) => {
                    setMode("custom");
                    setCustomTo(event.target.value);
                    resetSlice();
                  }}
                  aria-label="עד תאריך"
                  className="h-8 rounded-full border border-black/[0.08] bg-white px-3 text-[13px]"
                />
              </div>
              {months.length > 0 ? (
                <div className="flex items-center gap-2">
                  <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">חודש</span>
                  <select
                    aria-label="חודש"
                    value={activeMonth?.key ?? ""}
                    onChange={(event) => {
                      const month = months.find((item) => item.key === event.target.value);
                      if (!month) return;
                      setMode("custom");
                      setCustomFrom(month.from);
                      setCustomTo(month.to);
                      resetSlice();
                    }}
                    className="h-8 max-w-xs rounded-full border border-black/[0.08] bg-white px-3 text-xs"
                  >
                    <option value="">בחרו חודש</option>
                    {months.map((month) => (
                      <option key={month.key} value={month.key}>
                        {month.label} · {month.count.toLocaleString("he-IL")}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {mode !== "all" && ranged.undated > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {ranged.undated.toLocaleString("he-IL")} שורות בלי תאריך העברה לא נכנסו לטווח. הן מופיעות ב«הכל».
                </p>
              ) : null}
              {agentSummary.byAgent.length > 0 ? (
                <div className="flex items-center gap-2">
                  <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">משווק</span>
                  <select
                    aria-label="משווק"
                    value={agent ?? ""}
                    onChange={(event) => setAgent(event.target.value || null)}
                    className="h-8 max-w-xs rounded-full border border-black/[0.08] bg-white px-3 text-xs"
                  >
                    <option value="">כל המשווקים · {(fieldId ? ranged.matched.filter(hasField).length : ranged.matched.length).toLocaleString("he-IL")}</option>
                    {agentSummary.byAgent.map((item) => (
                      <option key={item.agent} value={item.agent}>
                        {item.agent} · {item.count.toLocaleString("he-IL")}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {fieldSummary.byField.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">חסר</span>
                  <FilterChip active={fieldId == null} label="הכל" count={forAgent.length} onClick={() => setFieldId(null)} />
                  {fieldSummary.byField.map((field) => (
                    <FilterChip
                      key={field.id}
                      active={fieldId === field.id}
                      label={field.label}
                      count={field.count}
                      onClick={() => setFieldId(field.id)}
                    />
                  ))}
                </div>
              ) : null}
            </div>

            {audit.missingColumns.length > 0 ? (
              <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">
                עמודה שלא נמצאה בגיליון: {audit.missingColumns.map((item) => item.label).join(", ")}. השורות לא סומנו בגללה.
              </p>
            ) : null}

            {rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">אין שורות להשלמה בטווח הזה.</p>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-black/[0.06]">
                <table className="w-full min-w-[42rem] text-sm">
                  <thead className="bg-[#fafaf8]">
                    <tr className="border-b border-black/[0.06] text-[11px] text-muted-foreground">
                      <th className="px-3 py-2 text-start font-medium">לקוח</th>
                      <th className="w-32 px-3 py-2 text-start font-medium">משווק</th>
                      <th className="w-28 px-3 py-2 text-start font-medium">העברה</th>
                      <th className="w-28 px-3 py-2 text-start font-medium">חברה</th>
                      <th className="w-32 px-3 py-2 text-start font-medium">סטטוס</th>
                      <th className="px-3 py-2 text-start font-medium">להשלים</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={row.rowId} className={cn("border-b border-black/[0.04] last:border-0", index % 2 === 1 && "bg-[#fafaf8]")}>
                        <td className="px-3 py-2.5">
                          <div className="font-medium">{row.client || "בלי שם"}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {severalSheets ? `${row.sheet} · ` : ""}שורה {row.excelRow}
                          </div>
                        </td>
                        <td className="px-3 py-2">{row.agent || "—"}</td>
                        <td className="px-3 py-2 tabular-nums">{row.transfer || "—"}</td>
                        <td className="px-3 py-2">{row.company || "—"}</td>
                        <td className="px-3 py-2">{row.status || "—"}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {row.missing.map((field) => (
                              <span key={field.id} className="rounded-full bg-[#f6f5f1] px-2 py-0.5 text-[11px]">
                                {field.label}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FilterChip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs",
        active ? "bg-[#1a1a1a] font-medium text-white" : "bg-[#f6f5f1] text-muted-foreground",
      )}
    >
      {label}
      <span className="tabular-nums">{count.toLocaleString("he-IL")}</span>
    </button>
  );
}
