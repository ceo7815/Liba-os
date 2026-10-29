import type { Metadata } from "next";
import { ShemeshDesk } from "@/components/shemesh/desk";
import { field } from "@/lib/shemesh/field";
import { Panel } from "@/components/shemesh/widgets";
import { createShemeshCase, createShemeshCaseChildForm, saveShemeshFeesForm, updateShemeshCase } from "@/app/actions/shemesh-ops";
import { CASE_STAGES } from "@/lib/shemesh/catalog";
import { loadCaseDetail, loadDesk } from "@/lib/shemesh/ops";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "תיקים · שמש" };

export default async function Page({ searchParams }: { searchParams: { case?: string } }) {
  const desk = await loadDesk("cases");
  const detail = searchParams.case ? await loadCaseDetail(searchParams.case) : null;
  return (
    <div className="space-y-4">
      <ShemeshDesk
        title="תיקים"
        description="כל תיק הוא רשומה: שלב, מטפל, יעד ו־SLA מההגדרות. מסמכים, משימות והערות נשמרים על התיק."
        rows={desk.rows}
        missing={desk.missing}
        error={desk.error}
        audit={desk.audit}
        exportKind="cases"
        createAction={createShemeshCase}
        statusAction={updateShemeshCase}
      >
        <input className={field} name="clientName" placeholder="שם לקוח" required />
        <input className={field} name="phone" placeholder="טלפון" />
        <select className={field} name="stage" defaultValue="lead" aria-label="שלב">
          {CASE_STAGES.map((stage) => (
            <option key={stage.id} value={stage.id}>{stage.label}</option>
          ))}
        </select>
        <input className={field} name="handler" placeholder="מטפל" />
        <input className={field} name="openedOn" type="date" aria-label="נפתח" />
        <input className={field} name="notes" placeholder="הערה" />
        <input type="hidden" name="status" value="open" />
      </ShemeshDesk>
      {!desk.missing ? (
        <Panel title="שיעורי עמלה ו־SLA">
          <p className="pb-2 text-xs text-muted-foreground">
            שיעור בין 0 ל־1. ריק אומר שאין חישוב עד שתשמרו שיעור. ימי SLA ריקים אומרים שאין התראה.
          </p>
          <form action={saveShemeshFeesForm} className="grid gap-2 sm:grid-cols-4">
            <input className={field} name="redemptionFeeRate" placeholder="עמלת פדיון" defaultValue={desk.settings.redemptionFeeRate ?? ""} />
            <input className={field} name="taxFeeRate" placeholder="עמלת מס" defaultValue={desk.settings.taxFeeRate ?? ""} />
            <input className={field} name="vatRate" placeholder="מע״מ" defaultValue={desk.settings.vatRate ?? ""} />
            <input className={field} name="slaDays" placeholder="ימי SLA" defaultValue={desk.settings.slaDays ?? ""} />
            <button type="submit" className="h-9 rounded-xl bg-primary px-3 text-sm text-primary-foreground">שמירת שיעורים</button>
          </form>
        </Panel>
      ) : null}
      {detail ? (
        <Panel title="מסמכים, משימות והערות">
          <ul className="space-y-1 text-sm">
            {detail.tasks.map((task) => (
              <li key={task.id}>משימה · {task.title} · {task.assignee || "בלי מטפל"} · {task.dueOn || "בלי יעד"}</li>
            ))}
            {detail.documents.map((doc) => (
              <li key={doc.id}>מסמך · {doc.label} · {doc.received ? "התקבל" : "חסר"}</li>
            ))}
            {detail.notes.map((note) => (
              <li key={note.id}>הערה · {note.body}</li>
            ))}
          </ul>
          <form action={createShemeshCaseChildForm} className="mt-3 grid gap-2 sm:grid-cols-2">
            <input type="hidden" name="caseId" value={searchParams.case} />
            <select className={field} name="child" defaultValue="task" aria-label="סוג">
              <option value="task">משימה</option>
              <option value="document">מסמך</option>
              <option value="note">הערה</option>
            </select>
            <input className={field} name="title" placeholder="כותרת" />
            <input className={field} name="assignee" placeholder="מטפל" />
            <input className={field} name="dueOn" type="date" aria-label="יעד" />
            <input className={field} name="body" placeholder="נוסח הערה" />
            <button type="submit" className="h-9 rounded-xl bg-primary px-3 text-sm text-primary-foreground">הוספה לתיק</button>
          </form>
        </Panel>
      ) : null}
    </div>
  );
}
