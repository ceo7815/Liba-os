"use client";

import { useState } from "react";
import { Shield } from "lucide-react";
import { Panel, Stat } from "@/components/shemesh/widgets";
import { ModulePage, UploadCard, parseCsv } from "@/components/shemesh/module-shell";
import { formatShemeshMoney } from "@/lib/shemesh/format";

type Row = { insurer: string; agent: string; premium: number; settled: number | null };

export function InsuranceScreen() {
  const [rows, setRows] = useState<Row[]>([]);
  const open = rows.filter((row) => row.settled == null);
  const gap = rows.reduce((sum, row) => sum + (row.premium - (row.settled ?? 0)), 0);

  return (
    <ModulePage
      title="ביטוח ונפרעים"
      description="התאמה מול חברות. שורה בלי נפרע נשארת פתוחה. אין נוסחת עמלה עד אישור."
      icon={Shield}
      emptyTitle="אין שורות ביטוח במסד"
      emptyBody="shemesh_insurance_rows לא הורצה לייצור. העלו CSV של חברה, נציג, פרמיה ונפרע. שורות בלי נפרע מסומנות לבדיקה."
    >
      <Stat label="פער פרמיה מול נפרע" value={rows.length ? formatShemeshMoney(gap) : "—"} />
      <UploadCard
        title="דוח ביטוח"
        hint="CSV: חברה,נציג,פרמיה,נפרע"
        onText={(text) =>
          setRows(
            parseCsv(text).map((row) => ({
              insurer: row[0] || "",
              agent: row[1] || "",
              premium: Number(row[2]) || 0,
              settled: row[3] === undefined || row[3] === "" ? null : Number(row[3]) || 0,
            })),
          )
        }
      />
      <Panel title="פתוח להתאמה">
        {rows.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">העלו את הדוח. אין כאן שמות או סכומים שמורים.</p>
        ) : open.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">לכל השורה שהועלתה יש נפרע.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {open.map((row, index) => (
              <li key={`${row.insurer}-${index}`}>
                {row.insurer || "חברה"} · {row.agent || "בלי נציג"} · {formatShemeshMoney(row.premium)}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </ModulePage>
  );
}
