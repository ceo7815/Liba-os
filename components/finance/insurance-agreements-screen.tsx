"use client";

import { useState } from "react";
import Link from "next/link";
import { Calculator, Download, ExternalLink, FileText, HelpCircle, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { COMMISSION_TYPE_LABELS, type CommissionSplitType } from "@/lib/finance/categories";
import { SOURCE_PNL_PATH } from "@/lib/finance/access";
import {
  DEFAULT_PNL_MULTIPLIER,
  INSURERS,
  MANAGERS_EXCEL_NAME,
  MIGDAL_CALC_RULES,
  MIGDAL_CONTRACT_DOCS,
  MIGDAL_EXCEL_GAPS,
  MIGDAL_EXCEL_COLUMNS,
  MIGDAL_INCOME_MODEL,
  MIGDAL_NOT_IN_EXCEL,
  MIGDAL_OPEN_QUESTIONS,
  MIGDAL_PAYMENT_INTRO,
  MIGDAL_PAYMENT_SECTIONS,
  MIGDAL_POLICY_TERM_SCALE,
  MIGDAL_PRODUCT_MAP,
  SOURCE_PNL_REPORT_NAME,
  type ContractDoc,
  type InsurerAgreement,
  type MigdalCalcRule,
  type MigdalOpenQuestion,
  type MigdalPaymentSection,
} from "@/lib/finance/insurance-agreements-data";

const PAYMENT_ACCENT: Record<
  CommissionSplitType,
  { border: string; bg: string; badge: string; num: string }
> = {
  settled: {
    border: "border-emerald-200/80",
    bg: "bg-emerald-50/40",
    badge: "bg-emerald-100 text-emerald-950",
    num: "bg-emerald-600 text-white",
  },
  volume: {
    border: "border-sky-200/80",
    bg: "bg-sky-50/40",
    badge: "bg-sky-100 text-sky-950",
    num: "bg-sky-600 text-white",
  },
  campaigns: {
    border: "border-violet-200/80",
    bg: "bg-violet-50/40",
    badge: "bg-violet-100 text-violet-950",
    num: "bg-violet-600 text-white",
  },
  accumulation: {
    border: "border-amber-200/80",
    bg: "bg-amber-50/40",
    badge: "bg-amber-100 text-amber-950",
    num: "bg-amber-600 text-white",
  },
};

const PHASE_LABELS = { א: "שלב א' — לפני חיבור PnL", ב: "שלב ב' — פנסיה / גמל / היקף", ג: "שלב ג' — כללי" } as const;

export function InsuranceAgreementsScreen() {
  const [activeId, setActiveId] = useState("migdal");
  const active = INSURERS.find((row) => row.id === activeId) ?? INSURERS[0];

  return (
    <section className="mx-auto max-w-[80rem] space-y-5" dir="rtl">
      <header className="app-surface px-5 py-5 sm:px-7 sm:py-6">
        <p className="text-xs font-medium text-muted-foreground">חשבונות ליבה</p>
        <div className="mt-1 flex items-center gap-2.5">
          <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-highlight/35">
            <Scale className="size-5" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">הסכמים חברות ביטוח</h1>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {MIGDAL_PAYMENT_INTRO} חיבור ל
          <Link href={SOURCE_PNL_PATH} className="mx-1 font-medium text-foreground underline-offset-2 hover:underline">
            {SOURCE_PNL_REPORT_NAME}
          </Link>
          — בתכנון.
        </p>
      </header>

      <div className="app-surface p-2 sm:p-3">
        <div className="flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="חברות ביטוח">
          {INSURERS.map((insurer) => (
            <button
              key={insurer.id}
              type="button"
              role="tab"
              aria-selected={activeId === insurer.id}
              disabled={insurer.status === "coming_soon"}
              onClick={() => setActiveId(insurer.id)}
              className={cn(
                "shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                activeId === insurer.id
                  ? "bg-foreground text-background"
                  : insurer.status === "coming_soon"
                    ? "cursor-not-allowed text-muted-foreground/50"
                    : "text-muted-foreground hover:bg-black/[0.04] hover:text-foreground",
              )}
            >
              {insurer.name}
              {insurer.status === "coming_soon" ? (
                <span className="mr-1.5 text-[10px] opacity-70">· בקרוב</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {active.status === "coming_soon" ? (
        <ComingSoonPanel insurer={active} />
      ) : active.id === "migdal" ? (
        <MigdalPanel insurer={active} />
      ) : (
        <ComingSoonPanel insurer={active} />
      )}
    </section>
  );
}

function MigdalPanel({ insurer }: { insurer: InsurerAgreement }) {
  const sections = [...MIGDAL_PAYMENT_SECTIONS].sort((a, b) => a.order - b.order);
  const rulesById = new Map(MIGDAL_CALC_RULES.map((r) => [r.id, r]));
  const openQuestions = MIGDAL_OPEN_QUESTIONS.filter((q) => q.status !== "answered");
  const answeredQuestions = MIGDAL_OPEN_QUESTIONS.filter((q) => q.status === "answered");
  const mandatoryCount = openQuestions.filter((q) => q.priority === "חובה").length;

  return (
    <div className="space-y-5">
      <ContractDocumentsPanel docs={MIGDAL_CONTRACT_DOCS} />

      <IncomeModelSection insurer={insurer} />

      <div className="flex flex-wrap gap-2 px-1">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#payment-${s.id}`}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80",
              PAYMENT_ACCENT[s.id].badge,
            )}
          >
            {s.order}. {s.label}
          </a>
        ))}
      </div>

      {sections.map((section) => (
        <PaymentSectionBlock
          key={section.id}
          section={section}
          rules={section.calcRuleIds.map((id) => rulesById.get(id)).filter(Boolean) as MigdalCalcRule[]}
        />
      ))}

      <section className="app-surface px-5 py-5 sm:px-7 sm:py-6">
        <h2 className="text-lg font-semibold">מיפוי מוצרים — לפי חוזה</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {MANAGERS_EXCEL_NAME} → שורה בחוזה · כל השיעורים מהנספחים (לא ×9).
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-black/[0.08] text-muted-foreground">
                <th className="pb-2 pe-2 text-right font-medium">בדוח</th>
                <th className="pb-2 pe-2 text-right font-medium">בחוזה</th>
                <th className="pb-2 pe-2 text-right font-medium">נפרעים (א׳)</th>
                <th className="pb-2 pe-2 text-right font-medium">היקף (יעד 1)</th>
                <th className="pb-2 text-right font-medium">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {MIGDAL_PRODUCT_MAP.map((row) => (
                <tr key={row.excelProduct} className="border-b border-black/[0.04] align-top">
                  <td className="py-2.5 pe-2 font-medium">{row.excelProduct}</td>
                  <td className="py-2.5 pe-2 text-muted-foreground">{row.contractRow}</td>
                  <td className="py-2.5 pe-2 tabular-nums font-medium text-emerald-900">{row.settledYearOne}</td>
                  <td className="py-2.5 pe-2 tabular-nums font-medium text-sky-900">{row.volumeTarget1}</td>
                  <td className="py-2.5">
                    <MapStatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 rounded-xl border border-amber-200/70 bg-amber-50/40 px-4 py-4">
          <p className="text-sm font-semibold text-amber-950">
            לא ניתן לזהות מהאקסל ({MIGDAL_NOT_IN_EXCEL.length})
          </p>
          <p className="mt-1 text-xs text-amber-900/80">
            שדות / נתונים שחסרים בדוח המנהלים — בלי מקור אחר או תשובת בעלים אי אפשר לחשב אוטומטית.
          </p>
          <ul className="mt-3 space-y-3">
            {MIGDAL_NOT_IN_EXCEL.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-amber-200/50 bg-white/80 px-3 py-2.5 text-sm"
              >
                <p className="font-medium">{item.title}</p>
                <p className="mt-1 text-muted-foreground">{item.why}</p>
                <p className="mt-1 text-xs text-amber-950/80">
                  נדרש ל: {item.neededFor}
                </p>
              </li>
            ))}
          </ul>
          {MIGDAL_EXCEL_GAPS.length ? (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs font-medium text-amber-900/70">
                פערים נוספים מול עמודות קיימות ({MIGDAL_EXCEL_GAPS.length})
              </summary>
              <ul className="mt-2 space-y-2">
                {MIGDAL_EXCEL_GAPS.map((gap) => (
                  <li
                    key={gap.id}
                    className="rounded-lg border border-amber-200/40 bg-white/60 px-3 py-2 text-xs"
                  >
                    <span className="font-medium">{gap.topic}</span>
                    {gap.excelColumn ? (
                      <span className="mx-1 text-muted-foreground">
                        · <ColumnBadge>{gap.excelColumn}</ColumnBadge>
                      </span>
                    ) : null}
                    <p className="mt-1 text-muted-foreground">{gap.needFromYou}</p>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      </section>

      <details className="app-surface group px-5 py-4 sm:px-7">
        <summary className="cursor-pointer text-sm font-semibold text-muted-foreground group-open:mb-4">
          עמודות הדוח ({MIGDAL_EXCEL_COLUMNS.length}) — לחץ להרחבה
        </summary>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-black/[0.08] text-muted-foreground">
                <th className="pb-2 pe-3 text-right font-medium">עמודה</th>
                <th className="pb-2 pe-3 text-right font-medium">תפקיד</th>
                <th className="pb-2 pe-3 text-right font-medium">בשימוש</th>
                <th className="pb-2 text-right font-medium">הערה</th>
              </tr>
            </thead>
            <tbody>
              {MIGDAL_EXCEL_COLUMNS.map((col) => (
                <tr key={col.key} className="border-b border-black/[0.04] align-top">
                  <td className="py-2 pe-3">
                    <ColumnBadge>{col.header}</ColumnBadge>
                  </td>
                  <td className="py-2 pe-3">{col.role}</td>
                  <td className="py-2 pe-3">
                    <UsageBadge used={col.usedToday} />
                  </td>
                  <td className="py-2 text-muted-foreground">{col.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <section id="open-questions" className="app-surface scroll-mt-24 px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-wrap items-center gap-2">
          <HelpCircle className="size-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">
            שיחה עם הבעלים — {openQuestions.length} שאלות פתוחות
          </h2>
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-900">
            {mandatoryCount} חובה
          </span>
          {answeredQuestions.length > 0 ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900">
              {answeredQuestions.length} נענו
            </span>
          ) : null}
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          עברו שאלה־שאלה מלמעלה למטה. לכל שאלה: למה שואלים, מה לבקש כתשובה, והאם זה בכלל
          באקסל. אחרי התשובות נחבר את הנוסחאות ל-{SOURCE_PNL_REPORT_NAME}.
        </p>

        {answeredQuestions.length > 0 ? (
          <div className="mt-6">
            <h3 className="text-base font-semibold text-emerald-900">כבר אושר — לא צריך לשאול שוב</h3>
            <ol className="mt-3 space-y-3">
              {answeredQuestions.map((q, idx) => (
                <OpenQuestionRow key={q.id} question={q} index={idx + 1} />
              ))}
            </ol>
          </div>
        ) : null}

        {(["א", "ב", "ג"] as const).map((phase) => {
          const items = openQuestions.filter((q) => q.phase === phase);
          if (!items.length) return null;
          return (
            <div key={phase} className="mt-8">
              <h3 className="text-base font-semibold">{PHASE_LABELS[phase]}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {items.length} שאלות · {items.filter((q) => q.priority === "חובה").length} חובה
              </p>
              <ol className="mt-4 space-y-4">
                {items.map((q, idx) => (
                  <OpenQuestionRow key={q.id} question={q} index={idx + 1} />
                ))}
              </ol>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function ContractDocumentsPanel({ docs }: { docs: ContractDoc[] }) {
  const [openId, setOpenId] = useState<string | null>(docs[0]?.id ?? null);
  const active = docs.find((d) => d.id === openId) ?? docs[0];
  const pdfFileName = active?.pdfPath.split("/").pop() ?? "document.pdf";

  return (
    <section className="app-surface px-5 py-5 sm:px-7 sm:py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">מסמכי החוזה — מגדל (4)</h2>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            בחר מסמך · «צפייה בחוזה» פותח PDF בטאב נפרד · «הורדת PDF» לשמירה.
          </p>
        </div>
        {active ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            <a
              href={active.pdfPath}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-black/10 bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted/50"
            >
              <ExternalLink className="size-4" />
              צפייה בחוזה
            </a>
            <a
              href={active.pdfPath}
              download={pdfFileName}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              <Download className="size-4" />
              הורדת PDF
            </a>
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {docs.map((doc, index) => (
          <button
            key={doc.id}
            type="button"
            onClick={() => setOpenId(doc.id)}
            className={cn(
              "rounded-xl border px-4 py-4 text-right transition-all",
              openId === doc.id
                ? "border-foreground/25 bg-foreground/[0.03] ring-2 ring-foreground/10"
                : "border-black/[0.08] bg-background/60 hover:border-black/15 hover:bg-background",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold tabular-nums">
                {index + 1}
              </span>
              <span className="text-[11px] text-muted-foreground">{doc.pages} עמ׳</span>
            </div>
            <p className="mt-2 text-sm font-semibold leading-snug">{doc.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{doc.subtitle}</p>
            <p className="mt-2 text-[11px] text-muted-foreground">{doc.date}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {doc.paymentTypes.map((t) => (
                <span
                  key={t}
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                    PAYMENT_ACCENT[t].badge,
                  )}
                >
                  {COMMISSION_TYPE_LABELS[t]}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function IncomeModelSection({ insurer }: { insurer: InsurerAgreement }) {
  return (
    <section className="app-surface px-5 py-5 sm:px-7 sm:py-6">
      <div className="flex items-center gap-2">
        <Calculator className="size-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">{MIGDAL_INCOME_MODEL.title}</h2>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {MIGDAL_INCOME_MODEL.intro}
      </p>

      <div className="mt-5 rounded-xl border-2 border-foreground/15 bg-muted/20 px-4 py-4 text-center sm:px-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">נוסחת-על</p>
        <p className="mt-2 text-lg font-bold leading-snug tracking-tight sm:text-xl">
          {MIGDAL_INCOME_MODEL.masterFormula}
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MIGDAL_INCOME_MODEL.components.map((comp) => (
          <div
            key={comp.type}
            className={cn(
              "rounded-xl border px-4 py-4",
              PAYMENT_ACCENT[comp.type].border,
              PAYMENT_ACCENT[comp.type].bg,
            )}
          >
            <p className="text-sm font-bold">{comp.label}</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">{comp.timing}</p>
            <p className="mt-3 rounded-lg bg-white/80 px-3 py-2.5 text-sm font-semibold leading-snug">
              {comp.formula}
            </p>
            <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">{comp.explain}</p>
          </div>
        ))}
      </div>

      <ul className="mt-5 space-y-2 rounded-xl border border-black/[0.06] bg-muted/15 px-4 py-4">
        {MIGDAL_INCOME_MODEL.notes.map((note) => (
          <li key={note} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground/40" aria-hidden />
            <span>{note}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5">
        <p className="text-sm font-semibold">3 מושגי «פרמיה» — אל תערבב</p>
        <div className="mt-2 overflow-x-auto rounded-xl border border-black/[0.06]">
          <table className="w-full min-w-[28rem] text-sm">
            <thead>
              <tr className="border-b border-black/[0.08] bg-muted/30 text-muted-foreground">
                <th className="px-3 py-2.5 pe-3 text-right font-medium">מונח</th>
                <th className="px-3 py-2.5 pe-3 text-right font-medium">משמעות</th>
                <th className="px-3 py-2.5 text-right font-medium">משמש ל</th>
              </tr>
            </thead>
            <tbody>
              {MIGDAL_INCOME_MODEL.definitions.map((def) => (
                <tr key={def.term} className="border-b border-black/[0.04] last:border-0">
                  <td className="px-3 py-2.5 pe-3 font-medium">{def.term}</td>
                  <td className="px-3 py-2.5 pe-3 text-muted-foreground">{def.meaning}</td>
                  <td className="px-3 py-2.5">{def.usedFor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <p className="rounded-xl border border-amber-200/70 bg-amber-50/50 px-4 py-3 text-sm text-amber-950">
          {MIGDAL_INCOME_MODEL.todayNote}
        </p>
        <StatusBadge insurer={insurer} />
      </div>
    </section>
  );
}

function PaymentSectionBlock({
  section,
  rules,
}: {
  section: MigdalPaymentSection;
  rules: MigdalCalcRule[];
}) {
  const accent = PAYMENT_ACCENT[section.id];

  return (
    <section
      id={`payment-${section.id}`}
      className={cn("app-surface scroll-mt-24 border-2 px-5 py-5 sm:px-7 sm:py-6", accent.border)}
    >
      <div className="flex flex-wrap items-start gap-3">
        <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold", accent.num)}>
          {section.order}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{section.label}</h2>
            <PnlStatusBadge status={section.pnlStatus} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{section.intro}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <InfoCard label="מתי" value={section.timing} />
        <InfoCard label="בסיס" value={section.basis} />
        <InfoCard label="נוסחה" value={section.formula} mono />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {section.contractFiles.map((file) => (
          <span key={file} className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", accent.badge)}>
            {file}
          </span>
        ))}
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold">כללי חישוב ({rules.length})</p>
        <div className="mt-2 space-y-2">
          {rules.map((rule) => (
            <CalcRuleCard key={rule.id} rule={rule} />
          ))}
        </div>
      </div>

      {section.formulaRows?.length ? (
        <FormulaTable
          title="שיעורים לפי מוצר"
          rows={section.formulaRows}
          splitHealthAndLife={section.id === "settled"}
        />
      ) : null}

      {section.rateTiers?.length ? (
        <VolumeTierTable tiers={section.rateTiers} />
      ) : null}

      {section.id === "volume" ? (
        <PolicyTermTable />
      ) : null}

      {section.transferTiers?.length ? (
        <TransferTierTable tiers={section.transferTiers} />
      ) : null}

      {section.examples.length ? (
        <ExamplesList examples={section.examples} />
      ) : null}

      {section.excelColumns.length ? (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground">עמודות רלוונטיות</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {section.excelColumns.map((col) => (
              <ColumnBadge key={col}>{col}</ColumnBadge>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function CalcRuleCard({ rule }: { rule: MigdalCalcRule }) {
  return (
    <div className="rounded-xl border border-black/[0.06] bg-white/80 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium text-sm">{rule.name}</p>
        <span className="text-[11px] text-muted-foreground">{rule.contractRef}</span>
      </div>
      <p className="mt-1.5 font-mono text-sm font-semibold tabular-nums">{rule.formula}</p>
      <dl className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
        <div><span className="font-medium text-foreground/80">בסיס: </span>{rule.basis}</div>
        <div><span className="font-medium text-foreground/80">מתי: </span>{rule.timing}</div>
      </dl>
      {rule.conditions?.length ? (
        <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          {rule.conditions.map((c) => (
            <li key={c}>· {c}</li>
          ))}
        </ul>
      ) : null}
      {rule.notes ? <p className="mt-2 text-xs text-amber-900/90">{rule.notes}</p> : null}
    </div>
  );
}

function VolumeTierTable({ tiers }: { tiers: MigdalPaymentSection["rateTiers"] }) {
  if (!tiers?.length) return null;
  return (
    <div className="mt-5 overflow-x-auto">
      <p className="mb-2 text-sm font-semibold">מדרגות היקף — אחוז מהפרמיה הקובעת</p>
      <table className="w-full min-w-[32rem] text-sm">
        <thead>
          <tr className="border-b border-black/[0.08] text-muted-foreground">
            <th className="pb-2 pe-3 text-right font-medium">מדרגה</th>
            <th className="pb-2 pe-3 text-right font-medium">בריאות</th>
            <th className="pb-2 pe-3 text-right font-medium">ריסק</th>
            <th className="pb-2 pe-3 text-right font-medium">פנסיה / גמל</th>
            <th className="pb-2 text-right font-medium">הערות</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((tier) => (
            <tr key={tier.label} className="border-b border-black/[0.04]">
              <td className="py-2.5 pe-3 font-medium">{tier.label}</td>
              <td className="py-2.5 pe-3 tabular-nums">{tier.health ?? "—"}</td>
              <td className="py-2.5 pe-3 tabular-nums">{tier.risk ?? "—"}</td>
              <td className="py-2.5 pe-3 tabular-nums">{tier.pension ?? tier.gemel ?? "—"}</td>
              <td className="py-2.5 text-muted-foreground">{tier.notes ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PolicyTermTable() {
  return (
    <div className="mt-5 overflow-x-auto">
      <p className="mb-2 text-sm font-semibold">שיקול תקופת ביטוח — ריסק (noname 3)</p>
      <table className="w-full min-w-[24rem] text-sm">
        <thead>
          <tr className="border-b border-black/[0.08] text-muted-foreground">
            <th className="pb-2 pe-3 text-right font-medium">תקופה</th>
            <th className="pb-2 pe-3 text-right font-medium">שיקול</th>
            <th className="pb-2 text-right font-medium">חל על</th>
          </tr>
        </thead>
        <tbody>
          {MIGDAL_POLICY_TERM_SCALE.map((row) => (
            <tr key={row.period} className="border-b border-black/[0.04]">
              <td className="py-2.5 pe-3 font-medium">{row.period}</td>
              <td className="py-2.5 pe-3 tabular-nums font-semibold">{row.factor}</td>
              <td className="py-2.5 text-muted-foreground">{row.appliesTo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TransferTierTable({ tiers }: { tiers: MigdalPaymentSection["transferTiers"] }) {
  if (!tiers?.length) return null;
  return (
    <div className="mt-5 overflow-x-auto">
      <p className="mb-2 text-sm font-semibold">העברות / ניוד — ₪ למיליון</p>
      <table className="w-full min-w-[28rem] text-sm">
        <thead>
          <tr className="border-b border-black/[0.08] text-muted-foreground">
            <th className="pb-2 pe-3 text-right font-medium">העברה נטו</th>
            <th className="pb-2 pe-3 text-right font-medium">עמלה</th>
            <th className="pb-2 text-right font-medium">היקף</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((tier) => (
            <tr key={`${tier.netTransfer}-${tier.commission}`} className="border-b border-black/[0.04]">
              <td className="py-2.5 pe-3 tabular-nums font-medium">{tier.netTransfer}</td>
              <td className="py-2.5 pe-3 tabular-nums">{tier.commission}</td>
              <td className="py-2.5 text-muted-foreground">{tier.productScope}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExamplesList({ examples }: { examples: string[] }) {
  return (
    <div className="mt-5">
      <p className="text-sm font-semibold">דוגמאות</p>
      <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
        {examples.map((ex) => (
          <li key={ex} className="rounded-lg bg-white/70 px-3 py-2">{ex}</li>
        ))}
      </ul>
    </div>
  );
}

const EXCEL_DETECT_LABEL: Record<
  NonNullable<MigdalOpenQuestion["excelDetect"]>,
  { text: string; className: string }
> = {
  חסר_באקסל: {
    text: "חסר באקסל",
    className: "bg-amber-100 text-amber-950",
  },
  יש_עמודה_לא_ברור: {
    text: "יש עמודה — לא ברור",
    className: "bg-sky-100 text-sky-950",
  },
  חלקי: {
    text: "חלקי מהאקסל",
    className: "bg-violet-100 text-violet-950",
  },
  מחוץ_לדוח: {
    text: "מחוץ לדוח",
    className: "bg-neutral-100 text-neutral-700",
  },
};

function OpenQuestionRow({ question, index }: { question: MigdalOpenQuestion; index: number }) {
  const answered = question.status === "answered";
  const accent = question.paymentType
    ? PAYMENT_ACCENT[question.paymentType].badge
    : "bg-muted text-foreground";
  const detect = question.excelDetect
    ? EXCEL_DETECT_LABEL[question.excelDetect]
    : null;

  return (
    <li
      className={cn(
        "rounded-2xl border px-4 py-4 sm:px-5 sm:py-5",
        answered
          ? "border-emerald-200/80 bg-emerald-50/40"
          : "border-black/[0.07] bg-background/70",
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
        <span
          className={cn(
            "mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums",
            answered ? "bg-emerald-500 text-white" : "bg-foreground text-background",
          )}
        >
          {answered ? "✓" : index}
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold leading-snug">{question.question}</p>
            {answered ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-900">
                נענה
              </span>
            ) : (
              <PriorityBadge priority={question.priority} />
            )}
            {question.paymentType ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  accent,
                )}
              >
                {question.paymentType === "settled"
                  ? "נפרעים"
                  : question.paymentType === "volume"
                    ? "היקף"
                    : question.paymentType === "campaigns"
                      ? "מבצעים"
                      : "צבירה"}
              </span>
            ) : null}
            {detect ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  detect.className,
                )}
              >
                {detect.text}
              </span>
            ) : null}
          </div>

          {answered && question.answer ? (
            <div className="rounded-xl border border-emerald-200/60 bg-white/70 px-3 py-2.5">
              <p className="text-xs font-semibold text-emerald-800">תשובה שאושרה</p>
              <p className="mt-1 text-sm font-medium text-emerald-950">{question.answer}</p>
            </div>
          ) : (
            <>
              {question.detail ? (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">רקע לשיחה</p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground/90">
                    {question.detail}
                  </p>
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-black/[0.03] px-3 py-2.5">
                  <p className="text-xs font-semibold text-muted-foreground">למה זה חשוב</p>
                  <p className="mt-1 text-sm leading-relaxed">{question.why}</p>
                </div>
                {question.askFor ? (
                  <div className="rounded-xl border border-foreground/10 bg-white/80 px-3 py-2.5">
                    <p className="text-xs font-semibold text-muted-foreground">מה לבקש כתשובה</p>
                    <p className="mt-1 text-sm font-medium leading-relaxed">{question.askFor}</p>
                  </div>
                ) : null}
              </div>
            </>
          )}

          {question.excelColumns?.length ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">עמודות רלוונטיות:</span>
              {question.excelColumns.map((col) => (
                <ColumnBadge key={col}>{col}</ColumnBadge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">אין עמודה מתאימה בדוח המנהלים</p>
          )}
        </div>
      </div>
    </li>
  );
}

function MapStatusBadge({ status }: { status: "לפי חוזה" | "חסר בחוזה" | "חסר באקסל" }) {
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        status === "לפי חוזה" && "bg-emerald-100 text-emerald-900",
        status === "חסר בחוזה" && "bg-red-100 text-red-900",
        status === "חסר באקסל" && "bg-amber-100 text-amber-900",
      )}
    >
      {status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: MigdalOpenQuestion["priority"] }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
        priority === "חובה" && "bg-red-100 text-red-900",
        priority === "חשוב" && "bg-amber-100 text-amber-900",
        priority === "משני" && "bg-neutral-100 text-neutral-600",
      )}
    >
      {priority}
    </span>
  );
}

function StatusBadge({ insurer }: { insurer: InsurerAgreement }) {
  return (
    <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-950">
      {insurer.statusLabel}
    </span>
  );
}

function PnlStatusBadge({ status }: { status: MigdalPaymentSection["pnlStatus"] }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
        status === "מחובר" && "bg-emerald-100 text-emerald-900",
        status === "בתכנון" && "bg-amber-100 text-amber-900",
        status === "לא מחובר" && "bg-neutral-100 text-neutral-700",
      )}
    >
      {status === "מחובר" ? "מחובר ל-PnL" : status === "בתכנון" ? "בתכנון" : "לא מחובר"}
    </span>
  );
}

function InfoCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-black/[0.06] bg-background/50 px-3 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-sm leading-snug", mono && "font-mono text-[13px]")}>{value}</p>
    </div>
  );
}

function ColumnBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
      {children}
    </span>
  );
}

function UsageBadge({ used }: { used: "כן" | "חלקי" | "לא" }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
        used === "כן" && "bg-emerald-100 text-emerald-900",
        used === "חלקי" && "bg-amber-100 text-amber-900",
        used === "לא" && "bg-neutral-100 text-neutral-600",
      )}
    >
      {used}
    </span>
  );
}

function FormulaTable({
  title,
  rows,
  splitHealthAndLife = false,
}: {
  title: string;
  rows: {
    product: string;
    yearOne: string;
    later?: string;
    notes?: string;
    group?: "health" | "other";
  }[];
  splitHealthAndLife?: boolean;
}) {
  if (splitHealthAndLife) {
    const health = rows.filter((r) => r.group === "health");
    const other = rows.filter((r) => r.group !== "health");
    return (
      <div className="mt-5 space-y-6">
        <p className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
          בריאות (§9) אינה כמו חיים (§8) — שנות פוליסה ושיעורים שונים. אסור להעתיק אחוזים בין הטבלאות.
        </p>
        <FormulaTableBlock
          title="בריאות §9 — א'–ה' 22% · ו'–טו' 19% · מטז' 7%"
          rows={health}
        />
        <FormulaTableBlock
          title="חיים / אחרות §8 — א'–ו' 22% · ז'–טו' 19% · מטז' 9% (משכנתא/אכ״ע שונים)"
          rows={other}
        />
      </div>
    );
  }

  return <FormulaTableBlock title={title} rows={rows} />;
}

function FormulaTableBlock({
  title,
  rows,
}: {
  title: string;
  rows: { product: string; yearOne: string; later?: string; notes?: string }[];
}) {
  if (!rows.length) return null;
  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-sm font-semibold">{title}</p>
      <table className="w-full min-w-[28rem] text-sm">
        <thead>
          <tr className="border-b border-black/[0.08] text-muted-foreground">
            <th className="pb-2 pe-4 text-right font-medium">מוצר</th>
            <th className="pb-2 pe-4 text-right font-medium">שיעור</th>
            <th className="pb-2 text-right font-medium">המשך / הערות</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.product} className="border-b border-black/[0.04]">
              <td className="py-2.5 pe-4">{row.product}</td>
              <td className="py-2.5 pe-4 font-medium tabular-nums">{row.yearOne}</td>
              <td className="py-2.5 text-muted-foreground">{row.later ?? row.notes ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComingSoonPanel({ insurer }: { insurer: InsurerAgreement }) {
  return (
    <div className="app-surface px-5 py-12 text-center sm:px-7">
      <p className="text-lg font-semibold">{insurer.name}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        הסכם ונוסחה יתווספו בהמשך. בדוח: פרמיה × {DEFAULT_PNL_MULTIPLIER}.
      </p>
    </div>
  );
}
