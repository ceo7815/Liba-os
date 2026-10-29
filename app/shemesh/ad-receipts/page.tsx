import type { Metadata } from "next";
import { Receipt } from "lucide-react";
import { AdReceiptForm } from "@/components/shemesh/archive-forms";
import { Panel, ShemeshPage } from "@/components/shemesh/widgets";
import { loadAdReceipts } from "@/lib/shemesh/closing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "קבלות פרסום · שמש" };

export default async function AdReceiptsPage() {
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date()).slice(0, 7);
  const view = await loadAdReceipts();
  return (
    <ShemeshPage title="ארכיון קבלות פרסום" description="העלאה לפי חודש וקמפיין. גוגל או פייסבוק. אין כאן שליחה ואין סכום שהומצא." icon={Receipt}>
      <AdReceiptForm month={month} />
      {view.missing ? <p className="text-sm text-muted-foreground">טבלת הקבלות עדיין לא הורצה.</p> : (
        <Panel title="מה שנשמר">
          {view.rows.length === 0 ? <p className="py-3 text-sm text-muted-foreground">אין קבלות בארכיון.</p> : (
            <ul className="divide-y divide-white/70 text-sm">
              {view.rows.map((row) => (
                <li key={row.id} className="flex justify-between gap-3 py-2">
                  <span>{row.fileName}</span>
                  <span className="text-muted-foreground">{row.month} · {row.campaign || "בלי קמפיין"} · {row.source === "facebook" ? "פייסבוק" : row.source === "google" ? "גוגל" : "אחר"}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </ShemeshPage>
  );
}
