import type { AgentRate, CampaignExpense } from "@/lib/sales-dashboard/campaign-math";
import {
  CHANNEL_LABEL,
  DEFAULT_AGENT_MULTIPLIER,
  agentMultiplier,
  campaignPnl,
  canonicalAgentName,
  formatIlsSigned,
  wageForPremium,
  type ProfitStatus,
} from "@/lib/sales-dashboard/campaign-math";
import type { MarketingProduction } from "@/lib/sales-dashboard/types";
import {
  buildMonthlyAgentPremiumTotals,
  explainWageForProduction,
  formatTierRange,
  productionDateOf,
  productionMonthKey,
  wageForOneProduction,
  type EmployeePayProfile,
  type EmploymentKind,
  type WageExplainReason,
  type WageKind,
} from "@/lib/employees/contract";
import { excelAgentKey } from "@/lib/employees/excel-sellers";

function ils(n: number): string {
  return Math.round(n).toLocaleString("he-IL");
}

export function formatLastUpdatedAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    const weekday = d.toLocaleDateString("he-IL", {
      timeZone: "Asia/Jerusalem",
      weekday: "long",
    });
    const date = d.toLocaleDateString("he-IL", {
      timeZone: "Asia/Jerusalem",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const time = d.toLocaleTimeString("he-IL", {
      timeZone: "Asia/Jerusalem",
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${weekday} · ${date} · ${time}`;
  } catch {
    return iso;
  }
}

export function formatAsOfLabel(iso: string): string {
  return formatLastUpdatedAt(iso) ?? iso;
}

const STATUS_HE: Record<ProfitStatus, string> = {
  profit: "רווח",
  loss: "הפסד",
  "no-cost": "אין סגירות",
};

export function formatCampaignOwnerCopy(input: {
  name: string;
  asOf: string;
  rangeLabel: string;
  activeCount: number;
  premium: number;
  pendingCount: number;
  pendingPremium: number;
  expenses: CampaignExpense[];
  wageTotal: number;
  workers: { name: string; count: number; sum: number; multiplier: number; wage: number }[];
  insurerMultiplier: number;
}): string {
  const adsTotal = input.expenses.reduce((sum, row) => sum + row.amount, 0);
  const pnl = campaignPnl({
    premium: input.premium,
    wageTotal: input.wageTotal,
    adsTotal,
    insurerMultiplier: input.insurerMultiplier,
  });
  const byChannel = {
    google: 0,
    facebook: 0,
    manual: 0,
  };
  for (const row of input.expenses) byChannel[row.channel] += row.amount;

  const lines = [
    `דוח קמפיין — ${input.name}`,
    `נכון ל־${input.asOf}`,
    `תקופה: ${input.rangeLabel}`,
    "",
    `סטטוס: ${STATUS_HE[pnl.status]} ${formatIlsSigned(pnl.net)}`,
    "",
    `הפקות פעילות: ${input.activeCount}`,
    `פרמיה שנסגרה: ₪${ils(input.premium)}`,
    `הכנסה מחברות (פרמיה × ${input.insurerMultiplier}): ₪${ils(pnl.income)}`,
    "פעילות בלבד — ללא בוטלה / גניזה",
    "",
    "הוצאות:",
    `• שכר עובדים (פרמיה × מכפיל) — ₪${ils(input.wageTotal)}`,
    `• ${CHANNEL_LABEL.google} — ₪${ils(byChannel.google)}`,
    `• ${CHANNEL_LABEL.facebook} — ₪${ils(byChannel.facebook)}`,
    `• ${CHANNEL_LABEL.manual} — ₪${ils(byChannel.manual)}`,
    `סה״כ הוצאות: ₪${ils(pnl.expenseTotal)}`,
    "",
    `רווח / הפסד: ${formatIlsSigned(pnl.net)}`,
    `חישוב: ₪${ils(pnl.income)} − ₪${ils(input.wageTotal)} − ₪${ils(adsTotal)}`,
    "",
    "לפי עובד (סגירות):",
  ];

  if (input.workers.length === 0) {
    lines.push("• אין הפקות פעילות");
  } else {
    for (const worker of input.workers) {
      lines.push(
        `• ${worker.name} — ${worker.count} | פרמיה ₪${ils(worker.sum)} × ${worker.multiplier} = שכר ₪${ils(worker.wage)}`,
      );
    }
  }

  lines.push(
    "",
    `בתהליך הפקה (לא נספר בכסף): ${input.pendingCount} | ₪${ils(input.pendingPremium)}`,
  );

  return lines.join("\n");
}

export function groupWorkers(
  rows: MarketingProduction[],
  rates: AgentRate[] = [],
  fallback = DEFAULT_AGENT_MULTIPLIER,
  wageOptions?: {
    profiles: EmployeePayProfile[];
    kind: WageKind;
    contextRows?: MarketingProduction[];
  },
) {
  const map = new Map<string, { name: string; count: number; sum: number; wage: number }>();
  const monthlyTotals = wageOptions
    ? buildMonthlyAgentPremiumTotals(wageOptions.contextRows ?? rows)
    : null;
  for (const row of rows) {
    if (row.status !== "active") continue;
    const key = canonicalAgentName(row.agent);
    const display = key || row.agent;
    const current = map.get(key) ?? { name: display, count: 0, sum: 0, wage: 0 };
    current.count += 1;
    current.sum += row.premium;
    current.wage += wageOptions
      ? wageForOneProduction(row, {
          profiles: wageOptions.profiles,
          rates,
          fallback,
          kind: wageOptions.kind,
          volumeByAgent: new Map(),
          settledByAgent: new Map(),
          monthlyTotals: monthlyTotals ?? undefined,
        })
      : wageForPremium(row.premium, agentMultiplier(row.agent, rates, fallback));
    map.set(key, current);
  }
  return Array.from(map.values())
    .map((item) => {
      const sum = Math.round(item.sum);
      const wage = Math.round(item.wage);
      const multiplier = sum > 0 ? Math.round((wage / sum) * 100) / 100 : 0;
      return {
        ...item,
        sum,
        wage,
        multiplier,
      };
    })
    .sort((a, b) => b.wage - a.wage || b.sum - a.sum);
}

export type WorkerWageDetailLine = {
  key: string;
  date: string;
  client: string;
  product: string;
  premium: number;
  wage: number;
  multiplier: number;
  reason: WageExplainReason;
  month: string;
  monthProduction: number;
  tierLabel: string;
};

export type WorkerWageBreakdown = {
  workerName: string;
  employmentKind: EmploymentKind | null;
  lines: WorkerWageDetailLine[];
  premiumTotal: number;
  wageTotal: number;
  blendedMultiplier: number;
};

function workerDisplayName(agent: string): string {
  return canonicalAgentName(agent) || agent;
}

export function workerWageBreakdown(
  workerName: string,
  rows: MarketingProduction[],
  rates: AgentRate[],
  fallback = DEFAULT_AGENT_MULTIPLIER,
  wageOptions?: {
    profiles: EmployeePayProfile[];
    kind: WageKind;
    contextRows?: MarketingProduction[];
  },
): WorkerWageBreakdown {
  const profile =
    wageOptions?.profiles.find((row) => excelAgentKey(row.fullName) === excelAgentKey(workerName)) ??
    null;
  const monthlyTotals = wageOptions
    ? buildMonthlyAgentPremiumTotals(wageOptions.contextRows ?? rows)
    : null;
  const lines: WorkerWageDetailLine[] = [];
  for (const row of rows) {
    if (row.status !== "active") continue;
    if (workerDisplayName(row.agent) !== workerName) continue;
    const explained = wageOptions
      ? explainWageForProduction(row, {
          profiles: wageOptions.profiles,
          rates,
          fallback,
          kind: wageOptions.kind,
          volumeByAgent: new Map(),
          settledByAgent: new Map(),
          monthlyTotals: monthlyTotals ?? undefined,
        })
      : {
          wage: Math.round(wageForPremium(row.premium, agentMultiplier(row.agent, rates, fallback))),
          multiplier: agentMultiplier(row.agent, rates, fallback),
          reason: "none" as const,
          monthProduction: 0,
          tier: null,
        };
    lines.push({
      key: row.key,
      date: productionDateOf(row),
      client: row.client || "—",
      product: row.product || "—",
      premium: row.premium,
      wage: explained.wage,
      multiplier: explained.multiplier,
      reason: explained.reason,
      month: productionMonthKey(row) || "",
      monthProduction: explained.monthProduction,
      tierLabel: formatTierRange(explained.tier),
    });
  }
  const premiumTotal = Math.round(lines.reduce((sum, line) => sum + line.premium, 0));
  const wageTotal = Math.round(lines.reduce((sum, line) => sum + line.wage, 0));
  return {
    workerName,
    employmentKind: profile?.employmentKind ?? null,
    lines,
    premiumTotal,
    wageTotal,
    blendedMultiplier: premiumTotal > 0 ? Math.round((wageTotal / premiumTotal) * 100) / 100 : 0,
  };
}
