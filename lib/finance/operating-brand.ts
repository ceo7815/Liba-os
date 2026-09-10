import { normalizeExcelText } from "@/lib/sales-dashboard/columns";
import {
  canonicalAgentName,
  isGoogleAdsCube,
} from "@/lib/sales-dashboard/campaign-math";

export const OPERATING_BRANDS = ["all", "liba", "shemesh"] as const;
export type OperatingBrandId = (typeof OPERATING_BRANDS)[number];
export type AssignedOperatingBrand = "liba" | "shemesh";

export const DEFAULT_OPERATING_BRAND: OperatingBrandId = "liba";
export const OPERATING_BRAND_STORAGE_KEY = "liba-operating-brand";

export const OPERATING_BRAND_LABEL: Record<OperatingBrandId, string> = {
  all: "הכל",
  liba: "ליבה",
  shemesh: "שמש",
};

const SHEMESH_TOKEN = "שמש";
const MUSDAR_TOKENS = ["מוסדר", "סגל"] as const;

function textHasStandaloneToken(value: string, token: string): boolean {
  if (!value) return false;
  if (value === token) return true;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:$|[^\\p{L}\\p{N}])`, "u").test(
    value,
  );
}

/** «שמש» as its own word — not שמשון, not חברת ביטוח. */
export function textHasShemeshToken(value: string | null | undefined): boolean {
  const v = normalizeExcelText(value ?? "");
  return textHasStandaloneToken(v, SHEMESH_TOKEN);
}

/** מוסדר / סגל as its own word — Excel team suffix, not a substring of another name. */
export function textHasMusdarToken(value: string | null | undefined): boolean {
  const v = normalizeExcelText(value ?? "");
  return MUSDAR_TOKENS.some((token) => textHasStandaloneToken(v, token));
}

export function isShemeshSourceName(name: string | null | undefined): boolean {
  return textHasShemeshToken(name);
}

export function isShemeshAgentName(
  name: string | null | undefined,
  shemeshEmployeeNames: Iterable<string> = [],
): boolean {
  const raw = normalizeExcelText(name ?? "");
  if (!raw) return false;
  if (textHasShemeshToken(raw)) return true;
  const canon = canonicalAgentName(raw);
  for (const employee of Array.from(shemeshEmployeeNames)) {
    if (canonicalAgentName(employee) === canon) return true;
  }
  return false;
}

export function isMusdarAgentName(
  name: string | null | undefined,
  musdarEmployeeNames: Iterable<string> = [],
): boolean {
  const raw = normalizeExcelText(name ?? "");
  if (!raw) return false;
  if (textHasMusdarToken(raw)) return true;
  const canon = canonicalAgentName(raw);
  for (const employee of Array.from(musdarEmployeeNames)) {
    if (canonicalAgentName(employee) === canon) return true;
  }
  return false;
}

export function assignOperatingBrand(input: {
  agent?: string | null;
  source?: string | null;
  shemeshEmployeeNames?: Iterable<string>;
  musdarEmployeeNames?: Iterable<string>;
}): AssignedOperatingBrand {
  if (isShemeshAgentName(input.agent, input.shemeshEmployeeNames)) return "shemesh";
  if (isShemeshSourceName(input.source)) return "shemesh";
  return "liba";
}

export function matchesOperatingBrand(
  assigned: AssignedOperatingBrand,
  selected: OperatingBrandId,
): boolean {
  if (selected === "all") return true;
  return assigned === selected;
}

export function sourceNameVisibleInBrand(
  sourceName: string,
  selected: OperatingBrandId,
  hasRowsInBrand: boolean,
): boolean {
  if (selected === "all") return true;
  if (isGoogleAdsCube(sourceName)) return true;
  if (hasRowsInBrand) return true;
  if (selected === "shemesh") return isShemeshSourceName(sourceName);
  return !isShemeshSourceName(sourceName);
}

/** Ads follow the source name, not the agent on a mixed source. */
export function adsSourceBrand(sourceName: string): AssignedOperatingBrand {
  return isShemeshSourceName(sourceName) ? "shemesh" : "liba";
}

/** Google campaign «פיננסים» = שמש. «ביטוחים» / liba = ליבה. */
export function googleCampaignOperatingBrand(
  campaignName: string,
): AssignedOperatingBrand {
  const v = normalizeExcelText(campaignName);
  if (!v) return "liba";
  if (v.includes("פיננס") || textHasShemeshToken(v)) return "shemesh";
  return "liba";
}

export function filterGoogleCampaignsForBrand<
  T extends { googleCampaignName: string },
>(campaigns: T[], brand: OperatingBrandId): T[] {
  if (brand === "all") return campaigns;
  return campaigns.filter((row) =>
    matchesOperatingBrand(googleCampaignOperatingBrand(row.googleCampaignName), brand),
  );
}

/** Mapping table only: assigned cubes stay on their brand tab. Unmapped stay on every tab. */
export function facebookCampaignVisibleInBrand(
  campaign: { sourceName: string | null },
  brand: OperatingBrandId,
): boolean {
  if (brand === "all") return true;
  if (!campaign.sourceName) return true;
  return matchesOperatingBrand(adsSourceBrand(campaign.sourceName), brand);
}

export function filterFacebookCampaignsForBrand<
  T extends { sourceName: string | null },
>(campaigns: T[], brand: OperatingBrandId): T[] {
  if (brand === "all") return campaigns;
  return campaigns.filter((row) => facebookCampaignVisibleInBrand(row, brand));
}

export function parseOperatingBrand(value: string | null | undefined): OperatingBrandId | null {
  if (value === "all" || value === "liba" || value === "shemesh") return value;
  if (value === "musdar") return "liba";
  return null;
}

export function employeeLooksLikeShemesh(input: {
  fullName?: string | null;
  waitCircle?: string | null;
  notes?: string | null;
}): boolean {
  return (
    textHasShemeshToken(input.waitCircle) ||
    textHasShemeshToken(input.fullName) ||
    textHasShemeshToken(input.notes)
  );
}

export function displayWaitCircle(value: string | null | undefined): string {
  const v = value?.trim() || "";
  if (!v) return "ללא מעגל";
  if (v === "מוסדר") return "ליבה";
  return v;
}

export function employeeLooksLikeMusdar(input: {
  fullName?: string | null;
  waitCircle?: string | null;
  notes?: string | null;
}): boolean {
  return (
    textHasMusdarToken(input.waitCircle) ||
    textHasMusdarToken(input.fullName) ||
    textHasMusdarToken(input.notes)
  );
}

export function employeeOperatingBrand(input: {
  fullName?: string | null;
  waitCircle?: string | null;
  notes?: string | null;
}): AssignedOperatingBrand {
  if (employeeLooksLikeShemesh(input)) return "shemesh";
  return "liba";
}

export function fixedCostLooksLikeShemesh(cost: {
  title?: string | null;
  notes?: string | null;
  vendor_name?: string | null;
  allocations?: { source_name: string }[];
}): boolean {
  if (textHasShemeshToken(cost.title)) return true;
  if (textHasShemeshToken(cost.notes)) return true;
  if (textHasShemeshToken(cost.vendor_name)) return true;
  return (cost.allocations ?? []).some((row) => textHasShemeshToken(row.source_name));
}

export function assertOperatingBrandRules() {
  if (!textHasShemeshToken("שמש")) throw new Error("שמש should match");
  if (!textHasShemeshToken("קמפיין שמש")) throw new Error("קמפיין שמש should match");
  if (!textHasShemeshToken("ניב - שמש")) throw new Error("ניב - שמש should match");
  if (textHasShemeshToken("שמשון")) throw new Error("שמשון should not match");
  if (textHasShemeshToken("מגדל")) throw new Error("מגדל should not match");
  if (assignOperatingBrand({ agent: "ניב קובי", source: "קמפיין שמש" }) !== "shemesh") {
    throw new Error("source קמפיין שמש should be shemesh");
  }
  if (assignOperatingBrand({ agent: "שמש", source: "שיחות נכנסות" }) !== "shemesh") {
    throw new Error("agent שמש should be shemesh");
  }
  if (
    assignOperatingBrand({
      agent: "שי בר און",
      source: "שיחות נכנסות",
      shemeshEmployeeNames: ["שי בר און"],
    }) !== "shemesh"
  ) {
    throw new Error("shemesh employee should map to shemesh");
  }
  if (assignOperatingBrand({ agent: "ניב קובי", source: "שיחות נכנסות" }) !== "liba") {
    throw new Error("plain liba row should stay liba");
  }
  if (assignOperatingBrand({ agent: "לי מלאכי - סגל", source: "לידים קרים" }) !== "liba") {
    throw new Error("סגל agent belongs to liba");
  }
  if (assignOperatingBrand({ agent: "בן סגל", source: "שיחות נכנסות" }) !== "liba") {
    throw new Error("בן סגל belongs to liba");
  }
  if (employeeOperatingBrand({ fullName: "טופז - סגל", waitCircle: "מוסדר" }) !== "liba") {
    throw new Error("מוסדר wait circle is liba");
  }
  if (assignOperatingBrand({ agent: "ניב - שמש", source: "לידים קרים" }) !== "shemesh") {
    throw new Error("shemesh marker should win over liba");
  }
  if (parseOperatingBrand("musdar") !== "liba") {
    throw new Error("saved musdar filter should become liba");
  }
  if (googleCampaignOperatingBrand("פיננסים") !== "shemesh") {
    throw new Error("פיננסים ads should be shemesh");
  }
  if (googleCampaignOperatingBrand("ביטוחים") !== "liba") {
    throw new Error("ביטוחים ads should be liba");
  }
  if (googleCampaignOperatingBrand("msm_phone_Calls_liba") !== "liba") {
    throw new Error("liba-named google campaign should stay liba");
  }
  if (facebookCampaignVisibleInBrand({ sourceName: "קמפיין שמש" }, "liba")) {
    throw new Error("shemesh-mapped facebook campaign must not appear on liba");
  }
  if (!facebookCampaignVisibleInBrand({ sourceName: "קמפיין שמש" }, "shemesh")) {
    throw new Error("shemesh-mapped facebook campaign must appear on shemesh");
  }
  if (!facebookCampaignVisibleInBrand({ sourceName: "דף נחיתה אינטרנט" }, "liba")) {
    throw new Error("liba-mapped facebook campaign must appear on liba");
  }
  if (facebookCampaignVisibleInBrand({ sourceName: "דף נחיתה אינטרנט" }, "shemesh")) {
    throw new Error("liba-mapped facebook campaign must not appear on shemesh");
  }
  if (!facebookCampaignVisibleInBrand({ sourceName: null }, "liba")) {
    throw new Error("unmapped facebook campaign must stay on liba");
  }
  if (!facebookCampaignVisibleInBrand({ sourceName: null }, "shemesh")) {
    throw new Error("unmapped facebook campaign must stay on shemesh");
  }
  if (!sourceNameVisibleInBrand("שיחות נכנסות", "shemesh", false)) {
    throw new Error("שיחות נכנסות must appear on shemesh");
  }
  if (!sourceNameVisibleInBrand("שיחות נכנסות", "liba", false)) {
    throw new Error("שיחות נכנסות must appear on liba");
  }
}
