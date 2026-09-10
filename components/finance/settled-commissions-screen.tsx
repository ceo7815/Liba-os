"use client";

import Link from "next/link";
import { CircleDashed, FileSpreadsheet, HelpCircle, Receipt } from "lucide-react";
import {
  SETTLED_FORMULA_PREVIEW,
  SETTLED_KPI_PLACEHOLDERS,
  SETTLED_PENDING,
  SETTLED_SCREEN,
  SETTLED_TEMPLATE_COLUMNS,
} from "@/lib/finance/settled-commissions-data";

export function SettledCommissionsScreen() {
  return (
    <section className="mx-auto max-w-[80rem] space-y-5" dir="rtl">
      <header className="app-surface px-5 py-5 sm:px-7 sm:py-6">
        <p className="text-xs font-medium text-muted-foreground">חשבונות ליבה</p>
        <div className="mt-1 flex flex-wrap items-center gap-2.5">
          <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-900">
            <Receipt className="size-5" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">{SETTLED_SCREEN.title}</h1>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-950">
            {SETTLED_SCREEN.status}
          </span>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {SETTLED_SCREEN.subtitle}
        </p>
        <p className="mt-3 max-w-3xl rounded-xl border border-amber-200/70 bg-amber-50/50 px-3 py-2.5 text-sm text-amber-950">
          {SETTLED_SCREEN.statusNote}
        </p>
      </header>

      <section className="app-surface px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="size-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">מקור הנתונים</h2>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {SETTLED_SCREEN.notFromManagersExcel}
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-black/[0.06] bg-background/60 px-4 py-3">
            <dt className="text-xs font-semibold text-muted-foreground">דוח נפרעים</dt>
            <dd className="mt-1 text-sm font-medium">טרם הוגדר — ממתין לקובץ</dd>
          </div>
          <div className="rounded-xl border border-black/[0.06] bg-background/60 px-4 py-3">
            <dt className="text-xs font-semibold text-muted-foreground">עובד אחראי</dt>
            <dd className="mt-1 text-sm font-medium">טרם שויך</dd>
          </div>
          <div className="rounded-xl border border-black/[0.06] bg-background/60 px-4 py-3 sm:col-span-2">
            <dt className="text-xs font-semibold text-muted-foreground">שיעורי עמלה</dt>
            <dd className="mt-1 text-sm">
              <Link
                href={SETTLED_SCREEN.agreementsHref}
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                {SETTLED_SCREEN.agreementsLabel}
              </Link>
            </dd>
          </div>
        </dl>
      </section>

      <section className="app-surface px-5 py-5 sm:px-7 sm:py-6">
        <h2 className="text-lg font-semibold">סיכום חודשי</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          יוצג אחרי ייבוא — כרגע מקום שמור לתבנית.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SETTLED_KPI_PLACEHOLDERS.map((kpi) => (
            <div
              key={kpi.id}
              className="rounded-2xl border border-black/[0.06] bg-background/60 px-4 py-4 text-center"
            >
              <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-muted-foreground/50">
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="app-surface px-5 py-5 sm:px-7 sm:py-6">
        <h2 className="text-lg font-semibold">תבנית עמודות — דוח נפרעים</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          אלה השדות שנצפה למצוא בדוח. כשיגיע הקובץ — נתאים שמות ונסמן חובה/רשות.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-black/[0.08] text-muted-foreground">
                <th className="pb-2 pe-3 text-right font-medium">שדה צפוי</th>
                <th className="pb-2 pe-3 text-right font-medium">תפקיד</th>
                <th className="pb-2 text-right font-medium">חובה</th>
              </tr>
            </thead>
            <tbody>
              {SETTLED_TEMPLATE_COLUMNS.map((col) => (
                <tr key={col.id} className="border-b border-black/[0.04] align-top">
                  <td className="py-2.5 pe-3 font-medium">{col.label}</td>
                  <td className="py-2.5 pe-3 text-muted-foreground">{col.role}</td>
                  <td className="py-2.5">
                    {col.required ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-900">
                        חובה
                      </span>
                    ) : (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
                        רשות
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="app-surface px-5 py-5 sm:px-7 sm:py-6">
        <h2 className="text-lg font-semibold">שורות נפרעים</h2>
        <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-black/[0.12] bg-black/[0.02] px-6 py-14 text-center">
          <CircleDashed className="size-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium">אין נתונים עדיין</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            כאן תופיע טבלת השורות אחרי ייבוא דוח הנפרעים. בלי קובץ — אין מה למשוך.
          </p>
        </div>
      </section>

      <section className="app-surface px-5 py-5 sm:px-7 sm:py-6">
        <h2 className="text-lg font-semibold">{SETTLED_FORMULA_PREVIEW.title}</h2>
        <p className="mt-3 rounded-xl bg-emerald-50/60 px-4 py-3 font-mono text-sm text-emerald-950">
          {SETTLED_FORMULA_PREVIEW.formula}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{SETTLED_FORMULA_PREVIEW.note}</p>
      </section>

      <section className="app-surface px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex items-center gap-2">
          <HelpCircle className="size-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">לפני חיבור — מה חסר</h2>
        </div>
        <ol className="mt-4 space-y-3">
          {SETTLED_PENDING.map((item, idx) => (
            <li
              key={item.id}
              className="flex gap-3 rounded-xl border border-black/[0.06] bg-background/60 px-4 py-3"
            >
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold tabular-nums">
                {idx + 1}
              </span>
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{item.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}
