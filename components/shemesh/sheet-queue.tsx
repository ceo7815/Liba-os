import { openQueuedCaseForm } from "@/app/actions/shemesh-ops";
import { Panel } from "@/components/shemesh/widgets";
import type { QueueLead } from "@/lib/shemesh/ops";

export function SheetQueue({
  title,
  body,
  rows,
  missing,
}: {
  title: string;
  body: string;
  rows: QueueLead[];
  missing: boolean;
}) {
  return (
    <Panel title={title}>
      <p className="pb-3 text-sm text-muted-foreground">{body}</p>
      {missing ? <p className="text-sm text-muted-foreground">התור עדיין לא הורץ.</p> : null}
      {!missing && rows.length === 0 ? <p className="text-sm text-muted-foreground">אין שורות בתור.</p> : null}
      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <span>
              <span className="font-medium">{row.clientName}</span>
              <span className="ms-2 text-muted-foreground">{row.surenseId || row.excelRowId || row.phone}</span>
            </span>
            {row.openedCaseId ? (
              <span className="text-xs text-muted-foreground">יש תיק</span>
            ) : (
              <form action={openQueuedCaseForm}>
                <input type="hidden" name="id" value={row.id} />
                <button type="submit" className="h-8 rounded-xl bg-primary px-3 text-xs text-primary-foreground">פתיחת תיק</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
