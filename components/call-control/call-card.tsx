"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Headphones,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import type { CallReportDetail } from "@/app/actions/agents";
import {
  CHECKLIST_STATUS_LABELS,
  SCORE_WEIGHTS,
  mergeCallIdentification,
  parseCallQaFindings,
} from "@/lib/agents/call-qa-checklist";
import {
  CALL_KIND_LABELS,
  formatCallClock,
  formatDuration,
  formatScore,
  type CallControlRow,
} from "@/lib/call-control/view";
import {
  buildOpsRows,
  scoreFromOpsRows,
} from "@/lib/call-control/ops-checklist";
import { cn } from "@/lib/utils";
import {
  KindPill,
  ScoreRing,
  StatusPill,
  checklistTone,
  scoreColor,
  scoreTrack,
} from "@/components/call-control/visual";

type TranscriptTurn = {
  speaker: string | null;
  text: string;
  startSec: number | null;
};

type CardTab = "overview" | "checklist" | "transcript";

function formatClock(sec: number | null): string | null {
  if (sec == null || !Number.isFinite(sec)) return null;
  const total = Math.max(0, Math.round(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function normalizeTurns(segments: unknown, fullText: string | null): TranscriptTurn[] {
  if (Array.isArray(segments)) {
    const out: TranscriptTurn[] = [];
    for (const raw of segments) {
      if (!raw || typeof raw !== "object") continue;
      const seg = raw as {
        text?: unknown;
        speaker?: unknown;
        start_sec?: unknown;
        end_sec?: unknown;
        start?: unknown;
      };
      const text = typeof seg.text === "string" ? seg.text.trim() : "";
      if (!text) continue;
      const start =
        typeof seg.start_sec === "number"
          ? seg.start_sec
          : typeof seg.start === "number"
            ? seg.start
            : null;
      out.push({
        text,
        speaker: typeof seg.speaker === "string" ? seg.speaker : null,
        startSec: start,
      });
    }
    if (out.length) return out;
  }
  if (!fullText?.trim()) return [];
  return fullText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^\[([^\]]+)\]\s*(.*)$/);
      return m
        ? { speaker: m[1], text: m[2] || line, startSec: null }
        : { speaker: null, text: line, startSec: null };
    });
}

function turnSide(
  speaker: string | null,
  agentName: string,
): "agent" | "customer" | "other" {
  const s = (speaker ?? "").trim();
  if (!s) return "other";
  if (/סופיה|נציג|נציגה/.test(s) || (agentName && s.includes(agentName))) {
    return "agent";
  }
  if (/לקוח|לקוחה|מבוטח|מבוטחת/.test(s)) return "customer";
  return "other";
}

function buildOwnerReport(row: CallControlRow, detail: CallReportDetail | null): string {
  const findings = parseCallQaFindings(detail?.analysis?.findings);
  const ops = buildOpsRows(detail?.analysis?.findings);
  const composed = scoreFromOpsRows(ops);
  const gaps = ops
    .filter((r) => r.status === "not_done" || r.status === "partial")
    .slice(0, 3)
    .map((r) => `${r.title}: ${CHECKLIST_STATUS_LABELS[r.status]}`);
  const rec = detail?.analysis?.recommendations?.[0] ?? "אין המלצה מאושרת.";
  const missing =
    gaps.length > 0
      ? gaps.map((g, i) => `${i + 1}. ${g}`).join("\n")
      : findings?.gaps?.length
        ? findings.gaps.slice(0, 3).map((g, i) => `${i + 1}. ${g.what}`).join("\n")
        : "אין חוסר מתועד.";
  return [
    `${formatCallClock(row.callDate)} | ${row.agentName} | ${CALL_KIND_LABELS[row.callKind]} | ${formatScore(composed.total ?? row.overallScore)}/100 | קריטי ${row.hasCritical ? "כן" : "לא"}`,
    "",
    "חוסרים עיקריים:",
    missing,
    "",
    `המלצה: ${rec}`,
  ].join("\n");
}

export function CallCard({
  row,
  detail,
}: {
  row: CallControlRow;
  detail: CallReportDetail | null;
}) {
  const findings = parseCallQaFindings(detail?.analysis?.findings);
  const ops = useMemo(
    () => buildOpsRows(detail?.analysis?.findings),
    [detail],
  );
  const composed = scoreFromOpsRows(ops);
  const ident = mergeCallIdentification(
    detail?.analysis?.rubric_scores,
    findings,
  );
  const critical = findings?.critical_events ?? [];
  const summary = detail?.analysis?.summary?.trim() ?? "";
  const gaps = findings?.gaps ?? [];
  const recs = detail?.analysis?.recommendations ?? [];
  const turns = useMemo(
    () =>
      normalizeTurns(
        detail?.transcript?.segments ?? null,
        detail?.transcript?.full_text ?? null,
      ),
    [detail],
  );
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<CardTab>("overview");
  const turnRefs = useRef<Array<HTMLLIElement | null>>([]);

  const filtered = query.trim()
    ? turns.filter(
        (t) =>
          t.text.includes(query.trim()) ||
          (t.speaker && t.speaker.includes(query.trim())),
      )
    : turns;

  async function copyReport() {
    const text = buildOwnerReport(row, detail);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("הדוח הועתק");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("ההעתקה נכשלה");
    }
  }

  const total = composed.total ?? row.overallScore;

  return (
    <article className="flex min-h-0 flex-col" dir="rtl">
      <header className="border-b border-black/[0.06] px-5 py-5 sm:px-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {row.isDemo ? (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                  שיחת דמה — תימחק אחרי אישור
                </span>
              ) : null}
              <KindPill kind={row.callKind} />
              <StatusPill status={row.processingStatus} />
              {row.hasCritical ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-800">
                  <AlertTriangle className="size-3" />
                  קריטי
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                  <CheckCircle2 className="size-3" />
                  ללא קריטי
                </span>
              )}
            </div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
              {ident.customer_name || row.customerName || "לקוח לא זוהה"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {row.agentName}
              <span className="mx-1.5 text-black/20">·</span>
              {formatCallClock(row.callDate)}
              <span className="mx-1.5 text-black/20">·</span>
              {formatDuration(row.durationSec)}
            </p>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground" dir="ltr">
              CallID {row.voicenterCallId ?? "—"} · voicenter
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ScoreRing value={total} size={64} />
            <div className="flex flex-col gap-2">
              {row.audioPath ? (
                <a
                  href={row.audioPath}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-highlight/50 px-3 text-xs font-semibold text-foreground transition-colors hover:bg-highlight"
                >
                  <Headphones className="size-3.5" />
                  האזנה
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => void copyReport()}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-foreground px-3 text-xs font-semibold text-white"
              >
                <Copy className="size-3.5" />
                {copied ? "הועתק" : "העתק דוח"}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex gap-1 border-b border-black/[0.06] px-4 sm:px-6">
        {(
          [
            ["overview", "סקירה"],
            ["checklist", "צ׳ק־ליסט"],
            ["transcript", "תמלול"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "relative px-3 py-3 text-sm font-semibold transition-colors",
              tab === id
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            {tab === id ? (
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-highlight" />
            ) : null}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-7">
        {tab === "overview" ? (
          <>
            {critical.length > 0 ? (
              <section className="space-y-2">
                {critical.map((ev, idx) => (
                  <div
                    key={`${ev.title}-${idx}`}
                    className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3"
                  >
                    <p className="flex items-center gap-1.5 font-semibold text-red-800">
                      <AlertTriangle className="size-4" />
                      {ev.title}
                    </p>
                    {ev.detail ? (
                      <p className="mt-1 text-sm leading-relaxed text-red-900/80">
                        {ev.detail}
                      </p>
                    ) : null}
                    {ev.evidence ? (
                      <p className="mt-1 text-xs text-red-900/70">«{ev.evidence}»</p>
                    ) : null}
                  </div>
                ))}
              </section>
            ) : null}

            <section>
              <h3 className="text-[11px] font-medium tracking-wide text-muted-foreground">
                סיכום ניהולי
              </h3>
              {summary ? (
                <p className="mt-2 whitespace-pre-line text-[15px] leading-7">
                  {summary}
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  אין סיכום מאושר עדיין.
                </p>
              )}
            </section>

            <section>
              <h3 className="text-[11px] font-medium tracking-wide text-muted-foreground">
                זיהוי
              </h3>
              <dl className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <Ident label="נציג" value={ident.rep_name || row.agentName} />
                <Ident
                  label="לקוח"
                  value={ident.customer_name || row.customerName || "לא זוהה"}
                />
                <Ident label="סוג" value={ident.call_type || row.callTypeLabel} />
                <Ident label="חברה" value={ident.insurer || "לא זוהתה"} />
                <Ident
                  label="מוצרים"
                  value={ident.products_discussed?.join(" · ") || "לא נדונו"}
                />
                <Ident
                  label="עסקה"
                  value={
                    ident.deal_status || (ident.deal_completed ? "הושלמה" : "לא הושלמה")
                  }
                />
              </dl>
            </section>

            <section>
              <h3 className="text-[11px] font-medium tracking-wide text-muted-foreground">
                ציון — הורכב מהצ׳ק־ליסט
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {composed.relevantCount} סעיפים רלוונטיים · {composed.counts.done}{" "}
                בוצע · {composed.counts.partial} חלקי · {composed.counts.not_done} לא
                בוצע · {composed.counts.not_relevant} לא רלוונטי ·{" "}
                {composed.counts.unverifiable} לא ניתן לאימות
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <ScoreMeter
                  label="עמידה רגולטורית"
                  value={composed.compliance}
                  max={SCORE_WEIGHTS.compliance}
                />
                <ScoreMeter
                  label="מקצועיות"
                  value={composed.professionalism}
                  max={SCORE_WEIGHTS.professionalism}
                />
                <ScoreMeter
                  label="איכות שיחה"
                  value={composed.service_quality}
                  max={SCORE_WEIGHTS.service_quality}
                />
                <ScoreMeter
                  label="סה״כ"
                  value={composed.total}
                  max={SCORE_WEIGHTS.total}
                  emphasize
                />
              </div>
            </section>

            {gaps.length > 0 ? (
              <section>
                <h3 className="text-[11px] font-medium tracking-wide text-muted-foreground">
                  מה חסר
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {gaps.map((gap) => (
                    <li
                      key={gap.what}
                      className="rounded-2xl bg-background px-4 py-2.5 text-sm leading-relaxed"
                    >
                      {gap.what}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {recs.length > 0 ? (
              <section>
                <h3 className="text-[11px] font-medium tracking-wide text-muted-foreground">
                  המלצות
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {recs.map((line) => (
                    <li
                      key={line}
                      className="rounded-2xl bg-background px-4 py-2.5 text-sm leading-relaxed"
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : null}

        {tab === "checklist" ? (
          <ol className="space-y-2">
            {ops.map((item, index) => (
              <li
                key={item.id}
                id={`ops-${item.id}`}
                className={cn(
                  "rounded-2xl bg-background px-4 py-3",
                  item.critical && item.status === "not_done" && "ring-1 ring-red-200",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {index + 1}. {item.title}
                      {item.critical ? " · קריטי" : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.prompt}</p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      checklistTone(item.status),
                    )}
                  >
                    {CHECKLIST_STATUS_LABELS[item.status]}
                  </span>
                </div>
                {item.whatHappened ? (
                  <p className="mt-2 text-sm leading-relaxed">{item.whatHappened}</p>
                ) : null}
                {item.evidence ? (
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    ראיה: «{item.evidence}»
                  </p>
                ) : item.status === "unverifiable" ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    לא ניתן לקבוע בוודאות מההקלטה.
                  </p>
                ) : item.status === "not_relevant" ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    לא רלוונטי לשיחה זו — לא מוריד ציון.
                  </p>
                ) : item.status === "not_done" ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {item.shouldHave || "הסעיף היה רלוונטי ולא בוצע."}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        ) : null}

        {tab === "transcript" ? (
          <section>
            <div className="relative">
              <Search className="pointer-events-none absolute end-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="חיפוש בתמלול"
                className="h-10 w-full rounded-xl border border-black/[0.08] bg-background pe-9 ps-3 text-sm outline-none focus:ring-1 focus:ring-highlight"
              />
            </div>
            {filtered.length === 0 ? (
              <p className="mt-6 text-sm text-muted-foreground">אין תמלול להצגה.</p>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {filtered.map((turn, idx) => {
                  const side = turnSide(turn.speaker, row.agentName);
                  return (
                    <li
                      key={`${turn.startSec ?? "x"}-${idx}`}
                      ref={(el) => {
                        turnRefs.current[idx] = el;
                      }}
                      className={cn(
                        "max-w-[92%] rounded-2xl px-4 py-3",
                        side === "agent" && "ms-0 me-auto bg-highlight/25",
                        side === "customer" && "ms-auto me-0 bg-background",
                        side === "other" && "mx-auto bg-white ring-1 ring-black/[0.04]",
                      )}
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        {turn.speaker ? (
                          <span className="text-[11px] font-semibold">
                            {turn.speaker}
                          </span>
                        ) : null}
                        {formatClock(turn.startSec) ? (
                          <button
                            type="button"
                            className="text-[11px] tabular-nums text-muted-foreground"
                            dir="ltr"
                            onClick={() =>
                              turnRefs.current[idx]?.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                              })
                            }
                          >
                            {formatClock(turn.startSec)}
                          </button>
                        ) : null}
                      </div>
                      <p className="text-[15px] leading-7">{turn.text}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : null}
      </div>
    </article>
  );
}

function Ident({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-background px-4 py-3">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

function ScoreMeter({
  label,
  value,
  max,
  emphasize,
}: {
  label: string;
  value: number | null;
  max: number;
  emphasize?: boolean;
}) {
  const pct = value == null || max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className={cn(
        "rounded-2xl px-4 py-3",
        emphasize ? "bg-foreground text-white" : "bg-background",
      )}
    >
      <p
        className={cn(
          "text-[11px]",
          emphasize ? "text-white/70" : "text-muted-foreground",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums",
          !emphasize && scoreColor(value == null ? null : (value / max) * 100),
        )}
      >
        {value == null ? "—" : Math.round(value)}
        <span
          className={cn(
            "text-sm font-medium",
            emphasize ? "text-white/70" : "text-muted-foreground",
          )}
        >
          /{max}
        </span>
      </p>
      <div
        className={cn(
          "mt-2 h-1.5 overflow-hidden rounded-full",
          emphasize ? "bg-white/15" : "bg-black/[0.06]",
        )}
      >
        <div
          className={cn(
            "h-full rounded-full",
            emphasize ? "bg-highlight" : scoreTrack(value == null ? null : (value / max) * 100),
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
