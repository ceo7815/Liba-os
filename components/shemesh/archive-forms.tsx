"use client";

import { useFormState } from "react-dom";
import { archiveShemeshReceipt, saveShemeshAdBudget, saveShemeshMailDraft } from "@/app/actions/shemesh-ops";
import { Panel } from "@/components/shemesh/widgets";
import { Button } from "@/components/ui/button";
import { field } from "@/lib/shemesh/field";
import { formatIls } from "@/lib/format/numbers";

const idle = { error: null as string | null };

export function AdReceiptForm({ month }: { month: string }) {
  const [state, action] = useFormState(archiveShemeshReceipt, idle);
  return (
    <Panel title="קבלה חדשה">
      <form action={action} className="grid gap-3 sm:grid-cols-2">
        <input className={field} name="month" defaultValue={month} aria-label="חודש" required />
        <input className={field} name="campaign" placeholder="קמפיין" aria-label="קמפיין" />
        <select className={field} name="source" defaultValue="google" aria-label="מקור">
          <option value="google">גוגל</option>
          <option value="facebook">פייסבוק</option>
          <option value="other">אחר</option>
        </select>
        <input name="file" type="file" required className="text-sm" />
        <Button type="submit" className="w-fit">שמירה בארכיון</Button>
        {state.error ? <p className="text-sm text-destructive sm:col-span-2">{state.error}</p> : null}
      </form>
      <p className="pt-2 text-[11px] text-muted-foreground">נשמרים השם, החודש והקמפיין. הקובץ לא נשלח לפרסום.</p>
    </Panel>
  );
}

export function MailDraftForm({ month, subject, body }: { month: string; subject: string; body: string }) {
  const [state, action] = useFormState(saveShemeshMailDraft, idle);
  return (
    <Panel title="טיוטה לרואה החשבון">
      <form action={action} className="grid gap-3">
        <input type="hidden" name="month" value={month} />
        <input className={field} name="recipient" placeholder="כתובת, לא נשלח" aria-label="נמען" />
        <input className={field} name="subject" defaultValue={subject} aria-label="נושא" />
        <textarea className={`${field} min-h-32`} name="body" defaultValue={body} aria-label="גוף ההודעה" />
        <Button type="submit" className="w-fit">שמירת טיוטה</Button>
        <p className="text-[11px] text-muted-foreground">אין כפתור שליחה. הטיוטה נשמרת במערכת בלבד.</p>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      </form>
    </Panel>
  );
}

export function BudgetForm({ month, amount, spent, forecast, remainder }: { month: string; amount: number | null; spent: number | null; forecast: number | null; remainder: number | null }) {
  const [state, action] = useFormState(saveShemeshAdBudget, idle);
  return (
    <Panel title="תקציב מול תחזית">
      <form action={action} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="month" value={month} />
        <label className="grid gap-1 text-xs text-muted-foreground">
          תקציב החודש
          <input className={field} name="amount" inputMode="decimal" defaultValue={amount ?? ""} placeholder="סכום" />
        </label>
        <Button type="submit">שמירה</Button>
      </form>
      <p className="mt-3 text-sm">הוצאה עד עכשיו {spent == null ? "ממתין לסנכרון" : formatIls(spent)}. תחזית לימים שנותרו {forecast == null ? "ממתין" : formatIls(forecast)}. נותר בתקציב {remainder == null ? "ממתין" : formatIls(remainder)}.</p>
      {state.error ? <p className="pt-2 text-sm text-destructive">{state.error}</p> : null}
    </Panel>
  );
}
