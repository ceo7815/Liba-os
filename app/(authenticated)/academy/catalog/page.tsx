import type { Metadata } from "next";
import Link from "next/link";
import { listAcademyCatalog } from "@/app/actions/academy";
import { requireAcademyLearn } from "@/lib/auth";

export const metadata: Metadata = { title: "קטלוג הדרכה" };
export const dynamic = "force-dynamic";

export default async function AcademyCatalogPage() {
  await requireAcademyLearn();
  const result = await listAcademyCatalog();
  if (!result.ok) return <p className="text-sm text-red-600">{result.error}</p>;

  return (
    <section className="mx-auto w-full max-w-[46rem] space-y-5">
      <header>
        <p className="text-[11px] text-muted-foreground">הדרכה</p>
        <h1 className="mt-1 text-2xl font-semibold">קטלוג קורסים</h1>
      </header>
      <div className="space-y-3">
        {result.courses.length === 0 ? (
          <p className="rounded-2xl border border-black/[0.06] bg-white p-5 text-sm text-muted-foreground">
            אין עדיין קורס מאושר.
          </p>
        ) : (
          result.courses.map((course) => (
            <Link
              key={course.id}
              href={`/academy/courses/${course.id}`}
              className="block rounded-2xl border border-black/[0.06] bg-white p-5"
            >
              <p className="text-[11px] text-muted-foreground">{course.trackTitle}</p>
              <h2 className="mt-1 text-lg font-semibold">{course.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{course.description}</p>
              <p className="mt-3 text-sm tabular-nums">
                {course.percent}% · {course.completedCount}/{course.lessonCount}
              </p>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
