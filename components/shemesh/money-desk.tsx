import { ShemeshDesk } from "@/components/shemesh/desk";
import { field } from "@/lib/shemesh/field";
import { Panel } from "@/components/shemesh/widgets";
import { createShemeshRule, setShemeshRuleActive } from "@/app/actions/shemesh-ops";
import { formatShemeshMoney } from "@/lib/shemesh/format";
import { loadMonthView } from "@/lib/shemesh/ops";

const TITLES: Record<string, { title: string; description: string }> = {
  cost: { title: "הוצאות קבועות", description: "כלל חוזר וסכום שנשמרים במסד. תצוגת החודש נגזרת מהכללים הפעילים." },
  debt: { title: "חובות", description: "חוב או הלוואה כרשומה, עם תשלום חודשי אם הוגדר. אין סכום קבוע בקוד." },
  income: { title: "הכנסות", description: "הכנסה חוזרת או חד־פעמית. החודש מציג רק כללים פעילים שנכנסו לתוקף." },
  payroll: { title: "שכר", description: "רשומת שכר לפי שם וסכום שהוזנו. אין שיעור או שם שכר בקוד." },
  commission: { title: "עמלות", description: "עמלת נציג כרשומה חודשית. השיעור נשמר על הרשומה, לא בקוד." },
};

export async function MoneyDesk({ kind, month }: { kind: string; month: string }) {
  const view = await loadMonthView(kind, month);
  const copy = TITLES[kind] ?? TITLES.cost;
  const total = view.monthRows.reduce((sum, row) => sum + (row.amount ?? 0), 0);
  return (
    <div className="space-y-3">
      <ShemeshDesk
        title={copy.title}
        description={copy.description}
        rows={view.rows}
        missing={view.missing}
        error={view.error}
        audit={view.audit}
        exportKind={`rules:${kind}`}
        createAction={createShemeshRule}
        statusAction={setShemeshRuleActive}
      >
        <input type="hidden" name="kind" value={kind} />
        <input className={field} name="title" placeholder="כותרת" required />
        <input className={field} name="amount" inputMode="decimal" placeholder="סכום" />
        <select className={field} name="cadence" defaultValue="monthly" aria-label="תדירות">
          <option value="monthly">חודשי</option>
          <option value="once">פעם אחת</option>
        </select>
        <input className={field} name="dayOfMonth" inputMode="numeric" placeholder="יום בחודש, 1–28" />
        <input className={field} name="startsOn" type="date" aria-label="מתאריך" />
        <input className={field} name="notes" placeholder="הערה" />
      </ShemeshDesk>
      {!view.missing && !view.error ? (
        <Panel title={`חודש ${month}`}>
          <p className="text-sm">סה״כ {view.monthRows.length ? formatShemeshMoney(total) : "—"}</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {view.monthRows.map((row) => (
              <li key={row.ruleId}>{row.title} · {row.amount == null ? "—" : formatShemeshMoney(row.amount)}</li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
