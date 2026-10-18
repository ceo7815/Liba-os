import { loadCampaignBoard } from "@/app/actions/campaigns-board";
import { scopeCampaignBoard } from "@/lib/campaigns/board";
import {
  EMPTY_SHEMESH_PULSE,
  pulseFromBook,
  type PulseCampaign,
  type ShemeshPulse,
} from "@/lib/shemesh/pulse";
import { buildRevenueBook } from "@/lib/shemesh/revenue-book";
import { presentShemeshWorkbook } from "@/lib/shemesh/sales-excel-view";
import { loadShemeshSalesWorkbook } from "@/lib/shemesh/sales-workbook-store";

export async function loadShemeshPulse(): Promise<ShemeshPulse> {
  const [board, workbook] = await Promise.all([
    loadCampaignBoard().catch(() => null),
    loadShemeshSalesWorkbook().catch(() => null),
  ]);
  const scoped = board ? scopeCampaignBoard(board, "shemesh") : null;
  const presented = workbook ? presentShemeshWorkbook(workbook) : null;
  const money = presented ? pulseFromBook(buildRevenueBook(presented), presented.syncedAt) : null;

  const campaigns: PulseCampaign[] = [];
  for (const channel of ["google", "facebook"] as const) {
    for (const campaign of scoped?.[channel].campaigns ?? []) {
      campaigns.push({
        id: campaign.id,
        name: campaign.name,
        channel,
        active: campaign.active,
        days: campaign.points
          .filter((point) => point.cost > 0 || point.leads > 0)
          .map((point) => ({ day: point.day, cost: point.cost, leads: point.leads })),
      });
    }
  }

  return {
    ...EMPTY_SHEMESH_PULSE,
    googleSyncedAt: scoped?.google.lastSyncedAt ?? null,
    facebookSyncedAt: scoped?.facebook.lastSyncedAt ?? null,
    campaigns,
    ...money,
  };
}
