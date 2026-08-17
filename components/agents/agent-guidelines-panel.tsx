"use client";

import { Download, FileText } from "lucide-react";
import {
  CALL_QA_CHECKLIST_CATALOG,
  CHECKLIST_STATUS_LABELS,
  FINDING_SEVERITY_LABELS,
  SCORE_WEIGHTS,
} from "@/lib/agents/call-qa-checklist";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SCORE_ROWS = [
  {
    label: "עמידה בתהליך וברגולציה",
    max: SCORE_WEIGHTS.compliance,
  },
  {
    label: "מקצועיות והתאמת צרכים",
    max: SCORE_WEIGHTS.professionalism,
  },
  {
    label: "איכות שיחה, שירות ומכירה",
    max: SCORE_WEIGHTS.service_quality,
  },
] as const;

export function AgentGuidelinesPanel() {
  const itemCount = CALL_QA_CHECKLIST_CATALOG.reduce(
    (sum, section) => sum + section.items.length,
    0,
  );

  return (
    <div className="space-y-4">
      <div className="app-surface p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex size-8 items-center justify-center rounded-xl bg-highlight/35">
                <FileText className="size-4" />
              </span>
              <h3 className="text-sm font-semibold">קובץ הנחיות לסוכן</h3>
            </div>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              צ׳ק־ליסט בקרת שיחות ביטוח — הסעיפים והקריטריונים שלפיהם סוכן בקרת
              השיחות מנתח כל שיחה ומפיק ציון, ממצאים והמלצות.
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {CALL_QA_CHECKLIST_CATALOG.length} קטגוריות · {itemCount} סעיפי
              בדיקה · ציון כולל עד {SCORE_WEIGHTS.total}
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="rounded-xl shrink-0">
            <a
              href="/docs/call-qa-checklist.pdf"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Download className="size-3.5" />
              הורדת קובץ PDF
            </a>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="app-surface p-5">
          <h4 className="text-xs font-semibold text-muted-foreground">
            משקלות ציון
          </h4>
          <ul className="mt-3 space-y-2">
            {SCORE_ROWS.map((row) => (
              <li
                key={row.label}
                className="flex items-center justify-between gap-3 rounded-xl bg-background px-3 py-2.5 text-sm"
              >
                <span>{row.label}</span>
                <span className="shrink-0 font-semibold tabular-nums">
                  עד {row.max}
                </span>
              </li>
            ))}
            <li className="flex items-center justify-between gap-3 rounded-xl bg-highlight/30 px-3 py-2.5 text-sm font-semibold">
              <span>ציון כולל</span>
              <span className="tabular-nums">/{SCORE_WEIGHTS.total}</span>
            </li>
          </ul>
        </section>

        <section className="app-surface p-5">
          <h4 className="text-xs font-semibold text-muted-foreground">
            סטטוסי בדיקה וחומרה
          </h4>
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap gap-2">
              {Object.entries(CHECKLIST_STATUS_LABELS).map(([key, label]) => (
                <span
                  key={key}
                  className={cn(
                    "rounded-md px-2 py-1 text-[11px] font-medium",
                    key === "done"
                      ? "bg-highlight/35"
                      : key === "partial"
                        ? "bg-amber-100 text-amber-950"
                        : key === "not_done"
                          ? "bg-red-100 text-red-900"
                          : "bg-background text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(FINDING_SEVERITY_LABELS).map(([key, label]) => (
                <span
                  key={key}
                  className={cn(
                    "rounded-md px-2 py-1 text-[11px] font-medium",
                    key === "critical"
                      ? "bg-red-100 text-red-900"
                      : key === "material"
                        ? "bg-amber-100 text-amber-950"
                        : "bg-background text-muted-foreground",
                  )}
                >
                  חומרה: {label}
                </span>
              ))}
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              «לא רלוונטי» לא נכנס למכנה הציון. «לא ניתן לאימות» מוצג בדוח ואינו
              נחשב כשל אוטומטי.
            </p>
          </div>
        </section>
      </div>

      <section className="space-y-3">
        <div className="px-1">
          <h4 className="text-sm font-semibold">צ׳ק־ליסט מלא לפי קטגוריות</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            כל סעיף נבדק בשיחה ומתועד בדוח התוצאות של הסוכן.
          </p>
        </div>

        <div className="grid gap-3">
          {CALL_QA_CHECKLIST_CATALOG.map((section) => (
            <details
              key={section.id}
              className="group app-surface overflow-hidden open:shadow-sm"
            >
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 marker:content-none [&::-webkit-details-marker]:hidden">
                <span
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-background text-xs font-semibold tabular-nums text-foreground"
                  aria-hidden
                >
                  {section.id}
                </span>
                <span className="min-w-0 flex-1 text-sm font-semibold leading-snug">
                  {section.title}
                </span>
                <span className="shrink-0 rounded-md bg-background px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                  {section.items.length} סעיפים
                </span>
              </summary>
              <ul className="divide-y divide-black/[0.05] border-t border-black/[0.06]">
                {section.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-3 px-4 py-2.5 text-sm"
                  >
                    <span
                      className="mt-0.5 inline-flex min-w-[2.75rem] shrink-0 justify-center rounded-lg bg-background px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground"
                      dir="ltr"
                    >
                      {item.id}
                    </span>
                    <span className="min-w-0 flex-1 leading-relaxed">
                      {item.title}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
