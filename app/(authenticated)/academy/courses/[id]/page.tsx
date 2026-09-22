import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAcademyCourse } from "@/app/actions/academy";
import { AcademyPath } from "@/components/academy/academy-path";
import { requireAcademyLearn } from "@/lib/auth";

export const metadata: Metadata = { title: "קורס" };
export const dynamic = "force-dynamic";

export default async function AcademyCoursePage({
  params,
}: {
  params: { id: string };
}) {
  await requireAcademyLearn();
  const result = await getAcademyCourse(params.id);
  if (!result.ok) {
    if (result.error === "הקורס לא נמצא") notFound();
    return <p className="text-sm text-red-600">{result.error}</p>;
  }
  const { data } = result;
  const next = data.lessons.find((lesson) => !lesson.completed);

  return (
    <section className="mx-auto w-full max-w-[36rem] space-y-8">
      <header>
        <p className="text-[11px] text-muted-foreground">{data.trackTitle}</p>
        <h1 className="mt-2 text-[1.75rem] font-semibold leading-tight tracking-tight">
          {data.course.title}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {data.percent}% · {data.completedCount}/{data.lessons.length}
        </p>
      </header>

      {next ? (
        <div>
          <p className="text-[11px] font-medium text-muted-foreground">המשמרת הבאה</p>
          <p className="mt-2 text-xl font-semibold">{next.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">כ־{next.estimatedMinutes} דקות</p>
          <Link
            href={`/academy/lessons/${next.id}`}
            className="mt-5 inline-flex h-12 items-center rounded-2xl bg-foreground px-6 text-sm font-medium text-white"
          >
            התחל משמרת
          </Link>
        </div>
      ) : data.exam ? (
        <Link
          href={`/academy/exams/${data.exam.id}`}
          className="inline-flex h-12 items-center rounded-2xl bg-foreground px-6 text-sm font-medium text-white"
        >
          למבחן
        </Link>
      ) : null}

      {data.lessons.length === 0 ? (
        <p className="text-sm text-muted-foreground">אין שיעורים מאושרים בקורס הזה.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-[11px] font-medium text-muted-foreground">תחנות</p>
          <AcademyPath
            stations={data.lessons.map((lesson) => ({
              id: lesson.id,
              title: lesson.title,
              estimatedMinutes: lesson.estimatedMinutes,
              completed: lesson.completed,
            }))}
            currentId={next?.id}
          />
        </div>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">{data.course.description}</p>
    </section>
  );
}
