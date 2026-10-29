import type { Metadata } from "next";
import { CaseBoard } from "@/components/shemesh/case-board";
import { Panel } from "@/components/shemesh/widgets";
import { field } from "@/lib/shemesh/field";
import { Button } from "@/components/ui/button";
import { createShemeshCase, createShemeshCaseChildForm, saveShemeshFeesForm, setShemeshDocumentForm, updateShemeshCase } from "@/app/actions/shemesh-ops";
import { shemeshProfile } from "@/lib/shemesh/actor";
import { canEditShemeshCases, handlerOnlyName } from "@/lib/permissions/access";
import { ensureStoredChecklists, loadCaseBoard, writeAudit } from "@/lib/shemesh/ops";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "תיקים · שמש" };

export default async function Page({ searchParams }: { searchParams: { open?: string } }) {
  const profile = await shemeshProfile();
  await ensureStoredChecklists();
  if (searchParams.open && profile) {
    await writeAudit(profile.full_name || profile.email || profile.id, "access", "case", searchParams.open, "נצפה תיק");
  }
  const board = await loadCaseBoard(handlerOnlyName(profile));
  const canManage = canEditShemeshCases(profile);
  return (
    <div className="space-y-4">
      <CaseBoard
        cases={board.cases}
        missing={board.missing}
        error={board.error}
        audit={board.audit}
        initialOpenId={searchParams.open}
        canManage={canManage}
        createAction={createShemeshCase}
        updateAction={updateShemeshCase}
        childAction={createShemeshCaseChildForm}
        documentAction={setShemeshDocumentForm}
      />
      {!board.missing ? (
        <Panel title="שיעורי עמלה ו־SLA">
          <p className="pb-3 text-xs leading-relaxed text-muted-foreground">
            שיעור בין 0 ל־1. שדה ריק משאיר את החישוב כבוי. ימי SLA ריקים אומרים שאין יעד אוטומטי.
          </p>
          <form action={saveShemeshFeesForm} className="grid gap-3 sm:grid-cols-4">
            <label className="grid gap-1 text-xs text-muted-foreground">
              עמלת פדיון
              <input className={field} name="redemptionFeeRate" defaultValue={board.settings.redemptionFeeRate ?? ""} />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              עמלת מס
              <input className={field} name="taxFeeRate" defaultValue={board.settings.taxFeeRate ?? ""} />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              מע״מ
              <input className={field} name="vatRate" defaultValue={board.settings.vatRate ?? ""} />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              ימי SLA
              <input className={field} name="slaDays" defaultValue={board.settings.slaDays ?? ""} />
            </label>
            <Button type="submit" className="sm:w-fit">שמירת שיעורים</Button>
          </form>
        </Panel>
      ) : null}
    </div>
  );
}
