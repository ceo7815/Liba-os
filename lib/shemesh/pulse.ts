import type { RevenueBook } from "@/lib/shemesh/revenue-book";
import { parseRecordedMoney } from "@/lib/shemesh/revenue-book";

export type PulseChannel = "google" | "facebook";

export type PulseCampaign = {
  id: string;
  name: string;
  channel: PulseChannel;
  active: boolean;
  days: { day: string; cost: number; leads: number }[];
};

export type PulseCollection = {
  day: string | null;
  status: string;
  agent: string;
  source: string;
  deal: number;
  collected: number;
};

export type PulseInvoice = {
  day: string | null;
  agent: string;
  amount: number;
  net: number;
  reward: number;
};

export type ShemeshPulse = {
  googleSyncedAt: string | null;
  facebookSyncedAt: string | null;
  excelSyncedAt: string | null;
  campaigns: PulseCampaign[];
  collection: PulseCollection[];
  invoices: PulseInvoice[];
  finance: { commission: number; settled: number; rows: number };
};

export const EMPTY_SHEMESH_PULSE: ShemeshPulse = {
  googleSyncedAt: null,
  facebookSyncedAt: null,
  excelSyncedAt: null,
  campaigns: [],
  collection: [],
  invoices: [],
  finance: { commission: 0, settled: 0, rows: 0 },
};

function isoDay(stamp: number | null): string | null {
  if (stamp == null) return null;
  const date = new Date(stamp);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

function cellMoney(cells: string[], index: number): number {
  if (index < 0) return 0;
  return parseRecordedMoney(cells[index]) ?? 0;
}

export function pulseFromBook(
  book: RevenueBook,
  syncedAt: string | null,
): Pick<ShemeshPulse, "excelSyncedAt" | "collection" | "invoices" | "finance"> {
  const collectionLedger = book.ledgers.find((ledger) => ledger.id === "collection");
  const invoiceLedger = book.ledgers.find((ledger) => ledger.id === "invoices");
  const financeLedger = book.ledgers.find((ledger) => ledger.id === "finance");
  return {
    excelSyncedAt: syncedAt,
    collection: (collectionLedger?.rows ?? []).map((row) => ({
      day: isoDay(row.day),
      status: collectionLedger && collectionLedger.status >= 0 ? row.cells[collectionLedger.status] ?? "" : "",
      agent: collectionLedger && collectionLedger.agent >= 0 ? row.cells[collectionLedger.agent] ?? "" : "",
      source: collectionLedger && collectionLedger.source >= 0 ? row.cells[collectionLedger.source] ?? "" : "",
      deal: collectionLedger ? cellMoney(row.cells, collectionLedger.deal) : 0,
      collected: collectionLedger ? cellMoney(row.cells, collectionLedger.collected) : 0,
    })),
    invoices: (invoiceLedger?.rows ?? []).map((row) => ({
      day: isoDay(row.day),
      agent: invoiceLedger && invoiceLedger.agent >= 0 ? row.cells[invoiceLedger.agent] ?? "" : "",
      amount: invoiceLedger ? cellMoney(row.cells, invoiceLedger.invoiceAmount) : 0,
      net: invoiceLedger ? cellMoney(row.cells, invoiceLedger.invoiceNet) : 0,
      reward: invoiceLedger ? cellMoney(row.cells, invoiceLedger.reward) : 0,
    })),
    finance: {
      commission: financeLedger
        ? financeLedger.rows.reduce((sum, row) => sum + cellMoney(row.cells, financeLedger.commission), 0)
        : 0,
      settled: financeLedger
        ? financeLedger.rows.reduce((sum, row) => sum + cellMoney(row.cells, financeLedger.settled), 0)
        : 0,
      rows: financeLedger?.rows.length ?? 0,
    },
  };
}

export type PulseRange = { from: string; to: string; channel: PulseChannel | "all" };

export type AdsSlice = {
  spend: number;
  leads: number;
  cpl: number | null;
  byChannel: { channel: PulseChannel; spend: number; leads: number; cpl: number | null }[];
  byCampaign: { id: string; name: string; channel: PulseChannel; spend: number; leads: number; cpl: number | null }[];
};

function cpl(spend: number, leads: number): number | null {
  if (leads <= 0) return null;
  return Math.round((spend / leads) * 100) / 100;
}

export function sliceAds(pulse: ShemeshPulse, range: PulseRange): AdsSlice {
  const byCampaign = pulse.campaigns
    .filter((campaign) => range.channel === "all" || campaign.channel === range.channel)
    .map((campaign) => {
      let spend = 0;
      let leads = 0;
      for (const day of campaign.days) {
        if (day.day < range.from || day.day > range.to) continue;
        spend += day.cost;
        leads += day.leads;
      }
      return {
        id: campaign.id,
        name: campaign.name,
        channel: campaign.channel,
        spend,
        leads,
        cpl: cpl(spend, leads),
      };
    })
    .filter((row) => row.spend > 0 || row.leads > 0)
    .sort((a, b) => b.spend - a.spend || b.leads - a.leads);

  const channels: PulseChannel[] = ["facebook", "google"];
  const byChannel = channels
    .map((channel) => {
      const rows = byCampaign.filter((row) => row.channel === channel);
      const spend = rows.reduce((sum, row) => sum + row.spend, 0);
      const leads = rows.reduce((sum, row) => sum + row.leads, 0);
      return { channel, spend, leads, cpl: cpl(spend, leads) };
    })
    .filter((row) => row.spend > 0 || row.leads > 0);

  const spend = byCampaign.reduce((sum, row) => sum + row.spend, 0);
  const leads = byCampaign.reduce((sum, row) => sum + row.leads, 0);
  return { spend, leads, cpl: cpl(spend, leads), byChannel, byCampaign };
}

function cancelledCollection(status: string): boolean {
  return status.trim() === "בוטל";
}

export type BoardRead = {
  sold: number;
  soldCount: number;
  collectedInRange: number;
  openBalance: number;
  openCount: number;
  leader: { name: string; sold: number; count: number } | null;
  campaign: AdsSlice["byCampaign"][number] | null;
};

/** Sold follows the dates. Open collection is the whole book, because that balance is not a month. */
export function readBoard(pulse: ShemeshPulse, range: PulseRange, ads: AdsSlice): BoardRead {
  const inDates = (day: string | null) => Boolean(day && day >= range.from && day <= range.to);
  const period = pulse.collection.filter((row) => inDates(row.day) && !cancelledCollection(row.status));
  const agents = new Map<string, { sold: number; count: number }>();
  for (const row of period) {
    const name = row.agent.trim();
    if (!name) continue;
    const current = agents.get(name) ?? { sold: 0, count: 0 };
    current.sold += row.deal;
    current.count += 1;
    agents.set(name, current);
  }
  const topAgent = [...agents.entries()].sort((a, b) => b[1].sold - a[1].sold || b[1].count - a[1].count)[0];
  let openBalance = 0;
  let openCount = 0;
  for (const row of pulse.collection) {
    if (cancelledCollection(row.status)) continue;
    const remaining = row.deal - row.collected;
    if (remaining <= 0) continue;
    openBalance += remaining;
    openCount += 1;
  }
  const campaign = [...ads.byCampaign].sort((a, b) => b.leads - a.leads || b.spend - a.spend)[0] ?? null;
  return {
    sold: period.reduce((sum, row) => sum + row.deal, 0),
    soldCount: period.length,
    collectedInRange: period.reduce((sum, row) => sum + row.collected, 0),
    openBalance,
    openCount,
    leader: topAgent ? { name: topAgent[0], sold: topAgent[1].sold, count: topAgent[1].count } : null,
    campaign,
  };
}

export type MoneySlice = {
  collected: number;
  activeDeals: number;
  cancelledDeals: number;
  invoiceAmount: number;
  invoiceNet: number;
  reward: number;
  byMonth: { month: string; collected: number; spend: number; result: number }[];
};

export function sliceMoney(pulse: ShemeshPulse, range: PulseRange): MoneySlice {
  const inDates = (day: string | null) => Boolean(day && day >= range.from && day <= range.to);
  const collection = pulse.collection.filter((row) => inDates(row.day));
  const invoices = pulse.invoices.filter((row) => inDates(row.day));
  const months = new Map<string, { collected: number; spend: number }>();
  const add = (day: string | null, collected = 0, spend = 0) => {
    if (!day) return;
    const month = day.slice(0, 7);
    const current = months.get(month) ?? { collected: 0, spend: 0 };
    current.collected += collected;
    current.spend += spend;
    months.set(month, current);
  };
  for (const row of collection) add(row.day, row.collected, 0);
  for (const campaign of pulse.campaigns) {
    if (range.channel !== "all" && campaign.channel !== range.channel) continue;
    for (const day of campaign.days) {
      if (day.day < range.from || day.day > range.to) continue;
      add(day.day, 0, day.cost);
    }
  }
  return {
    collected: collection.reduce((sum, row) => sum + row.collected, 0),
    activeDeals: collection.filter((row) => row.status !== "בוטל").reduce((sum, row) => sum + row.deal, 0),
    cancelledDeals: collection.filter((row) => row.status === "בוטל").reduce((sum, row) => sum + row.deal, 0),
    invoiceAmount: invoices.reduce((sum, row) => sum + row.amount, 0),
    invoiceNet: invoices.reduce((sum, row) => sum + row.net, 0),
    reward: invoices.reduce((sum, row) => sum + row.reward, 0),
    byMonth: Array.from(months.entries())
      .map(([month, value]) => ({
        month,
        collected: value.collected,
        spend: value.spend,
        result: value.collected - value.spend,
      }))
      .sort((a, b) => a.month.localeCompare(b.month)),
  };
}
