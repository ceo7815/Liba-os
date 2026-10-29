import { adAccountBrand, googleCustomerBrand } from "@/lib/finance/brand-accounts";
import { SHEMESH_SUPPLIER_SOURCES } from "@/lib/shemesh/catalog";
import { normalizeExcelText } from "@/lib/sales-dashboard/columns";
import {
  canonicalAgentName,
  GOOGLE_ADS_CUBE_SOURCE,
  GOOGLE_ADS_SHEMESH_CUBE_SOURCE,
  isLibaGoogleAdsCube,
  isShemeshGoogleAdsCube,
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

/** Exact supplier-source label. A name that merely contains «שמש» is not a brand. */
export function isShemeshSourceName(name: string | null | undefined): boolean {
  const value = normalizeExcelText(name ?? "");
  if (!value) return false;
  return SHEMESH_SUPPLIER_SOURCES.some((source) => normalizeExcelText(source) === value);
}

export function isShemeshAgentName(
  name: string | null | undefined,
  shemeshEmployeeNames: Iterable<string> = [],
): boolean {
  const canon = canonicalAgentName(normalizeExcelText(name ?? ""));
  if (!canon) return false;
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
  assigned: AssignedOperatingBrand | null,
  selected: OperatingBrandId,
): boolean {
  if (selected === "all") return true;
  if (!assigned) return false;
  return assigned === selected;
}

export function sourceNameVisibleInBrand(
  sourceName: string,
  selected: OperatingBrandId,
  hasRowsInBrand: boolean,
): boolean {
  if (selected === "all") return true;
  if (isLibaGoogleAdsCube(sourceName)) {
    return selected === "liba" || hasRowsInBrand;
  }
  if (isShemeshGoogleAdsCube(sourceName)) {
    return selected === "shemesh" || hasRowsInBrand;
  }
  if (hasRowsInBrand) return true;
  if (selected === "shemesh") return isShemeshSourceName(sourceName);
  return !isShemeshSourceName(sourceName);
}

/** Google campaign «פיננסים» lands on שמש. «ביטוחים» / liba names land on ליבה. */
export function defaultGoogleAdsCubeForCampaign(campaignName: string): string {
  return googleCampaignOperatingBrand(campaignName) === "shemesh"
    ? GOOGLE_ADS_SHEMESH_CUBE_SOURCE
    : GOOGLE_ADS_CUBE_SOURCE;
}

export function adsSourceBrand(sourceName: string): AssignedOperatingBrand {
  return isShemeshSourceName(sourceName) ? "shemesh" : "liba";
}

/** Google brand follows the customer id allowlist. The campaign name is ignored. */
export function googleCampaignOperatingBrand(
  campaignName: string,
  customerId?: string | null,
): AssignedOperatingBrand | null {
  void campaignName;
  return googleCustomerBrand(customerId);
}

export function filterGoogleCampaignsForBrand<
  T extends { googleCampaignName: string },
>(campaigns: T[], brand: OperatingBrandId): T[] {
  if (brand === "all") return campaigns;
  return campaigns.filter((row) =>
    matchesOperatingBrand(googleCampaignOperatingBrand(row.googleCampaignName), brand),
  );
}

/** Brand comes from the ad-account id allowlist. The account name is ignored. */
export function facebookAccountBrand(
  account:
    | string
    | null
    | undefined
    | { accountId?: string | null; accountName?: string | null },
): AssignedOperatingBrand | null {
  const id = typeof account === "string" || account == null ? account : account.accountId;
  return adAccountBrand(id);
}

/** Known account id wins. Without an id, only an explicit supplier source is Shemesh. */
export function facebookCampaignVisibleInBrand(
  campaign: {
    sourceName: string | null;
    adAccountName?: string | null;
    adAccountId?: string | null;
  },
  brand: OperatingBrandId,
): boolean {
  if (brand === "all") return true;
  const id = campaign.adAccountId?.trim();
  if (id) return facebookAccountBrand({ accountId: id }) === brand;
  if (isShemeshSupplierSource(campaign.sourceName)) return brand === "shemesh";
  if (campaign.sourceName) return brand === "liba";
  return false;
}

function isShemeshSupplierSource(name: string | null | undefined): boolean {
  return isShemeshSourceName(name);
}

export function filterFacebookCampaignsForBrand<
  T extends { sourceName: string | null; adAccountName?: string | null; adAccountId?: string | null },
>(campaigns: T[], brand: OperatingBrandId): T[] {
  if (brand === "all") return campaigns;
  return campaigns.filter((row) => facebookCampaignVisibleInBrand(row, brand));
}

export function parseOperatingBrand(value: string | null | undefined): OperatingBrandId | null {
  if (value === "all" || value === "liba" || value === "shemesh") return value;
  if (value === "musdar") return "liba";
  return null;
}

/** Brand field only: wait circle exactly «שמש». A name or a note is not a brand. */
export function employeeLooksLikeShemesh(input: {
  fullName?: string | null;
  waitCircle?: string | null;
  notes?: string | null;
}): boolean {
  void input.fullName;
  void input.notes;
  const circle = normalizeExcelText(input.waitCircle ?? "").toLowerCase();
  return circle === "שמש" || circle === "shemesh";
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
  void cost.notes;
  void cost.vendor_name;
  if (isShemeshSourceName(cost.title)) return true;
  return (cost.allocations ?? []).some((row) => isShemeshSourceName(row.source_name));
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
  if (assignOperatingBrand({ agent: "שמש", source: "שיחות נכנסות" }) !== "liba") {
    throw new Error("agent name alone is not a brand");
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
  if (assignOperatingBrand({ agent: "ניב - שמש", source: "לידים קרים" }) !== "liba") {
    throw new Error("a name containing שמש is not a brand");
  }
  if (parseOperatingBrand("musdar") !== "liba") {
    throw new Error("saved musdar filter should become liba");
  }
  if (googleCampaignOperatingBrand("פיננסים") !== null) {
    throw new Error("campaign name is not a brand");
  }
  if (googleCampaignOperatingBrand("ביטוחים", "6469861321") !== "liba") {
    throw new Error("Liba Google customer should be liba");
  }
  if (googleCampaignOperatingBrand("x", "932578606562493") !== null) {
    throw new Error("unknown account should belong to neither brand");
  }
  if (defaultGoogleAdsCubeForCampaign("ביטוחים") !== GOOGLE_ADS_CUBE_SOURCE) {
    throw new Error("ביטוחים should map to שיחות נכנסות");
  }
  if (defaultGoogleAdsCubeForCampaign("פיננסים") !== GOOGLE_ADS_CUBE_SOURCE) {
    throw new Error("unnamed google customer stays on the liba cube");
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
  if (facebookCampaignVisibleInBrand({ sourceName: null }, "liba")) {
    throw new Error("facebook row without an account id must not count as liba");
  }
  if (facebookCampaignVisibleInBrand({ sourceName: null }, "shemesh")) {
    throw new Error("facebook row without an account id must not count as shemesh");
  }
  if (
    !facebookCampaignVisibleInBrand(
      { sourceName: null, adAccountId: "2542541459538449" },
      "shemesh",
    )
  ) {
    throw new Error("shemesh ad account id must appear on shemesh");
  }
  if (
    facebookCampaignVisibleInBrand(
      { sourceName: "שיחות נכנסות", adAccountId: "1111111111" },
      "liba",
    )
  ) {
    throw new Error("unknown ad account must not count as liba");
  }
  if (sourceNameVisibleInBrand("שיחות נכנסות", "shemesh", false)) {
    throw new Error("שיחות נכנסות must not appear on shemesh without shemesh rows");
  }
  if (!sourceNameVisibleInBrand("שיחות נכנסות", "liba", false)) {
    throw new Error("שיחות נכנסות must appear on liba");
  }
  if (!sourceNameVisibleInBrand("קמפיין שמש", "shemesh", false)) {
    throw new Error("קמפיין שמש must appear on shemesh");
  }
  if (sourceNameVisibleInBrand("קמפיין שמש", "liba", false)) {
    throw new Error("קמפיין שמש must not appear on liba without liba rows");
  }
}
