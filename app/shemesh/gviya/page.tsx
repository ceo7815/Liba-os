import type { Metadata } from "next";
import { ShemeshDesk } from "@/components/shemesh/desk";
import { field } from "@/lib/shemesh/field";
import { GviyaScreen } from "@/components/shemesh/gviya-screen";
import { createShemeshLedger, setShemeshLedgerStatus } from "@/app/actions/shemesh-ops";
import { loadDesk, loadSheetQueue } from "@/lib/shemesh/ops";
import { buildGviyaModel } from "@/lib/shemesh/gviya";
import { loadShemeshSalesWorkbook } from "@/lib/shemesh/sales-workbook-store";
import { matchStoredSnapshot } from "@/lib/shemesh/surense-match";
import { SheetQueue } from "@/components/shemesh/sheet-queue";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "פדיונות · שמש" };

export default async function ShemeshGviyaPage() {
  const stored = await loadShemeshSalesWorkbook().catch(() => null);
  const model = buildGviyaModel(stored);
  const ledger = await loadDesk("ledger", "redemption");
  const queue = await loadSheetQueue();
  const match = await matchStoredSnapshot(model.deals, model.contacts);
  const flag = (id: string, found: Set<string>) =>
    !match.configured ? "unchecked" : found.has(id) ? "matched" : "unmatched";
  return (
    <div className="space-y-6">
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
      <input className={field} name="day" type="date" aria-label="תאריך" />
      <input className={field} name="notes" placeholder="הערה" />
      <input type="hidden" name="status" value="open" />
    </ShemeshDesk>
    </div>
  );
}
