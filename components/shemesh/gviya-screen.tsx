"use client";

import { useMemo, useState } from "react";
import { BadgeDollarSign, FileSpreadsheet } from "lucide-react";
import { ShemeshEmpty } from "@/components/shemesh/empty-state";
import { Panel, ShemeshPage, Stat } from "@/components/shemesh/widgets";
import { formatShemeshCount, formatShemeshDay, formatShemeshMoney, formatShemeshMonth } from "@/lib/shemesh/format";
import {
  currentMonthKey,
  filterDeals,
  groupDeals,
  gviyaKpis,
  monthlyTrend,
  type GviyaDeal,
  type SheetContact,
} from "@/lib/shemesh/gviya";
import { CASE_STAGES } from "@/lib/shemesh/catalog";

type MatchFlag = "matched" | "unmatched" | "unchecked";

type Deal = GviyaDeal & { surense: MatchFlag };
type Contact = SheetContact & { surense: MatchFlag };

const select =
  "h-9 rounded-xl border border-black/10 bg-white px-3 text-sm outline-none focus:ring-1 focus:ring-ring";

export function GviyaScreen({
  fileName,
  syncedAt,
  deals,
  contacts,
  reps,
  sources,
  surenseError,
  surenseConfigured,
  scanned,
}: {
  fileName: string | null;
  syncedAt: string | null;
  deals: Deal[];
  contacts: Contact[];
  reps: string[];
  sources: string[];
  surenseError: string | null;
  surenseConfigured: boolean;
  scanned: number;
}) {
  const [month, setMonth] = useState(currentMonthKey());
  const [rep, setRep] = useState("all");
  const [source, setSource] = useState("all");
  const months = useMemo(
    () => Array.from(new Set(deals.map((deal) => deal.dealDate?.slice(0, 7)).filter(Boolean) as string[])).sort().reverse(),
    [deals],
  );
  const filtered = useMemo(() => filterDeals(deals, { month, rep, source }), [deals, month, rep, source]);
  const match = useMemo(() => {
    if (!surenseConfigured) return null;
    const map = new Map<string, boolean>();
    for (const deal of filtered) map.set(deal.id, deal.surense === "matched");
    return map;
  }, [filtered, surenseConfigured]);
  const kpis = gviyaKpis(filtered, match);
  const trend = monthlyTrend(deals);
  const maxSold = Math.max(1, ...trend.map((row) => row.sold));
  const byRep = groupDeals(filtered, "rep").slice(0, 8);
  const bySource = groupDeals(filtered, "source").slice(0, 8);
  const needsLead = contacts.filter((contact) => contact.surense === "unmatched");

  if (!deals.length && !contacts.length) {
    return (
      <ShemeshPage
        title="פדיונות וגבייה"
        description="דשבורד GVIYA. המכירות נספרות לפי תאריך העסקה, וההצלבה מול שורנס היא לקריאה בלבד."
        icon={BadgeDollarSign}
      >
        <ShemeshEmpty
          icon={FileSpreadsheet}
          title="הדוח עוד לא הגיע"
          body="המסך נדלק מגיליון GVIYA שבקובץ המכירות של שמש, אחרי שהוא נשמר ב־shemesh_sales_workbooks. לחצו סנכרון מערכת, או הגדירו SHEMESH_EXCEL_LOCAL_PATH. אין כאן נתוני דוגמה."
        />
      </ShemeshPage>
    );
  }

  return (
    <ShemeshPage
      title="פדיונות וגבייה"
      description={`גיליון GVIYA${fileName ? ` · ${fileName}` : ""}. מכירה לפי תאריך העסקה. שורנס לא נכתב מכאן.`}
      icon={BadgeDollarSign}
      filters={
        <div className="flex flex-wrap gap-2">
          <select className={select} value={month} onChange={(event) => setMonth(event.target.value)} aria-label="חודש">
            <option value="all">כל החודשים</option>
            {months.map((item) => (
              <option key={item} value={item}>{formatShemeshMonth(item)}</option>
            ))}
          </select>
          <select className={select} value={rep} onChange={(event) => setRep(event.target.value)} aria-label="נציג">
            <option value="all">כל הנציגים</option>
            {reps.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <select className={select} value={source} onChange={(event) => setSource(event.target.value)} aria-label="מקור">
            <option value="all">כל המקורות</option>
            {sources.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>
      }
      stats={
        <>
          <Stat label="נמכר בתקופה" value={formatShemeshMoney(kpis.sold)} hint="לפי תאריך עסקה" />
          <Stat label="נגבה" value={formatShemeshMoney(kpis.collected)} />
          <Stat label="עסקאות" value={formatShemeshCount(kpis.count)} hint={kpis.average == null ? undefined : `ממוצע ${formatShemeshMoney(kpis.average)}`} />
          <Stat label="מגבייה לחשבונית" value={kpis.cycleDays == null ? "—" : `${formatShemeshCount(kpis.cycleDays)} ימים`} hint="ממוצע" />
        </>
      }
    >
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="לפי נציג">
          <Bars rows={byRep.map((row) => ({ label: row.key, value: row.sold, hint: `${row.count} עסקאות` }))} />
        </Panel>
        <Panel title="לפי מקור ליד">
          <Bars rows={bySource.map((row) => ({ label: row.key, value: row.sold, hint: `${row.count} עסקאות` }))} />
        </Panel>
      </div>
      <Panel title="מגמה חודשית" action={<span className="text-[11px] text-muted-foreground">{syncedAt ? `עודכן ${formatShemeshDay(syncedAt.slice(0, 10))}` : ""}</span>}>
        {trend.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">אין תאריכי עסקה בגיליון.</p>
        ) : (
          <div className="flex items-end gap-2 overflow-x-auto py-2">
            {trend.slice(-8).map((row) => (
              <div key={row.month} className="flex min-w-14 flex-1 flex-col items-center gap-1">
                <div className="flex h-28 w-full items-end">
                  <div
                    className="w-full rounded-t-lg bg-[#185A94]"
                    style={{ height: `${Math.max(8, (row.sold / maxSold) * 100)}%` }}
                    title={formatShemeshMoney(row.sold)}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">{formatShemeshMonth(row.month)}</p>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Panel
        title="הצלבה מול שורנס"
        action={
          <span className="text-[11px] text-muted-foreground">
            {surenseConfigured ? `${formatShemeshCount(scanned)} רשומות שנקראו` : "לא מחובר"}
          </span>
        }
      >
        {surenseError ? (
          <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">{surenseError}</p>
        ) : null}
        {!surenseConfigured ? (
          <p className="py-2 text-sm text-muted-foreground">
            כדי לסמן התאמה צריך <span className="font-mono text-xs">SURENSE_CLIENT_ID</span> ו-
            <span className="font-mono text-xs">SURENSE_CLIENT_SECRET</span> בשרת. הקריאה מסוננת למקורות ולמטפלים של שמש, בלי כתיבה.
          </p>
        ) : (
          <p className="py-2 text-sm text-muted-foreground">
            {formatShemeshCount(kpis.matched)} הותאמו לפי שם · {formatShemeshCount(kpis.unmatched)} בלי התאמה בתקופה המסוננת.
          </p>
        )}
      </Panel>
      <Panel title="עסקאות">
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="sticky top-0 bg-white text-xs text-muted-foreground">
              <tr>
                {["לקוח", "נציג", "מקור", "תאריך עסקה", "סכום", "נגבה", "חשבונית", "ימים", "שורנס"].map((label) => (
                  <th key={label} className="px-2 py-2 text-right font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((deal) => (
                <tr key={deal.id} className="border-t border-black/[0.06]">
                  <td className="max-w-[10rem] truncate px-2 py-2 font-medium">{deal.client}</td>
                  <td className="px-2 py-2">{deal.rep}</td>
                  <td className="px-2 py-2">{deal.source}</td>
                  <td className="px-2 py-2 tabular-nums">{deal.dealDate ? formatShemeshDay(deal.dealDate) : "—"}</td>
                  <td className="px-2 py-2 tabular-nums">{formatShemeshMoney(deal.dealAmount)}</td>
                  <td className="px-2 py-2 tabular-nums">{formatShemeshMoney(deal.collected)}</td>
                  <td className="px-2 py-2 tabular-nums">{deal.invoiceDate ? formatShemeshDay(deal.invoiceDate) : "—"}</td>
                  <td className="px-2 py-2 tabular-nums">{deal.cycleDays == null ? "—" : deal.cycleDays}</td>
                  <td className="px-2 py-2">
                    <MatchPill flag={deal.surense} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 200 ? (
          <p className="pt-2 text-[11px] text-muted-foreground">מוצגות 200 שורות ראשונות מתוך {formatShemeshCount(filtered.length)}.</p>
        ) : null}
      </Panel>
      <Panel title="Sheet 6 · צריך ליד">
        {!surenseConfigured ? (
          <p className="py-4 text-sm text-muted-foreground">
            {formatShemeshCount(contacts.length)} אנשי קשר בקובץ. בלי שורנס אי אפשר לדעת מי חסר, ולכן הרשימה לא מסומנת כ«צריך ליד».
          </p>
        ) : needsLead.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">כל אנשי הקשר שבגיליון נמצאו בשורנס, או שהגיליון ריק.</p>
        ) : (
          <ul className="divide-y divide-black/[0.06]">
            {needsLead.slice(0, 100).map((contact) => (
              <li key={contact.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="font-medium">{contact.name || "בלי שם"}</span>
                <span className="text-muted-foreground">{contact.phone || contact.idNumber || "צריך ליד"}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="pt-2 text-[11px] text-muted-foreground">קריאה בלבד. המערכת לא פותחת ליד בשורנס.</p>
      </Panel>
      <p className="px-1 text-[11px] text-muted-foreground">
        שלבי תיק בלוח הבקרה: {CASE_STAGES.map((stage) => stage.label).join(" · ")}
      </p>
    </ShemeshPage>
  );
}

function MatchPill({ flag }: { flag: MatchFlag }) {
  const label = flag === "matched" ? "הותאם" : flag === "unmatched" ? "בלי התאמה" : "לא נבדק";
  const tone = flag === "matched" ? "bg-emerald-50 text-emerald-800" : flag === "unmatched" ? "bg-amber-50 text-amber-900" : "bg-black/[0.04] text-muted-foreground";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>{label}</span>;
}

function Bars({ rows }: { rows: { label: string; value: number; hint: string }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">אין שורות בתקופה.</p>;
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="truncate font-medium">{row.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{formatShemeshMoney(row.value)} · {row.hint}</span>
          </div>
          <div className="h-1.5 rounded-full bg-black/[0.05]">
            <div className="h-1.5 rounded-full bg-[#185A94]" style={{ width: `${(row.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
