import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { Panel, ShemeshPage, Stat } from "@/components/shemesh/widgets";
import { CASE_STAGES, ROADMAP, type CaseStageId } from "@/lib/shemesh/catalog";
import { formatShemeshCount, formatShemeshMoney } from "@/lib/shemesh/format";
import type { ShemeshBooks } from "@/lib/shemesh/story";

export function ShemeshOverview({
  stages,
  sold,
  collected,
  deals,
  hasWorkbook,
  books = null,
}: {
  stages: Record<CaseStageId, number>;
  sold: number;
  collected: number;
  deals: number;
  hasWorkbook: boolean;
  books?: ShemeshBooks | null;
}) {
  const live = books && !books.missing ? books : null;
  const stageMap = live ? live.stageCounts : stages;
  const max = Math.max(1, ...CASE_STAGES.map((stage) => stageMap[stage.id]));
  return (
    <ShemeshPage
      title="לוח ניהול"
      description="מסלול התיק של שמש, בנפרד מליבה. הנגבה הוא הנטו שסומן כנגבה בספר, והוא זהה לכלל ההכנסה החודשי. עמלת הרישיון נשארת אצל ליבה."
      icon={LayoutDashboard}
      stats={
        live ? (
          <>
            <Stat label="תיקים פתוחים" value={formatShemeshCount(live.openCases)} hint="כולל ממתינים, בלי תיק שנגבה" />
            <Stat label="חריגות SLA" value={formatShemeshCount(live.overdueCases)} />
            <Stat label="נגבה" value={formatShemeshMoney(live.collectedNet)} hint={live.incomeMatchesCollected ? "שווה לכלל ההכנסה החודשי" : "שונה מכלל ההכנסה"} />
            <Stat label="פדיון פתוח" value={formatShemeshMoney(live.openRedemptionGross)} hint="עדיין לא נכנס לנגבה" />
          </>
        ) : (
          <>
            <Stat label="עסקאות בדוח" value={hasWorkbook ? formatShemeshCount(deals) : "—"} />
            <Stat label="נמכר" value={hasWorkbook ? formatShemeshMoney(sold) : "—"} />
            <Stat label="נגבה" value={hasWorkbook ? formatShemeshMoney(collected) : "—"} />
            <Stat label="שלבים פעילים" value={formatShemeshCount(CASE_STAGES.filter((stage) => stages[stage.id] > 0).length)} />
          </>
        )
      }
    >
      <Panel
        title="מסלול תיק"
        action={
          <Link href="/shemesh/gviya" className="text-xs font-medium text-muted-foreground hover:text-foreground">
            לדשבורד הפדיונות
          </Link>
        }
      >
        {!live && !hasWorkbook ? (
          <p className="py-3 text-sm text-muted-foreground">
            אין עדיין תיקים שמורים ואין דוח מכירות. אחרי המיגרציה, השלבים נספרים מהתיקים.
          </p>
        ) : null}
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {CASE_STAGES.map((stage, index) => (
            <li key={stage.id} className="rounded-2xl border border-border bg-muted px-3 py-3">
              <p className="text-[11px] text-muted-foreground">{index + 1}</p>
              <p className="mt-1 text-sm font-semibold">{stage.label}</p>
              <p className="mt-2 text-xl font-semibold tabular-nums">{formatShemeshCount(stageMap[stage.id])}</p>
              <div className="mt-2 h-1 rounded-full bg-black/[0.06]">
                <div className="h-1 rounded-full bg-highlight" style={{ width: `${(stageMap[stage.id] / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      </Panel>
      {live ? (
        <Panel title="אותו חודש, אותם ספרים">
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between gap-3"><span>נגבה, נטו</span><span className="tabular-nums">{formatShemeshMoney(live.collectedNet)}</span></li>
            <li className="flex justify-between gap-3"><span>כלל הכנסה חודשי</span><span className="tabular-nums">{formatShemeshMoney(live.monthIncome)}</span></li>
            <li className="flex justify-between gap-3"><span>החזר מס ממתין, נטו</span><span className="tabular-nums">{formatShemeshMoney(live.waitingTaxNet)}</span></li>
            <li className="flex justify-between gap-3"><span>עמלת רישיון של ליבה</span><span className="tabular-nums">{formatShemeshMoney(live.licenseCommission)}</span></li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">עמלת הרישיון לא נכנסת לנגבה של שמש ולא לשכר. פדיון שטרם נגבה נשאר מחוץ לשורה.</p>
        </Panel>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-3">
        <Link href="/shemesh/gviya" className="app-surface block px-5 py-4 hover:bg-black/[0.02]">
          <p className="text-sm font-semibold">פדיונות וגבייה</p>
          <p className="mt-1 text-xs text-muted-foreground">GVIYA, נציגים, מקורות והצלבה מול שורנס</p>
        </Link>
        <Link href="/shemesh/tax-refunds" className="app-surface block px-5 py-4 hover:bg-black/[0.02]">
          <p className="text-sm font-semibold">החזרי מס</p>
          <p className="mt-1 text-xs text-muted-foreground">דוח שהועלה, צינור וסכומים</p>
        </Link>
        <Link href="/shemesh/marketing" className="app-surface block px-5 py-4 hover:bg-black/[0.02]">
          <p className="text-sm font-semibold">שיווק</p>
          <p className="mt-1 text-xs text-muted-foreground">חשבון המודעות של שמש, קמפיין ומודעה</p>
        </Link>
      </div>
      <Panel title="בהמשך">
        <ul className="grid gap-2 sm:grid-cols-2">
          {ROADMAP.map((item) => (
            <li key={item.stage}>
              {item.href ? (
                <Link href={item.href} className="block rounded-xl border border-black/[0.06] px-3 py-3 hover:bg-black/[0.02]">
                  <RoadmapCopy item={item} />
                </Link>
              ) : (
                <div className="rounded-xl border border-dashed border-black/10 px-3 py-3">
                  <RoadmapCopy item={item} soon />
                </div>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </ShemeshPage>
  );
}

function RoadmapCopy({
  item,
  soon,
}: {
  item: { stage: string; title: string; detail: string };
  soon?: boolean;
}) {
  return (
    <>
      <p className="text-[11px] font-medium text-muted-foreground">
        שלב {item.stage}
        {soon ? " · בקרוב" : ""}
      </p>
      <p className="mt-1 text-sm font-semibold">{item.title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
    </>
  );
}
