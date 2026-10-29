import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { Panel, ShemeshPage, Stat } from "@/components/shemesh/widgets";
import { CASE_STAGES, ROADMAP, type CaseStageId } from "@/lib/shemesh/catalog";
import { formatShemeshCount, formatShemeshMoney } from "@/lib/shemesh/format";

export function ShemeshOverview({
  stages,
  sold,
  collected,
  deals,
  hasWorkbook,
}: {
  stages: Record<CaseStageId, number>;
  sold: number;
  collected: number;
  deals: number;
  hasWorkbook: boolean;
}) {
  const max = Math.max(1, ...CASE_STAGES.map((stage) => stages[stage.id]));
  return (
    <ShemeshPage
      title="לוח ניהול"
      description="מסלול התיק של שמש, בנפרד מליבה. המספרים מגיעים מגיליון הגבייה כשיש דוח."
      icon={LayoutDashboard}
      stats={
        <>
          <Stat label="עסקאות בדוח" value={hasWorkbook ? formatShemeshCount(deals) : "—"} />
          <Stat label="נמכר" value={hasWorkbook ? formatShemeshMoney(sold) : "—"} />
          <Stat label="נגבה" value={hasWorkbook ? formatShemeshMoney(collected) : "—"} />
          <Stat label="שלבים פעילים" value={formatShemeshCount(CASE_STAGES.filter((stage) => stages[stage.id] > 0).length)} />
        </>
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
        {!hasWorkbook ? (
          <p className="py-3 text-sm text-muted-foreground">
            אין עדיין דוח מכירות שמור. אחרי סנכרון האקסל, כל עסקה נופלת לשלב לפי הסטטוס, החתימה והגבייה.
          </p>
        ) : null}
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {CASE_STAGES.map((stage, index) => (
            <li key={stage.id} className="rounded-2xl border border-black/[0.06] bg-[#f7f9fc] px-3 py-3">
              <p className="text-[11px] text-muted-foreground">{index + 1}</p>
              <p className="mt-1 text-sm font-semibold">{stage.label}</p>
              <p className="mt-2 text-xl font-semibold tabular-nums">{formatShemeshCount(stages[stage.id])}</p>
              <div className="mt-2 h-1 rounded-full bg-black/[0.06]">
                <div className="h-1 rounded-full bg-[#185A94]" style={{ width: `${(stages[stage.id] / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      </Panel>
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
            <li key={item.stage} className="rounded-xl border border-dashed border-black/10 px-3 py-3">
              <p className="text-[11px] font-medium text-muted-foreground">שלב {item.stage} · בקרוב</p>
              <p className="mt-1 text-sm font-semibold">{item.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
            </li>
          ))}
        </ul>
      </Panel>
    </ShemeshPage>
  );
}
