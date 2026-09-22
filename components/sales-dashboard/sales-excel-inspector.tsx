"use client";

import { Copy, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatIls } from "@/lib/sales-dashboard/campaign-math";
import {
  cellTone,
  isIdHeader,
  isNotesHeader,
  isPhoneHeader,
  isPolicyHeader,
  parsePremiumCell,
  premiumColumnIndex,
  type WorkbookRow,
  type WorkbookSheet,
} from "@/lib/sales-dashboard/workbook-grid";

function copyValue(label: string, value: string) {
  if (!value) return;
  void navigator.clipboard.writeText(value).then(
    () => toast.success(`${label} הועתק`),
    () => toast.error("לא הצלחנו להעתיק"),
  );
}

export function SalesExcelInspector({
  sheet,
  row,
  onClose,
}: {
  sheet: WorkbookSheet;
  row: WorkbookRow;
  onClose: () => void;
}) {
  const premiumCol = premiumColumnIndex(sheet.headers);
  const premium = premiumCol >= 0 ? parsePremiumCell(row.cells[premiumCol] ?? "") : 0;
  const client = sheet.headers.findIndex((h) => h.includes("לקוח") && !h.includes("ת.ז"));
  const agent = sheet.headers.findIndex((h) => h.includes("משווק"));
  const title = (client >= 0 ? row.cells[client] : "") || `שורה ${row.excelRow}`;
  const subtitle = agent >= 0 ? row.cells[agent] : "";

  return (
    <aside className="flex h-full min-h-0 w-[min(100%,22rem)] shrink-0 flex-col border-s border-black/[0.08] bg-white">
      <header className="flex items-start gap-3 border-b border-black/[0.08] px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-muted-foreground">שורה {row.excelRow}</p>
          <h2 className="truncate text-base font-semibold leading-tight">{title}</h2>
          {subtitle ? <p className="truncate text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="סגירה">
          <X className="size-4" />
        </Button>
      </header>
      {premium > 0 ? (
        <div className="border-b border-black/[0.08] bg-[#fffce8] px-4 py-2.5 text-sm font-medium">
          פרמיה {formatIls(Math.round(premium))}
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <dl className="space-y-3">
          {sheet.headers.map((header, col) => {
            const value = row.cells[col] ?? "";
            if (!header && !value) return null;
            const tone = cellTone(header, value);
            const copyable = isPhoneHeader(header) || isIdHeader(header) || isPolicyHeader(header);
            return (
              <div key={`${row.id}-${col}`}>
                <dt className="text-[11px] font-medium text-muted-foreground">{header || `עמודה ${col + 1}`}</dt>
                <dd
                  className={cn(
                    "mt-0.5 text-sm leading-snug",
                    isNotesHeader(header) && "whitespace-pre-wrap rounded-lg bg-muted/60 px-2.5 py-2",
                    tone === "active" && "font-medium text-emerald-800",
                    tone === "cancelled" && "font-medium text-rose-800",
                    tone === "pending" && "font-medium text-amber-800",
                  )}
                >
                  <span className="inline-flex max-w-full items-start gap-1.5">
                    <span className={cn(copyable && "text-[#1a73e8]")}>{value || "—"}</span>
                    {copyable && value ? (
                      <button
                        type="button"
                        className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={() => copyValue(header, value)}
                        aria-label={`העתק ${header}`}
                      >
                        <Copy className="size-3.5" />
                      </button>
                    ) : null}
                  </span>
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </aside>
  );
}
