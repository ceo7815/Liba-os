import { buildGviyaModel } from "@/lib/shemesh/gviya";
import { asRows, shemeshAdmin } from "@/lib/shemesh/db";
import type { DashCampaign, DashInput, DashLedger } from "@/lib/shemesh/dashboard-model";
import { loadShemeshPulse } from "@/lib/shemesh/load-pulse";
import { loadCaseBoard } from "@/lib/shemesh/ops";
import { loadShemeshSalesWorkbook } from "@/lib/shemesh/sales-workbook-store";
import { loadSettlementDrafts, type SettlementStatus } from "@/lib/shemesh/settlement-flow";

function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function loadShemeshDashboard(): Promise<{ input: DashInput; sourceOptions: string[] }> {
  const today = todayIso();
  const [stored, board, drafts, pulse, ledgerResult] = await Promise.all([
    loadShemeshSalesWorkbook().catch(() => null),
    loadCaseBoard().catch(() => null),
    loadSettlementDrafts().catch(() => ({ missing: true, error: null, drafts: [] })),
    loadShemeshPulse().catch(() => null),
    shemeshAdmin().from("shemesh_ledger").select("id, client_name, status, fee, day").limit(400).then(
      (result) => result,
      () => ({ data: [], error: { message: "הספר לא נקרא" } }),
    ),
  ]);
  const model = buildGviyaModel(stored);
  const hasWorkbook = model.deals.length > 0 || Boolean(stored?.sheets.length);
  const ledger: DashLedger[] = ledgerResult.error
    ? []
    : asRows(ledgerResult.data).map((row) => ({
        id: String(row.id),
        client: String(row.client_name ?? ""),
        status: String(row.status ?? "open"),
        fee: num(row.fee),
        day: String(row.day ?? "").slice(0, 10),
      }));
  const campaigns: DashCampaign[] = (pulse?.campaigns ?? []).map((campaign) => {
    const spend = campaign.days.reduce((sum, day) => sum + day.cost, 0);
    const leads = campaign.days.reduce((sum, day) => sum + day.leads, 0);
    return {
      name: campaign.name,
      channel: campaign.channel,
      spend,
      leads,
      cpl: leads > 0 ? Math.round((spend / leads) * 100) / 100 : null,
    };
  });
  const input: DashInput = {
    hasWorkbook,
    deals: hasWorkbook ? model.deals : [],
    cases: (board?.cases ?? []).map((item) => ({
      id: item.id,
      clientName: item.clientName,
      stage: item.stage,
      status: item.status,
      handler: item.handler,
      openedOn: item.openedOn,
      deadline: item.deadline,
      overdue: item.overdue,
      missingDocs: item.documents.filter((doc) => doc.required && doc.state !== "received" && !doc.received).length,
    })),
    ledger,
    ratesPending: board?.settings.ratesPending ?? true,
    slaDays: board?.settings.slaDays ?? null,
    drafts: drafts.drafts.map((draft) => ({
      id: draft.id,
      period: draft.period,
      status: draft.status as SettlementStatus,
      liba: draft.streams[0]?.amount ?? null,
      insurance: draft.streams[1]?.amount ?? null,
      redemption: draft.streams[2]?.amount ?? null,
    })),
    campaigns,
    audit: (board?.audit ?? []).map((row) => ({ id: row.id, summary: row.summary, createdAt: row.createdAt })),
    today,
    salesFileName: model.fileName,
    salesSyncedAt: model.syncedAt,
    salesColumns: model.columns,
  };
  return {
    input,
    sourceOptions: Array.from(new Set(model.deals.map((deal) => deal.source).filter(Boolean))).sort((a, b) => a.localeCompare(b, "he")),
  };
}
