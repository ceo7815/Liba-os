"use client";

import { useMemo, useState } from "react";
import { Landmark } from "lucide-react";
import { Panel, Stat } from "@/components/shemesh/widgets";
import { ModulePage, UploadCard, parseCsv } from "@/components/shemesh/module-shell";
import { formatCount, formatIls } from "@/lib/format/numbers";
import { matchReceipts } from "@/lib/shemesh/calculators";

export function ReceiptsScreen() {
  const [receipts, setReceipts] = useState<{ id: string; source: string; amount: number }[]>([]);
  const [lines, setLines] = useState<{ id: string; description: string; amount: number }[]>([]);
  const matches = useMemo(() => matchReceipts(receipts, lines), [receipts, lines]);
  const open = matches.filter((row) => !row.receiptId).length;
  const summary = receipts
    .map((row) => `${row.source || "אחר"} · ${formatIls(row.amount)}`)
    .join("\n");

  return (
    <ModulePage
      title="קבלות לרואה החשבון"
      description="קבלות גוגל ופייסבוק מול שורות בנק. הסיכום מוכן להעתקה. המערכת לא שולחת מייל."
      icon={Landmark}
      emptyTitle="אין קבלות שמורות"
      emptyBody="טבלאות shemesh_receipts ו־shemesh_bank_lines לא הורצו לייצור. העלו CSV וההתאמה רצה במסך. אם הטבלה חסרה, אין קריסה."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="קבלות" value={formatCount(receipts.length)} />
        <Stat label="שורות בנק" value={formatCount(lines.length)} />
        <Stat label="בלי התאמה" value={formatCount(open)} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <UploadCard
          title="קבלות גוגל / פייסבוק"
          hint="CSV: מקור,סכום"
          onText={(text) =>
            setReceipts(
              parseCsv(text).map((row, index) => ({
                id: `r-${index}`,
                source: row[0] || "other",
                amount: Number(row[1]) || 0,
              })),
            )
          }
        />
        <UploadCard
          title="בנק"
          hint="CSV: תיאור,סכום"
          onText={(text) =>
            setLines(
              parseCsv(text).map((row, index) => ({
                id: `b-${index}`,
                description: row[0] || "",
                amount: Number(row[1]) || 0,
              })),
            )
          }
        />
      </div>
      <Panel title="להעברה לרואה החשבון">
        {receipts.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">אחרי העלאת הקבלות יופיע כאן סיכום להעתקה. אין שליחה אוטומטית.</p>
        ) : (
          <pre className="whitespace-pre-wrap text-sm">{summary}</pre>
        )}
        <ul className="mt-3 space-y-1 text-sm">
          {lines.map((line) => {
            const hit = matches.find((row) => row.lineId === line.id);
            return (
              <li key={line.id} className="flex justify-between gap-2">
                <span className="truncate">{line.description || "שורה"}</span>
                <span>{hit?.receiptId ? "הותאם" : "פתוח"} · {formatIls(line.amount)}</span>
              </li>
            );
          })}
        </ul>
      </Panel>
    </ModulePage>
  );
}
