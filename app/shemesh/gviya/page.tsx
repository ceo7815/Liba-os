import type { Metadata } from "next";
import { HebrewDateInput } from "@/components/shemesh/hebrew-date";
import { ShemeshDesk } from "@/components/shemesh/desk";
import { field } from "@/lib/shemesh/field";
import { GviyaScreen } from "@/components/shemesh/gviya-screen";
import { createShemeshLedger, setShemeshLedgerStatus } from "@/app/actions/shemesh-ops";
import { loadDesk, loadSheetQueue } from "@/lib/shemesh/ops";
import { buildGviyaModel, currentMonthKey } from "@/lib/shemesh/gviya";
import { loadShemeshSalesWorkbook } from "@/lib/shemesh/sales-workbook-store";
import { monthSalesFromDeals, SHEMESH_SALES_SOURCE_LABEL } from "@/lib/shemesh/sales-source";
import { matchStoredSnapshot } from "@/lib/shemesh/surense-match";
import { SheetQueue } from "@/components/shemesh/sheet-queue";
import { Panel, Stat } from "@/components/shemesh/widgets";
import { formatShemeshCount, formatShemeshMoney, formatShemeshMonth } from "@/lib/shemesh/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "פדיונות · שמש" };

export default async function ShemeshGviyaPage() {
  const stored = await loadShemeshSalesWorkbook().catch(() => null);
  const model = buildGviyaModel(stored);
  const ledger = await loadDesk("ledger", "redemption");
  const queue = await loadSheetQueue();
  const hasWorkbook = model.deals.length > 0 || Boolean(stored?.sheets.length);
  const sales = monthSalesFromDeals(hasWorkbook ? model.deals : [], currentMonthKey());
  const match = await matchStoredSnapshot(model.deals, model.contacts);
  const flag = (id: string, found: Set<string>) =>
    !match.configured ? "unchecked" : found.has(id) ? "matched" : "unmatched";
  return (
    <div className="space-y-6">
    <Panel title="נמכר לפי תאריך עסקה">
      <p className="pb-3 text-xs text-muted-foreground">מקור: {SHEMESH_SALES_SOURCE_LABEL}. לא מדוח המנהלים של ליבה.</p>
      <div className="kpi-band grid gap-3 sm:grid-cols-3">
        <Stat hero tone="sun" label={`נמכר ${formatShemeshMonth(sales.month)}`} value={hasWorkbook ? formatShemeshMoney(sales.sold) : "—"} hint="deal_date בדוח שמש" />
        <Stat label="נגבה" value={hasWorkbook ? formatShemeshMoney(sales.collected) : "—"} />
        <Stat label="עסקה עד חשבונית" value={!hasWorkbook || sales.cycleDays == null ? "—" : `${formatShemeshCount(sales.cycleDays)} ימים`} />
      </div>
    </Panel>
    <GviyaScreen
      fileName={model.fileName}
      syncedAt={model.syncedAt}
      deals={model.deals.map((deal) => ({ ...deal, surense: flag(deal.id, match.dealMatched) }))}
      contacts={model.contacts.map((contact) => ({ ...contact, surense: flag(contact.id, match.contactFound) }))}
      reps={model.reps}
      sources={model.sources}
      surenseError={match.error}
      surenseConfigured={match.configured}
      scanned={match.scanned}
    />
    <SheetQueue
      title="Sheet-6 · לקוחות לבדיקה"
      body="לחיצה פותחת תיק ליד אם אין תיק עם אותו מזהה שורה. לחיצה שנייה לא יוצרת כפילות."
      rows={queue.rows.filter((row) => row.excelRowId)}
      missing={queue.missing}
    />
    <ShemeshDesk
      title="ספר פדיונות"
      description="כל שורה נשמרת עם עמלה לפי השיעור שבהגדרות. בלי שיעור שמור העמלה נשארת ריקה."
      rows={ledger.rows}
      missing={ledger.missing}
      error={ledger.error}
      audit={ledger.audit}
      exportKind="ledger:redemption"
      createAction={createShemeshLedger}
      statusAction={setShemeshLedgerStatus}
    >
      <input type="hidden" name="kind" value="redemption" />
      <input className={field} name="clientName" placeholder="לקוח" required />
      <input className={field} name="gross" inputMode="decimal" placeholder="ברוטו" required />
      <HebrewDateInput name="day" />
      <input className={field} name="notes" placeholder="הערה" />
      <input type="hidden" name="status" value="open" />
    </ShemeshDesk>
    </div>
  );
}
