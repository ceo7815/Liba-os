"use client";

import { useState } from "react";
import { OPS_CHECKLIST_11_14 } from "@/lib/call-control/ops-checklist";
import { BUCKET_LABELS } from "@/lib/call-control/management";
import {
  AI_DOES_NOT,
  COMPANY_PACKS,
  CRITICAL_EVENTS,
  FIRST_VS_SECOND,
  MODEL_SETUP,
  MUST_IDENTIFY,
  QA_PIPELINE,
  SCORE_BUCKETS,
  SCORE_RULES,
  type CompanyPack,
} from "@/lib/call-control/qa-settings-catalog";
import { cn } from "@/lib/utils";

const NAV = [
  { id: "flow", label: "איך זה עובד" },
  { id: "mirror", label: "שיקוף 1 / 2" },
  { id: "main", label: "צ׳ק־ליסט ראשי" },
  { id: "id", label: "זיהוי" },
  { id: "companies", label: "חברות" },
  { id: "score", label: "ניקוד" },
  { id: "limits", label: "מה הוא לא רואה" },
  { id: "model", label: "מודל AI" },
] as const;

function statusTone(status: CompanyPack["status"]) {
  if (status === "ready") return "bg-emerald-50 text-emerald-900";
  if (status === "partial") return "bg-amber-50 text-amber-950";
  return "bg-red-50 text-red-800";
}

export function ChecklistSettings() {
  const [section, setSection] = useState<(typeof NAV)[number]["id"]>("flow");
  const [openCompany, setOpenCompany] = useState<string | null>("migdal");

  return (
    <div className="app-surface overflow-hidden" dir="rtl">
      <div className="border-b border-black/[0.06] px-5 py-5 sm:px-7">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground">
          הגדרות צ׳ק־ליסט · מקור האמת של הסוכן
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
          איך ה-AI מנתח שיחת שיקוף
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
          כל משתמש כאן רואה את אותם כללים. קודם תסריט 11.14, אחר כך זיהוי
          לקוח / מוצר / חברה, ואז דף הכיסויים של אותה חברה בלבד.
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-black/[0.06] px-3 sm:px-5">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSection(item.id)}
            className={cn(
              "relative shrink-0 px-3 py-3 text-sm font-semibold transition-colors",
              section === item.id
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            {section === item.id ? (
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-highlight" />
            ) : null}
          </button>
        ))}
      </div>

      <div className="px-5 py-6 sm:px-7">
        {section === "flow" ? <FlowSection /> : null}
        {section === "mirror" ? <MirrorSection /> : null}
        {section === "main" ? <MainSection /> : null}
        {section === "id" ? <IdentifySection /> : null}
        {section === "companies" ? (
          <CompaniesSection
            openCompany={openCompany}
            onToggle={(id) => setOpenCompany((cur) => (cur === id ? null : id))}
          />
        ) : null}
        {section === "score" ? <ScoreSection /> : null}
        {section === "limits" ? <LimitsSection /> : null}
        {section === "model" ? <ModelSection /> : null}
      </div>
    </div>
  );
}

function FlowSection() {
  return (
    <div className="space-y-5">
      <ol className="grid gap-3 md:grid-cols-5">
        {QA_PIPELINE.map((step) => (
          <li key={step.n} className="rounded-2xl bg-background px-4 py-4">
            <p className="text-[11px] font-semibold text-muted-foreground">
              שלב {step.n}
            </p>
            <p className="mt-1 text-sm font-semibold leading-snug">{step.title}</p>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>
      <p className="text-sm leading-7 text-muted-foreground">
        הסדר קבוע. אם החברה לא זוהתה — המשני לא רץ. אם זוהו איילון או הכשרה —
        שכבה 1 רצה והדוח מסומן «ניתוח לא מלא» עד השלמת הצ׳ק־ליסט. הראל מלא.
      </p>
    </div>
  );
}

function MirrorSection() {
  const blocks = [FIRST_VS_SECOND.first, FIRST_VS_SECOND.second];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {blocks.map((block) => (
        <article key={block.title} className="rounded-2xl bg-background px-5 py-5">
          <h3 className="text-base font-semibold">{block.title}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{block.when}</p>
          <ul className="mt-4 space-y-2">
            {block.checks.map((line) => (
              <li key={line} className="text-sm leading-6">
                <span className="me-2 text-muted-foreground">•</span>
                {line}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

function MainSection() {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-7 text-muted-foreground">
        תסריט שיקוף סביונים כרמל, אפריל 2025 — 21 סעיפים. זה מה שסופיה עובדת
        ממנו, וזה מה שהבקרה בודקת בכל שיחה.
      </p>
      <ol className="space-y-2">
        {OPS_CHECKLIST_11_14.map((item, index) => (
          <li key={item.id} className="rounded-2xl bg-background px-4 py-3 text-sm">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-semibold">
                {index + 1}. {item.title}
                {item.critical ? " · קריטי" : ""}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {BUCKET_LABELS[item.bucket]}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {item.prompt}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function IdentifySection() {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-7 text-muted-foreground">
        אחרי הראשי, ולפני דף החברה, ה-AI חייב לחלץ מהתמלול בלבד:
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {MUST_IDENTIFY.map((line) => (
          <li key={line} className="rounded-2xl bg-background px-4 py-3 text-sm leading-6">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CompaniesSection({
  openCompany,
  onToggle,
}: {
  openCompany: string | null;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-7 text-muted-foreground">
        בהצהרת החברות בתסריט: כלל, מגדל, הראל, הפניקס, הכשרה ומנורה. איילון
        קיים חלקית. אחרי הזיהוי רצים רק על החברה שנמכרה.
      </p>
      <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
        חסר בצ׳ק־ליסט: <span className="font-semibold">איילון</span> (עמודים 1,
        3, 4) ו<span className="font-semibold">הכשרה</span> (אין דף כיסויים).
        כשהסוכן מזהה אחת מהן — נרשם «ניתוח לא מלא». הראל לא נחסם.
      </div>
      <div className="space-y-3">
        {COMPANY_PACKS.map((pack) => {
          const open = openCompany === pack.id;
          return (
            <article key={pack.id} className="overflow-hidden rounded-2xl bg-background">
              <button
                type="button"
                onClick={() => onToggle(pack.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-4 text-right"
              >
                <div>
                  <p className="text-sm font-semibold">{pack.name}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{pack.source}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    statusTone(pack.status),
                  )}
                >
                  {pack.statusLabel}
                </span>
              </button>
              {open ? (
                <ul className="border-t border-black/[0.05] px-4 py-3">
                  {pack.products.map((product) => (
                    <li
                      key={product.name}
                      className="border-b border-black/[0.04] py-2 text-sm last:border-0"
                    >
                      {product.name}
                      {product.notes ? (
                        <span className="ms-2 text-xs text-muted-foreground">
                          {product.notes}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function ScoreSection() {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {SCORE_BUCKETS.map((bucket) => (
          <div key={bucket.label} className="rounded-2xl bg-background px-4 py-4">
            <p className="text-[11px] text-muted-foreground">{bucket.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{bucket.max}</p>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">{bucket.includes}</p>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl bg-background">
        <table className="w-full min-w-[32rem] text-right text-sm">
          <thead className="text-[11px] text-muted-foreground">
            <tr className="border-b border-black/[0.06]">
              <th className="px-4 py-3 font-medium">סטטוס</th>
              <th className="px-4 py-3 font-medium">ערך</th>
              <th className="px-4 py-3 font-medium">השפעה על הציון</th>
            </tr>
          </thead>
          <tbody>
            {SCORE_RULES.map((row) => (
              <tr key={row.status} className="border-b border-black/[0.04] last:border-0">
                <td className="px-4 py-3 font-semibold">{row.status}</td>
                <td className="px-4 py-3 tabular-nums">{row.points}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.effect}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <h3 className="text-sm font-semibold">אירועים קריטיים — דגל נפרד</h3>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {CRITICAL_EVENTS.map((line) => (
            <li key={line} className="rounded-2xl bg-red-50/70 px-4 py-3 text-sm leading-6 text-red-950">
              {line}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function LimitsSection() {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {AI_DOES_NOT.map((line) => (
        <li key={line} className="rounded-2xl bg-background px-4 py-3 text-sm leading-6">
          {line}
        </li>
      ))}
    </ul>
  );
}

function ModelSection() {
  const cards = [
    MODEL_SETUP.stt,
    MODEL_SETUP.current,
    MODEL_SETUP.previous,
    MODEL_SETUP.ceiling,
  ];
  return (
    <div className="space-y-4">
      <p className="text-sm leading-7 text-muted-foreground">
        נשארים ב-OpenAI עם המפתח הקיים. תמלול לחוד, ניתוח לחוד. מודל הניתוח
        הפעיל:
        <span className="font-semibold text-foreground"> gpt-5.6-sol</span>
        — דגל מקצועי לרשימות ארוכות, ציטוט ו-JSON. כל שיחת סופיה מ-Voicenter
        נכנסת אוטומטית.
      </p>
      <div className="grid gap-3 lg:grid-cols-2">
        {cards.map((card) => (
          <article
            key={card.id}
            className={cn(
              "rounded-2xl px-4 py-4",
              card.id === MODEL_SETUP.current.id
                ? "bg-highlight/35"
                : "bg-background",
            )}
          >
            <p className="text-[11px] font-medium text-muted-foreground">{card.role}</p>
            <p className="mt-1 font-mono text-sm font-semibold" dir="ltr">
              {card.id}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{card.why}</p>
            {"price" in card ? (
              <p className="mt-2 text-xs text-muted-foreground">{card.price}</p>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
