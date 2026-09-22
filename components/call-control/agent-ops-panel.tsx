"use client";

import { OPS_CHECKLIST_11_14 } from "@/lib/call-control/ops-checklist";
import {
  BUCKET_LABELS,
  TOOL_STATUS_LABELS,
  mergeExpectedTools,
  type DisplayTool,
  type ReportedTool,
} from "@/lib/call-control/management";
import { PROCESSING_LABELS, type CallControlRow } from "@/lib/call-control/view";
import { cn } from "@/lib/utils";

function formatSeen(iso: string | null): string {
  if (!iso) return "עדיין לא דווח";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "עדיין לא דווח";
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function toolTone(status: DisplayTool["status"]) {
  switch (status) {
    case "connected":
      return "bg-emerald-50 text-emerald-900";
    case "degraded":
      return "bg-amber-100 text-amber-950";
    case "error":
      return "bg-red-100 text-red-900";
    default:
      return "bg-black/[0.05] text-muted-foreground";
  }
}

function toolDot(status: DisplayTool["status"]) {
  switch (status) {
    case "connected":
      return "status-live-dot";
    case "degraded":
      return "status-live-dot status-live-dot--amber";
    case "error":
      return "size-1.5 rounded-full bg-red-500";
    default:
      return "size-1.5 rounded-full bg-black/25";
  }
}

export function ConnectionChips({ tools }: { tools: ReportedTool[] }) {
  const displayTools = mergeExpectedTools(tools);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {displayTools.map((tool) => (
        <span
          key={tool.key}
          title={`${tool.detail} · עדכון ${formatSeen(tool.lastCheckedAt)}`}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
            toolTone(tool.status),
          )}
        >
          <span className={toolDot(tool.status)} aria-hidden />
          {tool.label}
          <span className="font-medium opacity-70">
            {TOOL_STATUS_LABELS[tool.status]}
          </span>
        </span>
      ))}
    </div>
  );
}

export function AgentOpsPanel({
  rows,
}: {
  hermesStatus: string | null;
  hermesLastSeenAt: string | null;
  tools: ReportedTool[];
  rows: CallControlRow[];
}) {
  const counts = {
    ready: rows.filter((r) => r.processingStatus === "ready").length,
    processing: rows.filter((r) => r.processingStatus === "processing").length,
    waiting: rows.filter((r) => r.processingStatus === "waiting").length,
    failed: rows.filter((r) => r.processingStatus === "failed").length,
  };
  const critical = rows.filter((r) => r.hasCritical).length;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
      {(
        [
          ["ready", counts.ready],
          ["processing", counts.processing],
          ["waiting", counts.waiting],
          ["failed", counts.failed],
        ] as const
      ).map(([key, n]) => (
        <div
          key={key}
          className="rounded-[1.15rem] border border-black/[0.06] bg-white px-4 py-3.5 shadow-[0_1px_0_rgba(17,17,17,0.03)]"
        >
          <p className="text-[11px] font-medium text-muted-foreground">
            {PROCESSING_LABELS[key]}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
            {n}
          </p>
        </div>
      ))}
      <div className="rounded-[1.15rem] border border-black/[0.06] bg-white px-4 py-3.5 shadow-[0_1px_0_rgba(17,17,17,0.03)]">
        <p className="text-[11px] font-medium text-muted-foreground">קריטי</p>
        <p
          className={cn(
            "mt-1 text-2xl font-semibold tabular-nums tracking-tight",
            critical > 0 && "text-red-700",
          )}
        >
          {critical}
        </p>
      </div>
    </div>
  );
}

export function ChecklistReference() {
  return (
    <div className="app-surface space-y-8 px-5 py-6 sm:px-7" dir="rtl">
      <section>
        <h2 className="text-lg font-semibold tracking-tight">
          איך ה-AI מנתח שיחת שיקוף
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
          כל השיחות כאן הן שיחות שיקוף של סופיה. הבקרה היא רגולטורית: האם השיקוף
          בוצע ברמה הגבוהה ביותר, לפי טופס 11.14. ה-AI לא מחליט במקום המנהל —
          הוא קורא את התמלול מ-Voicenter, עובר סעיף־סעיף, ומצטט ראיה מההקלטה.
        </p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2">
          <li className="rounded-2xl bg-background px-4 py-3">
            <p className="text-sm font-semibold">1. קליטה</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Voicenter שולח CallID, תמלול מוכן ומשך. בלי תמלול אין ציון.
            </p>
          </li>
          <li className="rounded-2xl bg-background px-4 py-3">
            <p className="text-sm font-semibold">2. מעבר על 21 סעיפים</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              לכל סעיף נקבע: בוצע, חלקי, לא בוצע, לא רלוונטי, או לא ניתן לאימות.
            </p>
          </li>
          <li className="rounded-2xl bg-background px-4 py-3">
            <p className="text-sm font-semibold">3. ראיה מההקלטה</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              כל קביעה חייבת ציטוט. בלי ראיה הסעיף מסומן «לא ניתן לאימות» ולא
              נכשל אוטומטית.
            </p>
          </li>
          <li className="rounded-2xl bg-background px-4 py-3">
            <p className="text-sm font-semibold">4. ציון מורכב</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              רק סעיפים רלוונטיים נכנסים למכנה. בוצע = 1, חלקי = 0.5, לא בוצע =
              0. לא רלוונטי לא מוריד.
            </p>
          </li>
        </ol>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl bg-background px-4 py-3">
            <p className="text-[11px] text-muted-foreground">עמידה רגולטורית</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">60 / 100</p>
          </div>
          <div className="rounded-2xl bg-background px-4 py-3">
            <p className="text-[11px] text-muted-foreground">מקצועיות</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">25 / 100</p>
          </div>
          <div className="rounded-2xl bg-background px-4 py-3">
            <p className="text-[11px] text-muted-foreground">איכות שיחה</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">15 / 100</p>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold tracking-tight">
          צ׳ק־ליסט 11.14 — 21 סעיפים
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          זה מה שה-AI בודק בכל שיקוף. סעיף עם «קריטי» עולה בדגל נפרד גם אם הציון
          גבוה.
        </p>
        <ol className="mt-4 space-y-2">
          {OPS_CHECKLIST_11_14.map((item, index) => (
            <li
              key={item.id}
              className="rounded-2xl bg-background px-4 py-3 text-sm"
            >
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
      </section>
    </div>
  );
}
