export const SHEMESH_SOURCE_IDS = [
  "insurance",
  "facebook_ads",
  "google_ads",
  "rivhit",
  "grow",
  "shared_folder",
] as const;

export type ShemeshSourceId = (typeof SHEMESH_SOURCE_IDS)[number];

export const AD_PLATFORMS = ["facebook", "google", "other"] as const;
export type AdPlatform = (typeof AD_PLATFORMS)[number];

export const LEAD_STATUSES = ["new", "in_progress", "converted", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const INCOME_KINDS = ["fee", "insurance_sale"] as const;
export type IncomeKind = (typeof INCOME_KINDS)[number];

export const EXPENSE_KINDS = ["salary", "operating", "invoice"] as const;
export type ExpenseKind = (typeof EXPENSE_KINDS)[number];

export type ShemeshLead = {
  sourceId: ShemeshSourceId;
  /** Stable id inside the source. A repeat sync must reuse it. */
  externalId: string;
  adPlatform: AdPlatform | null;
  campaignId: string | null;
  campaignName: string | null;
  status: LeadStatus;
  arrivedOn: string;
  convertedOn: string | null;
};

export type ShemeshSpend = {
  sourceId: "facebook_ads" | "google_ads" | "shared_folder";
  externalId: string;
  adPlatform: AdPlatform;
  campaignId: string;
  campaignName: string;
  day: string;
  spend: number;
};

export type ShemeshRevenue = {
  sourceId: ShemeshSourceId;
  externalId: string;
  kind: IncomeKind;
  /** Amount as recorded by the source. Not a calculated commission. */
  amount: number;
  day: string;
  adPlatform: AdPlatform | null;
  campaignId: string | null;
};

export type ShemeshExpense = {
  sourceId: ShemeshSourceId;
  externalId: string;
  kind: ExpenseKind;
  amount: number;
  day: string;
  employeeName: string | null;
  invoiceRef: string | null;
};

export type ShemeshSnapshot = {
  leads: ShemeshLead[];
  spend: ShemeshSpend[];
  revenue: ShemeshRevenue[];
  expenses: ShemeshExpense[];
};

export const EMPTY_SHEMESH_SNAPSHOT: ShemeshSnapshot = {
  leads: [],
  spend: [],
  revenue: [],
  expenses: [],
};

export type ShemeshFilter = {
  from: string;
  to: string;
  adPlatform: AdPlatform | "all";
  campaignId: string | "all";
  incomeKind: IncomeKind | "all";
};

export const AD_PLATFORM_LABEL: Record<AdPlatform, string> = {
  facebook: "פייסבוק",
  google: "גוגל",
  other: "אחר",
};

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "חדש",
  in_progress: "בטיפול",
  converted: "הומר לעסקה",
  lost: "לא רלוונטי",
};

export const INCOME_KIND_LABEL: Record<IncomeKind, string> = {
  fee: "שכר טרחה",
  insurance_sale: "מכירת ביטוח",
};

export const EXPENSE_KIND_LABEL: Record<ExpenseKind, string> = {
  salary: "משכורת",
  operating: "הוצאה שוטפת",
  invoice: "חשבונית",
};

export const SOURCE_LABEL: Record<ShemeshSourceId, string> = {
  insurance: "Insurance",
  facebook_ads: "Facebook Ads",
  google_ads: "Google Ads",
  rivhit: "ריווחית",
  grow: "Grow",
  shared_folder: "תיקייה שיתופית",
};
