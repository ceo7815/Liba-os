"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatIls } from "@/lib/sales-dashboard/campaign-math";
import {
  cellTone,
  formatWorkbookDateDisplay,
  isDateHeader,
  isIdHeader,
  isNotesHeader,
  isPhoneHeader,
  isPolicyHeader,
  parsePremiumCell,
  premiumColumnIndex,
  type CellTone,
  type WorkbookRow,
  type WorkbookSheet,
} from "@/lib/sales-dashboard/workbook-grid";

const PILL: Record<CellTone, string> = {
  none: "",
  active: "bg-emerald-50 text-emerald-800",
  cancelled: "bg-rose-50 text-rose-800",
  pending: "bg-amber-50 text-amber-900",
  sale: "bg-sky-50 text-sky-900",
  settled: "bg-violet-50 text-violet-800",
};

function copyValue(label: string, value: string) {
  if (!value) return;
  void navigator.clipboard.writeText(value).then(
    () => toast.success(`${label} הועתק`),
    () => toast.error("לא הצלחנו להעתיק"),
  );
}

function displayValue(header: string, raw: string): string {
  if (!raw) return "";
  return isDateHeader(header) ? formatWorkbookDateDisplay(raw) : raw;
}

export function SalesExcelInspector({
  sheet,
  row,
  onClose,
}: {
  sheet: WorkbookSheet;
  row: WorkbookRow | null;
  onClose: () => void;
}) {
  const premiumCol = premiumColumnIndex(sheet.headers);
  const premium = row && premiumCol >= 0 ? parsePremiumCell(row.cells[premiumCol] ?? "") : 0;
  const client = sheet.headers.findIndex((header) => header.includes("לקוח") && !header.includes("ת.ז"));
  const agent = sheet.headers.findIndex((header) => header.includes("משווק"));
  const status = sheet.headers.findIndex((header) => header.includes("סטטוס") || header.includes("סטאטוס"));
  const process = sheet.headers.findIndex((header) => header.includes("תהליך"));
  const title = row ? (client >= 0 ? row.cells[client] : "") || `שורה ${row.excelRow}` : "";
  const agentName = row && agent >= 0 ? row.cells[agent] : "";
  const statusValue = row && status >= 0 ? displayValue(sheet.headers[status] ?? "", row.cells[status] ?? "") : "";
  const processValue = row && process >= 0 ? displayValue(sheet.headers[process] ?? "", row.cells[process] ?? "") : "";

  return (
    <Dialog open={Boolean(row)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0 sm:max-w-3xl">
        {row ? (
          <>
            <header className="border-b border-black/[0.06] px-5 pb-4 pt-5 pe-14 text-start">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <DialogTitle className="text-lg">{title}</DialogTitle>
                <p className="text-[12px] tabular-nums text-muted-foreground">שורה {row.excelRow.toLocaleString("he-IL")}</p>
              </div>
              <DialogDescription className="mt-1 text-start">
                {agentName || "כל השדות מהשורה"}
              </DialogDescription>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {statusValue ? (
                  <span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-medium", PILL[cellTone(sheet.headers[status] ?? "", statusValue)] || "bg-[#f3f2ee]")}>
                    {statusValue}
                  </span>
                ) : null}
                {processValue ? (
                  <span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-medium", PILL[cellTone(sheet.headers[process] ?? "", processValue)] || "bg-[#f3f2ee]")}>
                    {processValue}
                  </span>
                ) : null}
                {premium > 0 ? (
                  <span className="rounded-full bg-highlight px-2.5 py-0.5 text-[12px] font-medium text-[#1a1a1a]">
                    פרמיה <span dir="ltr">{formatIls(Math.round(premium))}</span>
                  </span>
                ) : null}
              </div>
            </header>
            <div className="max-h-[min(68vh,40rem)] overflow-y-auto">
              <div className="grid md:grid-cols-2">
                {sheet.headers.map((header, col) => {
                  const raw = row.cells[col] ?? "";
                  const value = displayValue(header, raw);
                  if (!header && !value) return null;
                  const label = header || `עמודה ${col + 1}`;
                  const notes = isNotesHeader(header);
                  const tone = cellTone(header, value);
                  const money = header.includes("פרמיה");
                  const copyable = Boolean(value) && (isPhoneHeader(header) || isIdHeader(header) || isPolicyHeader(header));
                  return (
                    <div
                      key={`${row.id}-${col}`}
                      className={cn(
                        "grid grid-cols-[7.5rem_minmax(0,1fr)] items-start gap-3 border-b border-black/[0.05] px-5 py-2.5",
                        notes && "md:col-span-2 md:grid-cols-1 md:gap-1",
                      )}
                    >
                      <p className="pt-0.5 text-[12px] leading-5 text-muted-foreground">{label}</p>
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <p
                          dir={money && value ? "ltr" : undefined}
                          className={cn(
                            "min-w-0 text-sm font-medium leading-5 text-[#1c1c1a]",
                            notes && "whitespace-pre-wrap font-normal",
                            !value && "font-normal text-[#b0b0aa]",
                            money && value && "text-end",
                            tone === "active" && "text-emerald-800",
                            tone === "cancelled" && "text-rose-800",
                            tone === "pending" && "text-amber-900",
                            tone === "sale" && "text-sky-900",
                            tone === "settled" && "text-violet-800",
                          )}
                        >
                          {money && value ? formatIls(parsePremiumCell(value)) : value || "—"}
                        </p>
                        {copyable ? (
                          <button
                            type="button"
                            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-black/[0.04] hover:text-foreground"
                            onClick={() => copyValue(label, value)}
                            aria-label={`העתק ${label}`}
                          >
                            <Copy className="size-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
