import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { ShemeshEmpty } from "@/components/shemesh/empty-state";
import { Panel, ShemeshPage } from "@/components/shemesh/widgets";
import { formatShemeshMoney } from "@/lib/shemesh/format";
import { loadDesk, loadCaseBoard } from "@/lib/shemesh/ops";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "כרטיס לקוח · שמש" };

export default async function ClientCardPage({ searchParams }: { searchParams: { name?: string } }) {
  const name = (searchParams.name ?? "").trim();
  const [board, ledger] = await Promise.all([loadCaseBoard(), loadDesk("ledger")]);
  const cases = board.cases.filter((item) => item.clientName === name);
  const payments = ledger.rows.filter((row) => row.title === name);

  return (
    <ShemeshPage
      title={name || "כרטיס לקוח"}
      description="כל התיקים, המסמכים ותשלומי הספר של הלקוח. הספר הוא שכר טרחה, לא דוח המכירות."
      icon={Users}
    >
      {!name ? (
        <ShemeshEmpty icon={Users} title="בחרו לקוח" body="הכרטיס נפתח מהרשימה בלקוחות ותיקים." action={<Link href="/shemesh/clients" className="text-sm font-medium underline">לרשימה</Link>} />
      ) : cases.length === 0 && payments.length === 0 ? (
        <ShemeshEmpty icon={Users} title="אין רשומות ללקוח הזה" body="השם לא נמצא בתיקים ובספר." />
      ) : (
        <div className="space-y-4">
          <Panel title="תיקים ומסמכים">
            {cases.length === 0 ? <p className="py-3 text-sm text-muted-foreground">אין תיק פתוח בשם הזה.</p> : (
              <ul className="space-y-3">
                {cases.map((item) => (
                  <li key={item.id} className="rounded-2xl border border-white/80 bg-white/70 px-3 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{item.stageLabel}</p>
                      <Link href={`/shemesh/cases?open=${item.id}`} className="text-xs font-medium text-[#2f86ea]">פתיחת התיק</Link>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{item.handler || "בלי מטפל"} · {item.status}{item.deadline ? ` · יעד ${item.deadline}` : ""}</p>
                    <ul className="mt-2 space-y-1 text-xs">
                      {item.documents.length === 0 ? <li className="text-muted-foreground">אין מסמכים בתיק.</li> : item.documents.map((doc) => (
                        <li key={doc.id} className="flex justify-between gap-3">
                          <span>{doc.label}</span>
                          <span>{doc.state === "invalid" ? "לא תקין" : doc.received || doc.state === "received" ? "התקבל" : "חסר"}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="תשלומים בספר">
            {payments.length === 0 ? <p className="py-3 text-sm text-muted-foreground">אין שורות ספר ללקוח הזה.</p> : (
              <ul className="divide-y divide-white/70 text-sm">
                {payments.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 py-2">
                    <span>{row.kind === "tax_refund" ? "החזר מס" : "פדיון"} · {row.status} · {row.when || "בלי תאריך"}</span>
                    <span className="tabular-nums">{formatShemeshMoney(row.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="pt-2 text-xs text-muted-foreground">הסכום הוא ברוטו בספר שכר הטרחה. הוא לא נמכר החודש.</p>
          </Panel>
        </div>
      )}
    </ShemeshPage>
  );
}
