import { Wallet } from "lucide-react";
import { ShemeshEmpty } from "@/components/shemesh/empty-state";
import { Panel, ShemeshPage, Stat } from "@/components/shemesh/widgets";
import { formatShemeshCount, formatShemeshDay, formatShemeshMoney } from "@/lib/shemesh/format";
import type { ShemeshLibaSettlement } from "@/lib/shemesh/liba-settlement";

const EMPTY_VIEW: ShemeshLibaSettlement = {
  missing: true,
  error: null,
  sales: [],
  premium: 0,
  owed: null,
};

export function SettlementScreen({ view = EMPTY_VIEW }: { view?: ShemeshLibaSettlement }) {
  const hasSales = view.sales.length > 0 && !view.missing && !view.error;
  return (
    <ShemeshPage
      title="התחשבנות מול ליבה"
      description="שמש וליבה הן עסקים נפרדים עם אותם בעלים. שמש מוכרת ביטוח דרך ליבה כעצמאי. המכירות והסכום שמגיע לשמש נגזרים משורת שמש בדוח המכירות של ליבה, באותו חישוב כמו לכל עצמאי."
      icon={Wallet}
      stats={
        hasSales ? (
          <>
            <Stat label="שורות" value={formatShemeshCount(view.sales.length)} />
            <Stat label="פרמיה" value={formatShemeshMoney(view.premium)} />
            <Stat
              label="לתשלום לשמש"
              value={formatShemeshMoney(view.owed)}
              hint={
                view.owed == null
                  ? "אין הסכם עצמאי שמור על שם שמש. כשיוגדר בכרטיס העובד, הסכום יחושב כמו לכל עצמאי."
                  : "לפי ההסכם השמור, אותו חישוב כמו לכל עצמאי."
              }
            />
          </>
        ) : null
      }
    >
      {hasSales ? (
        <Panel title="מכירות ביטוח דרך ליבה">
          <ul className="max-h-96 divide-y divide-black/[0.04] overflow-auto text-sm">
            {view.sales.slice(0, 80).map((row) => (
              <li key={row.id} className="grid gap-1 py-2 sm:grid-cols-[1.4fr_1fr_auto] sm:items-center">
                <span className="truncate font-medium">{row.client || "בלי שם"}</span>
                <span className="truncate text-muted-foreground">
                  {[row.company, row.product, row.process, row.status].filter(Boolean).join(" · ")}
                </span>
                <span className="tabular-nums">
                  {formatShemeshDay(row.transferDate)} · {formatShemeshMoney(row.premium)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : (
        <ShemeshEmpty
          icon={Wallet}
          title={
            view.error
              ? "דוח המכירות לא נקרא"
              : view.missing
                ? "דוח המכירות של ליבה לא זמין"
                : "אין לשמש שורות בדוח של ליבה"
          }
          body={
            view.error
              ? view.error
              : view.missing
                ? "הצילום השמור של דוח המנהלים חסר. אחרי סנכרון המערכת יופיעו כאן מכירות הביטוח של שמש והסכום שמגיע לה. אין סכום קבוע בקוד."
                : "כשתופיע שורה עם המשווק שמש, היא תיכנס לכאן כמו כל עצמאי, והתשלום יחושב מההסכם השמור. אין סכום קבוע בקוד."
          }
        />
      )}
    </ShemeshPage>
  );
}
