import {
  agentBelongsToEmployee,
  contractWageTotals,
  emptyAgreement,
  parseEmploymentKind,
  parsePayAgreements,
  toPayProfile,
  wageTotalForEmployeeContract,
  withResolvedOneTimePayments,
  type EmployeePayProfile,
} from "@/lib/employees/contract";
import { excelAgentKey } from "@/lib/employees/excel-sellers";
import { isMissingRelation } from "@/lib/shemesh/db";
import { loadParsedDashboardSnapshot } from "@/lib/sales-dashboard/ingest-store";
import type { MarketingProduction } from "@/lib/sales-dashboard/types";
import { createAdminClient } from "@/lib/supabase/admin";

/** Excel marketer name for Shemesh's own sales row. Not a rate. */
export const SHEMESH_LIBA_AGENT = "שמש";

export type LibaAgentSale = {
  id: string;
  client: string;
  company: string;
  product: string;
  process: string;
  status: string;
  transferDate: string;
  premium: number;
};

export type LicenseCommission = {
  company: string;
  policy: string;
  client: string;
  commission: number | null;
  premium: number | null;
  day: string;
};

export type ShemeshLibaSettlement = {
  missing: boolean;
  error: string | null;
  sales: LibaAgentSale[];
  premium: number;
  owed: number | null;
  licenseCommissions?: LicenseCommission[];
  licenseCommissionTotal?: number | null;
};

type SaleSource = Pick<
  MarketingProduction,
  | "key"
  | "agent"
  | "source"
  | "client"
  | "premium"
  | "status"
  | "statusRaw"
  | "process"
  | "product"
  | "company"
  | "startDate"
  | "transferDate"
>;

export function settlementForAgent(
  productions: SaleSource[],
  agentName: string,
  profile: EmployeePayProfile | null,
): Pick<ShemeshLibaSettlement, "sales" | "premium" | "owed"> {
  const sales = productions
    .filter((row) => agentBelongsToEmployee(row.agent, agentName))
    .map((row) => ({
      id: row.key,
      client: row.client,
      company: row.company,
      product: row.product,
      process: row.process,
      status: row.statusRaw || row.status,
      transferDate: row.transferDate,
      premium: row.premium,
    }))
    .sort(
      (a, b) =>
        b.transferDate.localeCompare(a.transferDate) ||
        a.client.localeCompare(b.client, "he"),
    );
  const premium = sales.reduce((sum, row) => sum + row.premium, 0);
  const freelancer = profile?.employmentKind === "freelancer" ? profile : null;
  if (!freelancer) return { sales, premium, owed: null };
  const totals = contractWageTotals(
    productions
      .filter((row) => agentBelongsToEmployee(row.agent, agentName))
      .map((row) => ({
        status: row.status,
        agent: row.agent,
        premium: row.premium,
        process: row.process,
        product: row.product,
        source: row.source,
        startDate: row.startDate,
        transferDate: row.transferDate,
      })),
    { profiles: [{ ...freelancer, fullName: agentName }], rates: [] },
  );
  return {
    sales,
    premium,
    owed: wageTotalForEmployeeContract(agentName, totals).earned,
  };
}

export function buildShemeshLibaSettlement(
  productions: SaleSource[],
  profile: EmployeePayProfile | null,
): Pick<ShemeshLibaSettlement, "sales" | "premium" | "owed"> {
  return settlementForAgent(productions, SHEMESH_LIBA_AGENT, profile);
}

function profileForShemesh(raw: {
  full_name: string;
  employment_kind: unknown;
  pay_contract: unknown;
}): EmployeePayProfile | null {
  if (!agentBelongsToEmployee(raw.full_name, SHEMESH_LIBA_AGENT)) return null;
  const kind = parseEmploymentKind(raw.employment_kind);
  const agreements = parsePayAgreements(raw.pay_contract, kind).map((agreement) => ({
    ...agreement,
    contract: withResolvedOneTimePayments(agreement.contract),
  }));
  const profile = toPayProfile({
    fullName: raw.full_name,
    employmentKind: kind,
    agreements,
  });
  return profile.employmentKind === "freelancer" ? profile : null;
}

export async function loadShemeshLibaSettlement(): Promise<ShemeshLibaSettlement> {
  const empty: ShemeshLibaSettlement = {
    missing: false,
    error: null,
    sales: [],
    premium: 0,
    owed: null,
  };
  try {
    const stored = await loadParsedDashboardSnapshot();
    const productions = stored?.data?.marketing?.productions;
    if (!productions) return { ...empty, missing: true };
    let profile: EmployeePayProfile | null = null;
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from("finance_employees")
        .select("full_name, employment_kind, pay_contract");
      if (error) {
        if (!isMissingRelation(error.message)) return { ...empty, error: error.message };
      } else {
        profile =
          (data ?? [])
            .map((row) => profileForShemesh(row as {
              full_name: string;
              employment_kind: unknown;
              pay_contract: unknown;
            }))
            .find((row) => row != null) ?? null;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "ההסכם לא נקרא";
      if (!isMissingRelation(message) && !/missing supabase|missing next_public/i.test(message)) {
        return { ...empty, error: message };
      }
    }
    return { ...empty, ...buildShemeshLibaSettlement(productions, profile) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "דוח המכירות לא נקרא";
    if (isMissingRelation(message) || /missing supabase|missing next_public/i.test(message)) {
      return { ...empty, missing: true };
    }
    return { ...empty, error: message };
  }
}

export function assertShemeshLibaSettlementMatchesFreelancer(): void {
  const agreement = emptyAgreement("freelancer", "2020-01-01");
  agreement.contract = {
    ...agreement.contract,
    volumePercent: 10,
    freelancerFormula: "custom",
  };
  const shemeshProfile = toPayProfile({
    fullName: SHEMESH_LIBA_AGENT,
    employmentKind: "freelancer",
    agreements: [agreement],
  });
  const peerProfile = toPayProfile({
    fullName: "ניב קובי",
    employmentKind: "freelancer",
    agreements: [{ ...agreement, id: "peer" }],
  });
  const sale = {
    source: "קמפיין שמש",
    premium: 1000,
    status: "active" as const,
    statusRaw: "פעיל",
    process: "מכירה",
    product: "בריאות",
    company: "מגדל",
    startDate: "2026-04-02",
    transferDate: "2026-04-01",
    fields: {},
  };
  const productions: SaleSource[] = [
    { ...sale, key: "shemesh", agent: "שמש", client: "לקוח שמש" },
    { ...sale, key: "peer", agent: "ניב קובי", client: "לקוח אחר" },
    { ...sale, key: "name-only", agent: "ניב - שמש", client: "לא שמש", premium: 500 },
    {
      ...sale,
      key: "pending",
      agent: "שמש",
      client: "ממתין",
      premium: 250,
      status: "pending",
      statusRaw: "ממתין",
    },
  ];
  const shemesh = settlementForAgent(productions, SHEMESH_LIBA_AGENT, shemeshProfile);
  const peer = settlementForAgent(productions, "ניב קובי", peerProfile);
  if (shemesh.sales.length !== 2) {
    throw new Error(`expected Shemesh's own sales rows, got ${shemesh.sales.length}`);
  }
  if (shemesh.sales.some((row) => row.client === "לא שמש" || row.client === "לקוח אחר")) {
    throw new Error("Shemesh settlement included another agent's row");
  }
  if (shemesh.premium !== 1250) {
    throw new Error(`expected Shemesh premium 1250, got ${shemesh.premium}`);
  }
  if (shemesh.owed == null || peer.owed == null || shemesh.owed !== peer.owed) {
    throw new Error(
      `Shemesh owed ${shemesh.owed} should match another עצמאי with the same agreement (${peer.owed})`,
    );
  }
  if (excelAgentKey("ניב - שמש") === excelAgentKey(SHEMESH_LIBA_AGENT)) {
    throw new Error("a name that merely contains שמש must stay a different agent");
  }
  const withoutAgreement = settlementForAgent(productions, SHEMESH_LIBA_AGENT, null);
  if (withoutAgreement.sales.length !== 2 || withoutAgreement.owed != null) {
    throw new Error("without an עצמאי agreement the sales stay and the owed amount stays empty");
  }
}

assertShemeshLibaSettlementMatchesFreelancer();
