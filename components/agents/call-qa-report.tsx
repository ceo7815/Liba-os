"use client";

import { ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  CHECKLIST_STATUS_LABELS,
  FINDING_SEVERITY_LABELS,
  SCORE_WEIGHTS,
  getChecklistItemTitle,
  getChecklistSectionTitle,
  parseCallQaFindings,
  mergeCallIdentification,
  resolveRubricScores,
  type ChecklistStatus,
  type FindingSeverity,
} from "@/lib/agents/call-qa-checklist";

export type CallAnalysisView = {
  overall_score: number | string | null;
  summary: string | null;
  recommendations: string[] | null;
  rubric_scores: unknown;
  findings: unknown;
  model?: string | null;
};

export type CallTranscriptView = {
  full_text: string | null;
  segments: unknown;
  provider: string | null;
  language: string | null;
} | null;

function statusClass(status: ChecklistStatus) {
  switch (status) {
    case "done":
      return "bg-highlight/35 text-foreground";
    case "partial":
      return "bg-amber-100 text-amber-950";
    case "not_done":
      return "bg-red-100 text-red-900";
    case "not_relevant":
      return "bg-background text-muted-foreground";
    case "unverifiable":
      return "bg-background text-muted-foreground ring-1 ring-black/10";
  }
}

function severityClass(severity: FindingSeverity) {
  switch (severity) {
    case "critical":
      return "text-red-700";
    case "material":
      return "text-amber-800";
    case "improvement":
      return "text-muted-foreground";
  }
}

function scoreLine(value: number | string | null | undefined, max: number) {
  if (value == null || value === "") return `—/${max}`;
  return `${Number(value)}/${max}`;
}

function identText(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const parts = value.map(identText).filter((part): part is string => Boolean(part));
    return parts.length ? parts.join(" · ") : null;
  }
  if (typeof value === "object") {
    const o = value as { [key: string]: unknown };
    const adults = o.adults_additional ?? o.adults ?? o.extra_adults;
    const children = o.children;
    const bits: string[] = [];
    if (adults != null && adults !== "") bits.push(`בגירים נוספים ${adults}`);
    if (children != null && children !== "") bits.push(`ילדים ${children}`);
    return bits.length ? bits.join(" · ") : null;
  }
  return null;
}

function IdentRow({ label, value }: { label: string; value: unknown }) {
  const text = identText(value);
  if (!text) return null;
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 text-sm">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{text}</dd>
    </div>
  );
}

function boolHe(v: boolean | null | undefined) {
  if (v == null) return null;
  return v ? "כן" : "לא";
}

type TranscriptSegment = {
  text: string;
  start: string | number | null;
  speaker: string | null;
};

function normalizeSegments(segments: unknown): TranscriptSegment[] {
  if (!Array.isArray(segments)) return [];
  const out: TranscriptSegment[] = [];
  for (const raw of segments) {
    if (!raw || typeof raw !== "object") continue;
    const seg = raw as {
      text?: unknown;
      content?: unknown;
      speaker?: unknown;
      role?: unknown;
      start?: unknown;
      start_sec?: unknown;
      startTime?: unknown;
    };
    const text =
      typeof seg.text === "string"
        ? seg.text
        : typeof seg.content === "string"
          ? seg.content
          : null;
    if (!text?.trim()) continue;
    const speaker =
      typeof seg.speaker === "string"
        ? seg.speaker
        : typeof seg.role === "string"
          ? seg.role
          : null;
    const start = seg.start ?? seg.start_sec ?? seg.startTime ?? null;
    out.push({
      text: text.trim(),
      start:
        typeof start === "string" || typeof start === "number" ? start : null,
      speaker,
    });
  }
  return out;
}

/** Split full_text lines like `[A] ...` / `[B] ...` into readable turns. */
function turnsFromFullText(fullText: string): TranscriptSegment[] {
  const lines = fullText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const tagged = lines.filter((l) => /^\[([^\]]+)\]\s*/.test(l));
  if (tagged.length < Math.max(2, Math.floor(lines.length * 0.4))) {
    return [];
  }

  return lines.map((line) => {
    const m = line.match(/^\[([^\]]+)\]\s*(.*)$/);
    if (!m) return { text: line, start: null, speaker: null };
    return { text: m[2] || line, start: null, speaker: m[1] };
  });
}

function TranscriptViewer({
  transcript,
}: {
  transcript: {
    full_text: string | null;
    segments: unknown;
    provider: string | null;
    language: string | null;
  };
}) {
  const segments = normalizeSegments(transcript.segments);
  const turns =
    segments.length > 0
      ? segments
      : transcript.full_text
        ? turnsFromFullText(transcript.full_text)
        : [];
  const metaBits = [
    transcript.language ? `שפה: ${transcript.language}` : null,
    transcript.provider ? `מקור תמלול: ${transcript.provider}` : null,
    segments.length > 0 ? `${segments.length} מקטעים` : null,
  ].filter(Boolean);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl gap-2"
        >
          <ScrollText className="size-3.5" />
          הצג תמלול מלא
        </Button>
      </DialogTrigger>
      <DialogContent
        dir="rtl"
        className="flex max-h-[min(90vh,44rem)] w-[calc(100%-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-2xl"
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-black/[0.06] px-5 py-4 pe-12 text-right sm:text-right">
          <DialogTitle className="text-base">תמלול שיחה</DialogTitle>
          {metaBits.length > 0 ? (
            <DialogDescription className="text-xs">
              {metaBits.join(" · ")}
            </DialogDescription>
          ) : (
            <DialogDescription className="sr-only">
              תמלול מלא של השיחה
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {turns.length > 0 ? (
            <ul className="space-y-3">
              {turns.map((turn, idx) => (
                <li
                  key={idx}
                  className="rounded-xl bg-muted/40 px-3.5 py-3"
                >
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    {turn.speaker ? (
                      <span className="rounded-md bg-background px-2 py-0.5 text-[11px] font-semibold tabular-nums tracking-wide">
                        {turn.speaker}
                      </span>
                    ) : null}
                    {turn.start != null ? (
                      <span
                        className="text-[11px] tabular-nums text-muted-foreground"
                        dir="ltr"
                      >
                        {String(turn.start)}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[15px] leading-7 text-foreground">
                    {turn.text}
                  </p>
                </li>
              ))}
            </ul>
          ) : transcript.full_text ? (
            <p className="whitespace-pre-wrap text-[15px] leading-7 text-foreground">
              {transcript.full_text}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">אין תמלול להצגה</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CallQaReport({
  analysis,
  transcript,
}: {
  analysis: CallAnalysisView | null;
  transcript?: CallTranscriptView;
}) {
  if (!analysis && !transcript) {
    return (
      <p className="mt-3 text-sm text-muted-foreground">אין ניתוח עדיין</p>
    );
  }

  const scores = resolveRubricScores(
    analysis?.rubric_scores,
    analysis?.overall_score,
  );
  const findings = parseCallQaFindings(analysis?.findings);
  const identification = mergeCallIdentification(
    analysis?.rubric_scores,
    findings,
  );
  const checklist = findings?.checklist ?? [];
  const critical = findings?.critical_events;
  const gaps = findings?.gaps ?? [];
  const doneWell = findings?.done_well ?? [];
  const manager = findings?.manager_summary;
  const recommendations = analysis?.recommendations ?? [];
  const hasTranscript = Boolean(
    transcript?.full_text ||
      (Array.isArray(transcript?.segments) && transcript.segments.length > 0),
  );

  return (
    <div className="mt-3 space-y-5 text-sm">
      {hasTranscript && transcript ? (
        <section>
          <h4 className="text-xs font-semibold text-muted-foreground">תמלול</h4>
          <div className="mt-2">
            <TranscriptViewer transcript={transcript} />
          </div>
        </section>
      ) : null}

      {analysis ? (
        <>
      {/* §25.1–4 scores */}
      <section>
        <h4 className="text-xs font-semibold text-muted-foreground">ציונים</h4>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <ScoreChip
            label="ציון כולל"
            value={scoreLine(scores.total, SCORE_WEIGHTS.total)}
            emphasize
          />
          <ScoreChip
            label="עמידה בתהליך"
            value={scoreLine(scores.compliance, SCORE_WEIGHTS.compliance)}
          />
          <ScoreChip
            label="מקצועיות"
            value={scoreLine(scores.professionalism, SCORE_WEIGHTS.professionalism)}
          />
          <ScoreChip
            label="איכות שיחה"
            value={scoreLine(scores.service_quality, SCORE_WEIGHTS.service_quality)}
          />
        </div>
      </section>

      {/* §25.5 identification */}
      {identification ? (
        <section>
          <h4 className="text-xs font-semibold text-muted-foreground">זיהוי השיחה</h4>
          <dl className="mt-2 space-y-1.5 rounded-xl bg-background px-3 py-3">
            <IdentRow
              label="לקוח"
              value={identification.customer_name ?? "לא זוהה"}
            />
            <IdentRow label="נציג" value={identification.rep_name ?? "לא זוהה"} />
            <IdentRow label="סוכנות" value={identification.agency_name} />
            <IdentRow label="חברה" value={identification.insurer} />
            <IdentRow label="סוג שיחה" value={identification.call_type} />
            <IdentRow
              label="מוצרים"
              value={identification.products_discussed?.join(" · ")}
            />
            <IdentRow
              label="הוצעו"
              value={identification.products_offered?.join(" · ")}
            />
            <IdentRow
              label="נרכשו"
              value={identification.products_purchased?.join(" · ")}
            />
            <IdentRow label="מבוטחים" value={identification.insured_count} />
            <IdentRow label="בגירים נוספים" value={boolHe(identification.extra_adults)} />
            <IdentRow label="ילדים" value={boolHe(identification.children)} />
            <IdentRow label="67+" value={boolHe(identification.age_67_plus)} />
            <IdentRow
              label="משלם ≠ מבוטח"
              value={boolHe(identification.payer_differs_from_insured)}
            />
            <IdentRow
              label="פוליסה דומה"
              value={boolHe(identification.similar_policy_exists)}
            />
            <IdentRow
              label="הר הביטוח"
              value={boolHe(identification.har_habituach_entered)}
            />
            <IdentRow
              label="סטטוס עסקה"
              value={identification.deal_status ?? boolHe(identification.deal_completed)}
            />
          </dl>
        </section>
      ) : null}

      {/* §25.11 / summary */}
      {(analysis.summary || manager) && (
        <section>
          <h4 className="text-xs font-semibold text-muted-foreground">סיכום מנהל</h4>
          {analysis.summary ? (
            <p className="mt-2 leading-relaxed">{analysis.summary}</p>
          ) : null}
          {manager ? (
            <dl className="mt-2 space-y-1.5 rounded-xl bg-background px-3 py-3">
              <IdentRow label="רמת שיחה" value={manager.call_level} />
              <IdentRow label="תקינות" value={manager.integrity} />
              <IdentRow label="סיכון עיקרי" value={manager.main_risk} />
              <IdentRow
                label="הדרכה"
                value={manager.training_topics?.join(" · ")}
              />
            </dl>
          ) : null}
        </section>
      )}

      {/* §25.9 critical events */}
      <section>
        <h4 className="text-xs font-semibold text-muted-foreground">אירועים קריטיים</h4>
        {critical == null || critical.length === 0 ? (
          <p className="mt-2 rounded-xl bg-background px-3 py-2 text-xs text-muted-foreground">
            לא זוהו אירועים קריטיים
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {critical.map((ev, idx) => (
              <li
                key={`${ev.title}-${idx}`}
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2"
              >
                <p className="font-semibold text-red-800">{ev.title}</p>
                {ev.detail ? (
                  <p className="mt-1 text-xs leading-relaxed text-red-900/80">
                    {ev.detail}
                  </p>
                ) : null}
                {ev.evidence ? (
                  <p className="mt-1 text-[11px] text-red-900/70">ראיה: {ev.evidence}</p>
                ) : null}
                {ev.timestamp_sec != null ? (
                  <p className="mt-0.5 text-[11px] tabular-nums text-red-900/60" dir="ltr">
                    @{ev.timestamp_sec}s
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* §25.7 done well */}
      {doneWell.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold text-muted-foreground">מה בוצע נכון</h4>
          <ul className="mt-2 list-disc space-y-1 pe-4">
            {doneWell.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      {/* §25.8 gaps */}
      {gaps.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold text-muted-foreground">
            מה לא בוצע / חסר
          </h4>
          <ul className="mt-2 space-y-2">
            {gaps.map((gap, idx) => (
              <li key={`${gap.what}-${idx}`} className="rounded-xl bg-background px-3 py-2">
                <p className="font-medium">{gap.what}</p>
                {gap.why_important ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    למה חשוב: {gap.why_important}
                  </p>
                ) : null}
                {gap.should_have ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    מה היה צריך: {gap.should_have}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* §25.10 recommendations */}
      {recommendations.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold text-muted-foreground">
            המלצות לשיפור (עד 5)
          </h4>
          <ol className="mt-2 list-decimal space-y-1 pe-4">
            {recommendations.slice(0, 5).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
        </section>
      )}

      {/* §25.6 full checklist */}
      {checklist.length > 0 && (
        <section className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground">
            צ׳ק־ליסט מלא
          </h4>
          {checklist.map((section) => {
            const sectionTitle =
              section.section_title ||
              getChecklistSectionTitle(section.section_id) ||
              `סעיף ${section.section_id}`;
            return (
              <div
                key={section.section_id}
                className="overflow-hidden rounded-xl border border-black/[0.06]"
              >
                <div className="bg-background px-3 py-2 text-xs font-semibold">
                  {section.section_id}. {sectionTitle}
                </div>
                <ul className="divide-y divide-black/[0.05]">
                  {(section.items ?? []).map((item) => {
                    const title =
                      item.title ||
                      getChecklistItemTitle(item.item_id) ||
                      item.item_id;
                    const status = item.status;
                    return (
                      <li key={item.item_id} className="px-3 py-2.5">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="min-w-0 flex-1 text-xs leading-relaxed">
                            <span className="font-medium tabular-nums" dir="ltr">
                              {item.item_id}
                            </span>{" "}
                            {title}
                          </p>
                          <span
                            className={cn(
                              "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium",
                              statusClass(status),
                            )}
                          >
                            {CHECKLIST_STATUS_LABELS[status] ?? status}
                          </span>
                        </div>
                        {item.severity ? (
                          <p
                            className={cn(
                              "mt-1 text-[11px] font-medium",
                              severityClass(item.severity),
                            )}
                          >
                            חומרה: {FINDING_SEVERITY_LABELS[item.severity]}
                          </p>
                        ) : null}
                        {item.what_happened ? (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            מה קרה: {item.what_happened}
                          </p>
                        ) : null}
                        {item.evidence ? (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            ראיה: {item.evidence}
                          </p>
                        ) : null}
                        {item.should_have ? (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            מה היה צריך: {item.should_have}
                          </p>
                        ) : null}
                        {item.timestamp_sec != null ? (
                          <p
                            className="mt-0.5 text-[11px] tabular-nums text-muted-foreground"
                            dir="ltr"
                          >
                            @{item.timestamp_sec}s
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </section>
      )}

      {!findings && analysis.summary && (
        <p className="text-xs text-muted-foreground">
          הניתוח ללא מבנה צ׳ק־ליסט מלא — מוצג סיכום בלבד.
        </p>
      )}
        </>
      ) : null}
    </div>
  );
}

function ScoreChip({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl px-3 py-2",
        emphasize ? "bg-highlight/30" : "bg-background",
      )}
    >
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}
