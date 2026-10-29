import { ShemeshReports } from "@/components/shemesh/reports-screen";
import { SETTLEMENT_STATUS_LABEL, loadSettlementDrafts } from "@/lib/shemesh/settlement-flow";
import { loadShemeshBooks } from "@/lib/shemesh/story";

export const dynamic = "force-dynamic";

export default async function ShemeshReportsPage() {
  const [books, drafts] = await Promise.all([loadShemeshBooks(), loadSettlementDrafts()]);
  return (
    <ShemeshReports
      books={books}
      settlements={drafts.drafts.map((draft) => ({
        id: draft.id,
        period: draft.period,
        status: SETTLEMENT_STATUS_LABEL[draft.status],
        liba: draft.streams[0]?.amount ?? null,
        insurance: draft.streams[1]?.amount ?? null,
        redemption: draft.streams[2]?.amount ?? null,
        note: draft.note,
      }))}
    />
  );
}
