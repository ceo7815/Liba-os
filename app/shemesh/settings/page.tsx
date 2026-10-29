import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, ShemeshPage } from "@/components/shemesh/widgets";
import { field } from "@/lib/shemesh/field";
import { saveShemeshFeesForm } from "@/app/actions/shemesh-ops";
import { loadFeeSettings } from "@/lib/shemesh/ops";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "הגדרות · שמש" };

export default async function Page() {
  const fees = await loadFeeSettings();
  return (
    <ShemeshPage title="הגדרות" description="שיעורי עמלה וימי SLA. ריק אומר שהחישוב כבוי עד ששומרים שיעור." icon={Settings}>
      {fees.missing ? (
        <p className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">טבלת ההגדרות עדיין לא הורצה.</p>
      ) : (
        <Panel title="עמלה ו־SLA">
          <form action={saveShemeshFeesForm} className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs text-muted-foreground">עמלת פדיון, 0 עד 1<input className={field} name="redemptionFeeRate" defaultValue={fees.settings.redemptionFeeRate ?? ""} /></label>
            <label className="grid gap-1 text-xs text-muted-foreground">עמלת מס, 0 עד 1<input className={field} name="taxFeeRate" defaultValue={fees.settings.taxFeeRate ?? ""} /></label>
            <label className="grid gap-1 text-xs text-muted-foreground">מע״מ, 0 עד 1<input className={field} name="vatRate" defaultValue={fees.settings.vatRate ?? ""} /></label>
            <label className="grid gap-1 text-xs text-muted-foreground">ימי SLA<input className={field} name="slaDays" defaultValue={fees.settings.slaDays ?? ""} /></label>
            <label className="grid gap-1 text-xs text-muted-foreground">מכפיל עמלה, אחרי אימות<input className={field} name="feeMultiplier" defaultValue={fees.settings.feeMultiplier ?? ""} /></label>
            <input type="hidden" name="ratesPendingTouched" value="1" />
            <input type="hidden" name="multiplierTouched" value="1" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="ratesPending" defaultChecked={fees.settings.ratesPending} /> שיעורי ההצלחה ממתינים לאימות</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="multiplierPending" defaultChecked={fees.settings.multiplierPending} /> המכפיל ממתין לאימות</label>
            <p className="text-xs text-muted-foreground sm:col-span-2">כל עוד הדגל דלוק, שכר הטרחה והכנסת העמלה נשארים ריקים. אין שיעור קבוע בקוד.</p>
            <Button type="submit" className="sm:w-fit">שמירה</Button>
          </form>
        </Panel>
      )}
    </ShemeshPage>
  );
}
