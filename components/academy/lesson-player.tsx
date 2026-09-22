"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  checkAcademyLessonQuestion,
  completeAcademyLesson,
} from "@/app/actions/academy";
import type {
  AcademyBlock,
  AcademyLessonCheck,
  AcademyLessonDetail,
} from "@/lib/academy/types";

type Beat =
  | { type: "block"; block: AcademyBlock }
  | { type: "check"; question: AcademyLessonCheck }
  | { type: "close" };

function buildBeats(blocks: AcademyBlock[], checks: AcademyLessonCheck[]): Beat[] {
  const leftover = [...checks];
  const beats: Beat[] = [];
  for (const block of blocks) {
    beats.push({ type: "block", block });
    if (block.kind !== "todo" && leftover.length > 0) {
      beats.push({ type: "check", question: leftover.shift()! });
    }
  }
  beats.push({ type: "close" });
  return beats;
}

export function LessonPlayer({ data }: { data: AcademyLessonDetail }) {
  const router = useRouter();
  const beats = useMemo(
    () => buildBeats(data.blocks, data.checks),
    [data.blocks, data.checks],
  );
  const [index, setIndex] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<{
    correct: boolean;
    explanation: string;
    correctBody: string;
    correctOptionId: string | null;
  } | null>(null);
  const [closed, setClosed] = useState(data.completed);

  const beat = beats[index] ?? beats[beats.length - 1];
  const lastIndex = beats.length - 1;

  function nextHref() {
    if (data.nextLesson) return `/academy/lessons/${data.nextLesson.id}`;
    if (data.exam) return `/academy/exams/${data.exam.id}`;
    return `/academy/courses/${data.course.id}`;
  }

  async function finishShift() {
    if (closed || data.completed) {
      router.push(nextHref());
      return;
    }
    setPending(true);
    setError(null);
    const result = await completeAcademyLesson(data.lesson.id);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setClosed(true);
    router.push(nextHref());
  }

  async function submitCheck() {
    if (beat.type !== "check" || !selectedId) return;
    setPending(true);
    setError(null);
    const result = await checkAcademyLessonQuestion(beat.question.id, selectedId);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCheckResult(result.data);
  }

  function goForward() {
    setSelectedId(null);
    setCheckResult(null);
    setError(null);
    setIndex((value) => Math.min(lastIndex, value + 1));
  }

  return (
    <section className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-[36rem] flex-col">
      <header className="dash-enter pb-4">
        <p className="text-[11px] text-muted-foreground">{data.course.title}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{data.lesson.title}</h1>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            פעימה {Math.min(index + 1, beats.length)} מתוך {beats.length}
            {data.completed || closed ? " · הושלם" : ""}
          </p>
          <p className="text-sm tabular-nums text-muted-foreground">
            כ־{data.lesson.estimatedMinutes} דק׳
          </p>
        </div>
        <div className="mt-2 flex gap-1">
          {beats.map((item, beatIndex) => (
            <span
              key={`${item.type}-${beatIndex}`}
              className={
                beatIndex <= index
                  ? "h-1 flex-1 rounded-full bg-foreground"
                  : "h-1 flex-1 rounded-full bg-black/[0.08]"
              }
            />
          ))}
        </div>
      </header>

      <div className="dash-enter flex-1">
        {data.blocks.length === 0 && beat.type === "close" ? (
          <p className="text-sm text-muted-foreground">אין תוכן בשיעור הזה עדיין.</p>
        ) : null}

        {beat.type === "block" ? <BlockBeat block={beat.block} /> : null}

        {beat.type === "check" ? (
          <CheckBeat
            question={beat.question}
            selectedId={selectedId}
            result={checkResult}
            pending={pending}
            onSelect={setSelectedId}
            onSubmit={() => void submitCheck()}
          />
        ) : null}

        {beat.type === "close" ? (
          <CloseBeat
            lessonTitle={data.lesson.title}
            nextTitle={
              data.nextLesson?.title ??
              (data.exam ? data.exam.title : "חזרה לקורס")
            }
            nextMinutes={data.nextLesson?.estimatedMinutes ?? null}
            examReady={!data.nextLesson && Boolean(data.exam)}
          />
        ) : null}

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </div>

      <div className="sticky bottom-0 mt-6 flex flex-wrap items-center gap-2 bg-background py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {index === 0 ? (
          <Link
            href={
              data.prevLesson
                ? `/academy/lessons/${data.prevLesson.id}`
                : `/academy/courses/${data.course.id}`
            }
            className="rounded-xl border border-black/[0.08] px-3.5 py-2 text-sm"
          >
            {data.prevLesson ? "הקודם" : "לקורס"}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => {
              setSelectedId(null);
              setCheckResult(null);
              setIndex((value) => Math.max(0, value - 1));
            }}
            className="rounded-xl border border-black/[0.08] px-3.5 py-2 text-sm"
          >
            חזרה
          </button>
        )}

        {beat.type === "block" ? (
          <button
            type="button"
            onClick={goForward}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-foreground px-4 text-sm font-medium text-white"
          >
            המשך
          </button>
        ) : null}

        {beat.type === "check" && checkResult ? (
          <button
            type="button"
            onClick={goForward}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-foreground px-4 text-sm font-medium text-white"
          >
            המשך
          </button>
        ) : null}

        {beat.type === "close" ? (
          <button
            type="button"
            onClick={() => void finishShift()}
            disabled={pending}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-foreground px-4 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending
              ? "שומר…"
              : closed || data.completed
                ? data.nextLesson
                  ? "למשמרת הבאה"
                  : data.exam
                    ? "למבחן"
                    : "לקורס"
                : "סיום משמרת"}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function BlockBeat({ block }: { block: AcademyBlock }) {
  if (block.kind === "todo") {
    return (
      <article className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-6">
        <p className="text-[11px] font-semibold tracking-wide text-amber-800">
          נדרש תוכן מקצועי
        </p>
        <p className="mt-3 text-lg leading-relaxed">{block.body}</p>
        <p className="mt-4 text-sm text-amber-900/80">
          אין כאן הגדרה מאושרת. לא מסתמכים על זה מול לקוח.
        </p>
      </article>
    );
  }

  return (
    <article
      className={
        block.kind === "callout"
          ? "rounded-3xl bg-black/[0.04] px-5 py-6"
          : "rounded-3xl bg-white px-1 py-2"
      }
    >
      {block.kind === "callout" ? (
        <p className="text-[11px] font-medium text-muted-foreground">חשוב</p>
      ) : null}
      <p className="mt-2 text-lg leading-relaxed whitespace-pre-line">{block.body}</p>
    </article>
  );
}

function CheckBeat({
  question,
  selectedId,
  result,
  pending,
  onSelect,
  onSubmit,
}: {
  question: AcademyLessonCheck;
  selectedId: string | null;
  result: {
    correct: boolean;
    explanation: string;
    correctBody: string;
    correctOptionId: string | null;
  } | null;
  pending: boolean;
  onSelect: (id: string) => void;
  onSubmit: () => void;
}) {
  return (
    <article>
      <p className="text-[11px] font-medium text-muted-foreground">בדיקה קצרה</p>
      <p className="mt-2 text-lg font-medium leading-relaxed">{question.stem}</p>
      <div className="mt-5 space-y-2">
        {question.options.map((option) => {
          const chosen = selectedId === option.id;
          const isRight = Boolean(result) && option.id === result?.correctOptionId;
          return (
            <button
              key={option.id}
              type="button"
              disabled={Boolean(result)}
              onClick={() => onSelect(option.id)}
              className={
                isRight
                  ? "w-full rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-right text-sm"
                  : chosen && result && !result.correct
                    ? "w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-right text-sm"
                    : chosen
                      ? "w-full rounded-2xl border border-foreground bg-white px-4 py-3 text-right text-sm"
                      : "w-full rounded-2xl border border-black/[0.08] bg-white px-4 py-3 text-right text-sm"
              }
            >
              {option.body}
            </button>
          );
        })}
      </div>
      {result ? (
        <div className="mt-4 text-sm leading-relaxed">
          <p className={result.correct ? "font-medium text-emerald-800" : "font-medium text-red-700"}>
            {result.correct ? "נכון" : "לא מדויק"}
          </p>
          {!result.correct ? (
            <p className="mt-1 text-muted-foreground">התשובה המאושרת: {result.correctBody}</p>
          ) : null}
          <p className="mt-2 text-muted-foreground">{result.explanation}</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={onSubmit}
          disabled={!selectedId || pending}
          className="mt-5 inline-flex h-10 items-center rounded-xl bg-foreground px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "בודק…" : "בדיקה"}
        </button>
      )}
    </article>
  );
}

function CloseBeat({
  lessonTitle,
  nextTitle,
  nextMinutes,
  examReady,
}: {
  lessonTitle: string;
  nextTitle: string;
  nextMinutes: number | null;
  examReady: boolean;
}) {
  return (
    <article className="rounded-3xl bg-white py-4">
      <p className="text-[11px] font-medium text-muted-foreground">המשמרת הסתיימה</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight">{lessonTitle}</h2>
      <p className="mt-4 text-sm text-muted-foreground">
        {examReady ? "השיעורים הפתוחים מאחוריך. אפשר לעבור למבחן הקצר." : "התחנה הבאה:"}
      </p>
      <p className="mt-1 text-lg font-medium">{nextTitle}</p>
      {nextMinutes != null ? (
        <p className="mt-1 text-sm text-muted-foreground">כ־{nextMinutes} דקות</p>
      ) : null}
    </article>
  );
}
