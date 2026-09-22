import Link from "next/link";
import { AcademyPath } from "@/components/academy/academy-path";
import type { AcademyDashboard } from "@/lib/academy/types";

export function AcademyDashboardScreen({ data }: { data: AcademyDashboard }) {
  const nextHref = data.nextLesson
    ? `/academy/lessons/${data.nextLesson.id}`
    : data.exam
      ? `/academy/exams/${data.exam.id}`
      : "/academy/catalog";
  const currentId = data.nextLesson?.id ?? null;

  return (
    <section className="mx-auto w-full max-w-[36rem] space-y-8">
      <header className="dash-enter px-0.5">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground">
          הדרכה · משמרת
        </p>
        <h1 className="mt-2 text-[2rem] font-semibold leading-none tracking-tight">
          {data.firstName}
        </h1>
      </header>

      <div className="dash-enter">
        {!data.canLearn ? (
          <p className="text-sm text-muted-foreground">
            אין הרשאת למידה. אפשר לפתוח צוות או ניהול תוכן אם יש לך הרשאה.
          </p>
        ) : data.nextLesson ? (
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">המשמרת הבאה</p>
            <h2 className="mt-2 text-[1.75rem] font-semibold leading-tight tracking-tight">
              {data.nextLesson.title}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              כ־{data.nextLesson.estimatedMinutes} דקות · {data.completedCount}/
              {data.lessonCount}
            </p>
            <Link
              href={nextHref}
              className="mt-6 inline-flex h-12 items-center justify-center rounded-2xl bg-foreground px-6 text-sm font-medium text-white"
            >
              התחל משמרת
            </Link>
          </div>
        ) : data.exam ? (
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">המשמרת הבאה</p>
            <h2 className="mt-2 text-[1.75rem] font-semibold leading-tight tracking-tight">
              {data.exam.title}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              ציון עובר {data.exam.passScore}
              {data.lastScore != null
                ? ` · אחרון ${data.lastScore}${data.lastPassed ? " עבר" : " לא עבר"}`
                : ""}
            </p>
            <Link
              href={`/academy/exams/${data.exam.id}`}
              className="mt-6 inline-flex h-12 items-center justify-center rounded-2xl bg-foreground px-6 text-sm font-medium text-white"
            >
              התחל מבחן
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">אין משמרת פתוחה כרגע.</p>
        )}
      </div>

      {data.canLearn && data.stations.length > 0 ? (
        <div className="dash-enter space-y-3">
          <p className="text-[11px] font-medium text-muted-foreground">
            המסלול · {data.percent}%
          </p>
          <AcademyPath stations={data.stations} currentId={currentId} />
        </div>
      ) : null}

      <p className="dash-enter text-xs leading-relaxed text-muted-foreground">
        הדרכה פנימית לסוכנות. אינה תחליף לרישיון רשות שוק ההון.
      </p>

      <div className="dash-enter flex flex-wrap gap-2">
        {data.course ? (
          <Link
            href={`/academy/courses/${data.course.id}`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            כל התחנות
          </Link>
        ) : null}
        {data.canViewTeam ? (
          <Link
            href="/academy/team"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            צוות
          </Link>
        ) : null}
        {data.canManage ? (
          <Link
            href="/academy/manage"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ניהול
          </Link>
        ) : null}
      </div>
    </section>
  );
}
