import type { Metadata } from "next";
import { getAcademyTeamProgress } from "@/app/actions/academy";
import { requireAcademyTeam } from "@/lib/auth";

export const metadata: Metadata = { title: "התקדמות צוות" };
export const dynamic = "force-dynamic";

export default async function AcademyTeamPage() {
  await requireAcademyTeam();
  const result = await getAcademyTeamProgress();
  if (!result.ok) return <p className="text-sm text-red-600">{result.error}</p>;

  return (
    <section className="mx-auto w-full max-w-[52rem] space-y-5">
      <header>
        <p className="text-[11px] text-muted-foreground">הדרכה</p>
        <h1 className="mt-1 text-2xl font-semibold">התקדמות צוות</h1>
      </header>
      <div className="overflow-x-auto rounded-2xl border border-black/[0.06] bg-white">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-black/[0.06] text-right text-[11px] text-muted-foreground">
              <th className="px-3 py-2 font-medium">עובד</th>
              <th className="px-3 py-2 font-medium">התקדמות</th>
              <th className="px-3 py-2 font-medium">ציון אחרון</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-sm text-muted-foreground">
                  אין עדיין לומדים עם הרשאת הדרכה.
                </td>
              </tr>
            ) : null}
            {result.rows.map((row) => (
              <tr key={row.profileId} className="border-b border-black/[0.04]">
                <td className="px-3 py-2.5">
                  <p className="font-medium">{row.fullName}</p>
                  <p className="text-xs text-muted-foreground">{row.email}</p>
                </td>
                <td className="px-3 py-2.5 tabular-nums">
                  {row.percent}% · {row.completedCount}/{row.lessonCount}
                </td>
                <td className="px-3 py-2.5 tabular-nums">
                  {row.lastScore == null
                    ? "—"
                    : `${row.lastScore}${row.lastPassed ? " · עבר" : " · לא עבר"}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
