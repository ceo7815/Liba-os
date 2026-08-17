export const VAULT_CATEGORIES = [
  "facebook",
  "website",
  "server",
  "insurer",
  "other",
] as const;

export type VaultCategory = (typeof VAULT_CATEGORIES)[number];

export const VAULT_CATEGORY_LABELS: Record<VaultCategory, string> = {
  facebook: "פייסבוק",
  website: "אתר",
  server: "שרת",
  insurer: "חברת ביטוח",
  other: "אחר",
};

export function isVaultCategory(v: unknown): v is VaultCategory {
  return (
    typeof v === "string" &&
    (VAULT_CATEGORIES as readonly string[]).includes(v)
  );
}

export function getVaultCategoryLabel(category: string) {
  if (isVaultCategory(category)) return VAULT_CATEGORY_LABELS[category];
  return category;
}

export type VaultEntryMeta = {
  id: string;
  title: string;
  username: string | null;
  description: string | null;
  category: VaultCategory;
  system_type: string | null;
  login_url: string | null;
  created_at: string;
  updated_at: string;
  has_password: boolean;
};
