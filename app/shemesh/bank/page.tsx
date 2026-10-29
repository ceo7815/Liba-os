import type { Metadata } from "next";
import { Landmark } from "lucide-react";
import { BankImport } from "@/components/shemesh/bank-import";
import { Panel, ShemeshPage } from "@/components/shemesh/widgets";
import { formatIls } from "@/lib/format/numbers";
import { loadBankLines } from "@/lib/shemesh/closing";
import { formatShemeshDay } from "@/lib/shemesh/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ייבוא בנק · שמש" };

export default async function BankPage() {
  const view = await loadBankLines();
  return (
    <ShemeshPage title="ייבוא בנק" description="CSV או אקסל עם תאריך, תיאור וסכום. שורה מותאמת לשכר טרחה שמור בספר, פעם אחת. שיעור שלא אומת לא נכנס להתאמה." icon={Landmark}>
      <BankImport />
      {view.missing ? <p className="text-sm text-muted-foreground">טבלת הבנק עדיין לא הורצה במסד הזה.</p> : view.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">אין שורות שמורות. העלו דף כדי להתאים מול שכר הטרחה.</p>
      ) : (
        <Panel title="שורות שנשמרו">
          <ul className="divide-y divide-white/70 text-sm">
            {view.rows.map((row) => (
              <li key={row.id} className="flex justify-between gap-3 py-2">
                <span>{row.description || "בלי תיאור"} · {row.day ? formatShemeshDay(row.day) : "בלי תאריך"}</span>
                <span className="tabular-nums">{formatIls(row.amount)} · {row.matched ? "הותאם" : "פתוח"}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </ShemeshPage>
  );
}
