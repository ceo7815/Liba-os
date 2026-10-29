"use client";

import { useFormState } from "react-dom";
import { advanceShemeshSettlement, createShemeshSettlementDraft } from "@/app/actions/shemesh-ops";
import { Panel } from "@/components/shemesh/widgets";
import { Button } from "@/components/ui/button";
import { formatShemeshCount, formatShemeshMoney } from "@/lib/shemesh/format";
import type { SettlementDraft, SettlementStream } from "@/lib/shemesh/settlement-flow";

const STATUS_LABEL = { draft: "טיוטה", approved: "אושר", paid: "שולם" } as const;

const idle = { error: null as string | null };

export function SettlementFlow({
  streams,
  drafts,
  missing,
}: {
  streams: SettlementStream[];
  drafts: SettlementDraft[];
  missing: boolean;
}) {
  const [created, createAction] = useFormState(createShemeshSettlementDraft, idle);
  const [moved, moveAction] = useFormState(advanceShemeshSettlement, idle);

  return (
    <Panel title="טיוטה, אושר, שולם">
      <p className="pb-3 text-xs text-muted-foreground">
        שלושת הזרמים נקראים מהמקורות הקיימים. שדה ריק נשאר ריק. אי אפשר לדלג מטיוטה לשולם.
      </p>
      <ul className="space-y-2 text-sm">
        {streams.map((stream) => (
          <li key={stream.id} className="glass px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">{stream.label}</span>
              <span className="tabular-nums">{formatShemeshMoney(stream.amount)}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{stream.note}{stream.rows ? ` · ${formatShemeshCount(stream.rows)} שורות` : ""}</p>
          </li>
        ))}
      </ul>
      {missing ? (
        <p className="pt-3 text-sm text-muted-foreground">טבלת הטיוטות עדיין לא הורצה במסד הזה.</p>
      ) : (
        <form action={createAction} className="grid gap-2 pt-3 sm:max-w-md">
          <label className="grid gap-1 text-xs text-muted-foreground">
            אסמכתא
            <input name="sourceRef" className="h-10 rounded-xl border border-white/80 bg-white/80 px-3 text-sm" placeholder="שם מסמך או קישור, בלי להעלות קובץ" />
          </label>
          <Button type="submit" className="w-fit">שמירת טיוטה מהזרמים</Button>
          {created.error ? <p className="pt-2 text-sm text-destructive">{created.error}</p> : null}
        </form>
      )}
      {drafts.length ? (
        <ul className="mt-4 divide-y divide-white/70 text-sm">
          {drafts.map((draft) => (
            <li key={draft.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="min-w-0">
                <span className="block">{draft.period} · {STATUS_LABEL[draft.status]}</span>
                {draft.note ? <span className="block text-xs text-muted-foreground">{draft.note}</span> : null}
              </span>
              {draft.status !== "paid" ? (
                <form action={moveAction}>
                  <input type="hidden" name="id" value={draft.id} />
                  <input type="hidden" name="next" value={draft.status === "draft" ? "approved" : "paid"} />
                  <Button type="submit" variant="secondary" size="sm">
                    {draft.status === "draft" ? "אישור" : "סימון כשולם"}
                  </Button>
                </form>
              ) : (
                <span className="text-xs text-muted-foreground">נסגר</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {moved.error ? <p className="pt-2 text-sm text-destructive">{moved.error}</p> : null}
    </Panel>
  );
}
