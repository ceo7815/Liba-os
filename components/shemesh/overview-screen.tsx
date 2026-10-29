import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { Panel, ShemeshPage, Stat } from "@/components/shemesh/widgets";
import { CASE_STAGES, ROADMAP, type CaseStageId } from "@/lib/shemesh/catalog";
import { formatShemeshCount, formatShemeshMoney, formatShemeshMonth } from "@/lib/shemesh/format";
import { SHEMESH_SALES_SOURCE_LABEL } from "@/lib/shemesh/sales-source";
import type { WorkbookMonthSales } from "@/lib/shemesh/sales-source";
import type { ShemeshBooks } from "@/lib/shemesh/story";

export function ShemeshOverview({
  stages,
  hasWorkbook,
  sales,
  books = null,
}: {
  stages: Record<CaseStageId, number>;
  hasWorkbook: boolean;
  sales: WorkbookMonthSales;
  books?: ShemeshBooks | null;
}) {
  const live = books && !books.missing ? books : null;
  const max = Math.max(1, ...CASE_STAGES.map((stage) => stages[stage.id]));
  return (
    <ShemeshPage
      title="לוח ניהול"
      description={`מכירות שמש נקראות רק מ־${SHEMESH_SALES_SOURCE_LABEL}. לא מדוח המנהלים של ליבה.`}
      icon={LayoutDashboard}
      stats={
        <>
          <Stat label={`נמכר ${formatShemeshMonth(sales.month)}`} value={hasWorkbook ? formatShemeshMoney(sales.sold) : "—"} hint="לפי תאריך עסקה בדוח שמש" />
          <Stat label="נגבה בדוח" value={hasWorkbook ? formatShemeshMoney(sales.collected) : "—"} hint="גיליון הגבייה של שמש" />
          <Stat label="עסקאות" value={hasWorkbook ? formatShemeshCount(sales.count) : "—"} />
          <Stat label="עסקה עד חשבונית" value={!hasWorkbook || sales.cycleDays == null ? "—" : `${formatShemeshCount(sales.cycleDays)} ימים`} />
        </>
      }
    >
      <Panel
        title="מסלול בדוח המכירות"
        action={
          <Link href="/shemesh/gviya" className="text-xs font-medium text-muted-foreground hover:text-foreground">
            לדשבורד הפדיונות
          </Link>
        }
      >
        {!hasWorkbook ? (
          <p className="py-3 text-sm text-muted-foreground">
            אין עדיין ייבוא של דוח המכירות של שמש. השלבים והסכומים יופיעו רק אחרי שהקובץ נשמר בנפרד מדוח ליבה.
          </p>
        ) : null}
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {CASE_STAGES.map((stage, index) => (
            <li key={stage.id} className="glass px-3 py-3">
              <p className="text-[11px] text-muted-foreground">{index + 1}</p>
              <p className="mt-1 text-sm font-semibold">{stage.label}</p>
              <p className="mt-2 text-xl font-semibold tabular-nums">{formatShemeshCount(stages[stage.id])}</p>
              <div className="mt-2 h-1.5 rounded-full bg-white/70">
                <div
                  className="h-1.5 rounded-full"
                  style={{
                    width: `${(stages[stage.id] / max) * 100}%`,
                    background: "linear-gradient(90deg, #9fd0ff, #2f86ea)",
                  }}
                />
              </div>
            </li>
          ))}
        </ol>
      </Panel>
      {live ? (
        <Panel title="תיקים וספר, לא דוח המכירות">
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between gap-3"><span>תיקים פתוחים</span><span className="tabular-nums">{formatShemeshCount(live.openCases)}</span></li>
            <li className="flex justify-between gap-3"><span>חריגות SLA</span><span className="tabular-nums">{formatShemeshCount(live.overdueCases)}</span></li>
            <li className="flex justify-between gap-3"><span>שכר טרחה שנגבה בספר</span><span className="tabular-nums">{formatShemeshMoney(live.collectedNet)}</span></li>
            <li className="flex justify-between gap-3"><span>עמלת רישיון של ליבה</span><span className="tabular-nums">{formatShemeshMoney(live.licenseCommission)}</span></li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">הספר הוא תפעול. מכירות, גבייה ומחזור נקראים רק מדוח שמש.</p>
        </Panel>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/shemesh/gviya" className="glass block px-5 py-4 hover:bg-white/80">
          <p className="text-sm font-semibold">פדיונות וגבייה</p>
          <p className="mt-1 text-xs text-muted-foreground">GVIYA, נציגים, מקורות והצלבה מול שורנס</p>
        </Link>
        <Link href="/shemesh/tax-refunds" className="glass block px-5 py-4 hover:bg-white/80">
          <p className="text-sm font-semibold">החזרי מס</p>
          <p className="mt-1 text-xs text-muted-foreground">דוח שהועלה, צינור וסכומים</p>
        </Link>
        <Link href="/shemesh/marketing" className="glass block px-5 py-4 hover:bg-white/80">
          <p className="text-sm font-semibold">שיווק</p>
          <p className="mt-1 text-xs text-muted-foreground">חשבון המודעות של שמש, קמפיין ומודעה</p>
        </Link>
        <Link href="/shemesh/alerts" className="glass block px-5 py-4 hover:bg-white/80">
          <p className="text-sm font-semibold">התראות</p>
          <p className="mt-1 text-xs text-muted-foreground">חריגות SLA, מסמכים חסרים ויעדים</p>
        </Link>
      </div>
      <Panel title="בהמשך">
        <ul className="grid gap-2 sm:grid-cols-2">
          {ROADMAP.map((item) => (
            <li key={item.stage}>
              {item.href ? (
                <Link href={item.href} className="block rounded-xl border border-border px-3 py-3 hover:bg-muted">
                  <RoadmapCopy item={item} />
                </Link>
              ) : (
                <div className="rounded-xl border border-dashed border-border px-3 py-3">
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
