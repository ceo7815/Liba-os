import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { MailDraftForm } from "@/components/shemesh/archive-forms";
import { Panel, ShemeshPage } from "@/components/shemesh/widgets";
import { accountantDraftText, loadMailDrafts } from "@/lib/shemesh/closing";
import { loadFeeSettings } from "@/lib/shemesh/ops";
import { loadSettlementDrafts, SETTLEMENT_STATUS_LABEL } from "@/lib/shemesh/settlement-flow";
import { loadShemeshBooks } from "@/lib/shemesh/story";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "טיוטה לרואה חשבון · שמש" };

export default async function AccountantPage() {
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date()).slice(0, 7);
  const [books, fees, drafts, saved] = await Promise.all([
    loadShemeshBooks().catch(() => null),
    loadFeeSettings().catch(() => null),
    loadSettlementDrafts().catch(() => ({ drafts: [] })),
    loadMailDrafts(),
  ]);
  const latest = drafts.drafts[0];
  const text = accountantDraftText({
    month,
    collectedNet: books && !books.missing ? books.collectedNet : null,
    ratesPending: fees?.settings.ratesPending ?? true,
    settlementStatus: latest ? SETTLEMENT_STATUS_LABEL[latest.status] : null,
  });
  return (
    <ShemeshPage title="טיוטה לרואה החשבון" description="נשמרת במערכת בלבד. אין שליחה ואין כתובת שרת דואר." icon={Mail}>
      <MailDraftForm month={month} subject={text.subject} body={text.body} />
      {saved.missing ? <p className="text-sm text-muted-foreground">טבלת הטיוטות עדיין לא הורצה.</p> : saved.rows.length ? (
        <Panel title="טיוטות שנשמרו">
          <ul className="space-y-3 text-sm">
            {saved.rows.map((row) => (
              <li key={row.id} className="rounded-2xl border border-white/80 bg-white/70 px-3 py-3">
                <p className="font-semibold">{row.subject}</p>
                <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{row.body}</p>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </ShemeshPage>
  );
}
