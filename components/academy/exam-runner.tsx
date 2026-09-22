"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { startAcademyExam, submitAcademyExam } from "@/app/actions/academy";
import type { AcademyExamResult, AcademyExamView } from "@/lib/academy/types";

export function ExamRunner({ examId, courseId }: { examId: string; courseId?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<AcademyExamView | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<AcademyExamResult | null>(null);

  const current = view?.questions[index] ?? null;
  const remaining = useMemo(() => {
    if (!view) return 0;
    return view.questions.filter((question) => !answers[question.id]).length;
  }, [answers, view]);

  async function start() {
    setLoading(true);
    setError(null);
    const started = await startAcademyExam(examId);
    setLoading(false);
    if (!started.ok) {
      setError(started.error);
      return;
    }
    setView(started.data);
    setAnswers({});
    setIndex(0);
    setResult(null);
  }

  async function submit() {
    if (!view) return;
    setLoading(true);
    setError(null);
    const submitted = await submitAcademyExam(view.attemptId, answers);
    setLoading(false);
    if (!submitted.ok) {
      setError(submitted.error);
      return;
    }
    setResult(submitted.data);
  }

  if (result) {
    return (
      <section className="mx-auto w-full max-w-[42rem] space-y-5">
        <header>
          <h1 className="text-2xl font-semibold">
            {result.passed ? "עברת את המבחן" : "לא עברת עדיין"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            ציון {result.score} · עובר מ־{result.passScore}
          </p>
        </header>
        <div className="space-y-3">
          {result.answers.map((row) => (
            <article
              key={row.questionId}
              className="rounded-2xl border border-black/[0.06] bg-white px-4 py-3 text-sm"
            >
              <p className="font-medium">{row.stem}</p>
              <p className={row.correct ? "mt-2 text-emerald-700" : "mt-2 text-red-700"}>
                {row.correct ? "נכון" : "לא נכון"}
              </p>
              {row.selectedBody ? (
                <p className="mt-1 text-muted-foreground">התשובה שלך: {row.selectedBody}</p>
              ) : null}
              {!row.correct ? (
                <p className="mt-1">התשובה הנכונה: {row.correctBody}</p>
              ) : null}
              <p className="mt-2 text-muted-foreground">{row.explanation}</p>
            </article>
          ))}
        </div>
        <Link
          href={courseId ? `/academy/courses/${courseId}` : "/academy"}
          className="inline-flex h-10 items-center rounded-xl bg-foreground px-4 text-sm font-medium text-white"
        >
          חזרה לקורס
        </Link>
      </section>
    );
  }

  if (!view) {
    return (
      <section className="mx-auto w-full max-w-[42rem] space-y-4">
        <h1 className="text-2xl font-semibold">מבחן קצר</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          שאלות רק על החומר שאושר בשיעורים הפתוחים. אחרי ההגשה יופיעו הסברים.
        </p>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="button"
          onClick={() => void start()}
          disabled={loading}
          className="inline-flex h-10 items-center rounded-xl bg-foreground px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "פותח…" : "התחל מבחן"}
        </button>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-[42rem] space-y-5">
      <header>
        <p className="text-[11px] text-muted-foreground">{view.courseTitle}</p>
        <h1 className="mt-1 text-2xl font-semibold">{view.exam.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          שאלה {index + 1} מתוך {view.questions.length}
          {remaining > 0 ? ` · חסרות ${remaining} תשובות` : " · כל התשובות מולאו"}
        </p>
      </header>

      {current ? (
        <article className="rounded-2xl border border-black/[0.06] bg-white p-5">
          <p className="font-medium leading-relaxed">{current.stem}</p>
          <div className="mt-4 space-y-2">
            {current.options.map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer items-start gap-2 rounded-xl border border-black/[0.06] px-3 py-2 text-sm"
              >
                <input
                  type="radio"
                  name={current.id}
                  checked={answers[current.id] === option.id}
                  onChange={() =>
                    setAnswers((currentAnswers) => ({
                      ...currentAnswers,
                      [current.id]: option.id,
                    }))
                  }
                />
                <span>{option.body}</span>
              </label>
            ))}
          </div>
        </article>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => setIndex((value) => Math.max(0, value - 1))}
          className="rounded-xl border border-black/[0.08] px-3.5 py-2 text-sm disabled:opacity-40"
        >
          הקודם
        </button>
        {index < view.questions.length - 1 ? (
          <button
            type="button"
            onClick={() => setIndex((value) => value + 1)}
            className="rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-white"
          >
            הבא
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={loading || remaining > 0}
          className="rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "שולח…" : remaining > 0 ? `חסרות ${remaining} תשובות` : "הגש מבחן"}
        </button>
      </div>
    </section>
  );
}
