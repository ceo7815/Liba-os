"use client";

import { Calculator } from "lucide-react";
import { SHEMESH_FORMULAS } from "@/lib/shemesh/formulas";
import { ShemeshPage } from "@/components/shemesh/widgets";

export function ShemeshFormulas() {
  return (
    <ShemeshPage
      title="נוסחאות שמש"
      description="הכללים רשומים כאן ולא רצים בדוחות. הלוח והרווח מציגים את הסכומים שנרשמו בקובץ ובפרסום."
      icon={Calculator}
      stats={
        <div className="rounded-2xl border border-border bg-background/80 px-4 py-3 text-center">
          <p className="text-2xl font-semibold tabular-nums leading-none">{SHEMESH_FORMULAS.length}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">ממתינות</p>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {SHEMESH_FORMULAS.map((formula) => (
          <article key={formula.id} className="app-surface px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold">{formula.title}</h2>
              <span className="rounded-full bg-highlight/40 px-2 py-0.5 text-[11px] font-medium">
                ממתין לאישור
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{formula.note}</p>
          </article>
        ))}
      </div>
    </ShemeshPage>
  );
}
