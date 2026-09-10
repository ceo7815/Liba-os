/**
 * Canonical permission catalog — one key per nav item / capability.
 * Keys are stored on profile_permissions and enforced in UI + server gates.
 */

export const PERMISSION_KEYS = [
  "dashboard.view",
  "agents.view",
  "agents.manage",
  "vault.view",
  "vault.manage",
  "sales.view",
  "finance.pl_general",
  "finance.source_pnl",
  "finance.fixed_expenses",
  "finance.insurance",
  "finance.settled",
  "finance.ledger",
  "employees.view",
  "employees.agreements",
  "org.users",
  "portals.view",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export type PermissionDef = {
  key: PermissionKey;
  label: string;
  description: string;
};

export type PermissionCategory = {
  id: string;
  label: string;
  description: string;
  permissions: PermissionDef[];
};

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    id: "overview",
    label: "סקירה",
    description: "לוח הבקרה הראשי",
    permissions: [
      {
        key: "dashboard.view",
        label: "לוח בקרה",
        description: "צפייה בלוח הבקרה הראשי",
      },
    ],
  },
  {
    id: "work",
    label: "עבודה",
    description: "סוכני AI וכספת סיסמאות",
    permissions: [
      {
        key: "agents.view",
        label: "סוכני AI — צפייה",
        description: "גישה למסכי הסוכנים",
      },
      {
        key: "agents.manage",
        label: "סוכני AI — ניהול",
        description: "מפתחות API והגדרות סוכן",
      },
      {
        key: "vault.view",
        label: "כספת — צפייה",
        description: "צפייה וחשיפת סיסמאות",
      },
      {
        key: "vault.manage",
        label: "כספת — ניהול",
        description: "יצירה, עריכה ומחיקה",
      },
    ],
  },
  {
    id: "sales",
    label: "מכירות",
    description: "דשבורד מכירות במשרד",
    permissions: [
      {
        key: "sales.view",
        label: "דשבורד מכירות",
        description: "תצוגה מקדימה של מסך המכירות",
      },
    ],
  },
  {
    id: "finance",
    label: "חשבונות ליבה",
    description: "דוחות רווח והפסד ותקורות",
    permissions: [
      {
        key: "finance.pl_general",
        label: "דוח רווח והפסד כללי",
        description: "סיכום רווח והפסד מהאקסל",
      },
      {
        key: "finance.source_pnl",
        label: "רווח והפסד לפי מקור (היקף)",
        description: "פירוט מכירות (היקף) לפי מקור הפנייה + מודעות",
      },
      {
        key: "finance.fixed_expenses",
        label: "הוצאות",
        description: "הוצאות קבועות ומשתנות — תקורות ורישום",
      },
      {
        key: "finance.insurance",
        label: "הסכמי ביטוח",
        description: "הסכמים מול חברות הביטוח",
      },
      {
        key: "finance.settled",
        label: "נפרעים",
        description: "רווח והפסד לפי מקור — מינוי סוכן מהאקסל",
      },
      {
        key: "finance.ledger",
        label: "רישום תנועות",
        description: "יומן תנועות ידני (משני)",
      },
    ],
  },
  {
    id: "employees",
    label: "עובדים",
    description: "משאבי אנוש והסכמים",
    permissions: [
      {
        key: "employees.view",
        label: "רשימת עובדים",
        description: "צפייה וניהול רשימת העובדים",
      },
      {
        key: "employees.agreements",
        label: "הסכמי עובדים",
        description: "הסכמי שכר ועמלות, כולל דוח משכורות מרוכז",
      },
    ],
  },
  {
    id: "org",
    label: "ארגון",
    description: "ניהול גישה למערכת",
    permissions: [
      {
        key: "org.users",
        label: "ניהול משתמשים והרשאות",
        description: "הזמנה, תפקידים ומטריצת הרשאות",
      },
      {
        key: "portals.view",
        label: "פורטלים",
        description: "גישה למסך הפורטלים",
      },
    ],
  },
];

export type PermissionPresetId =
  | "employee"
  | "sales"
  | "finance"
  | "manager"
  | "full"
  | "custom";

export type PermissionPreset = {
  id: PermissionPresetId;
  label: string;
  description: string;
  keys: PermissionKey[];
};

const ALL = [...PERMISSION_KEYS];

export const PERMISSION_PRESETS: PermissionPreset[] = [
  {
    id: "employee",
    label: "עובד",
    description: "לוח בקרה, סוכנים וכספת לקריאה",
    keys: ["dashboard.view", "agents.view", "vault.view"],
  },
  {
    id: "sales",
    label: "מכירות",
    description: "עובד + דשבורד מכירות",
    keys: ["dashboard.view", "agents.view", "vault.view", "sales.view"],
  },
  {
    id: "finance",
    label: "כספים",
    description: "כל חשבונות ליבה + לוח בקרה",
    keys: [
      "dashboard.view",
      "finance.pl_general",
      "finance.source_pnl",
      "finance.fixed_expenses",
      "finance.insurance",
      "finance.settled",
      "finance.ledger",
    ],
  },
  {
    id: "manager",
    label: "מנהל תפעול",
    description: "מכירות, עובדים ועבודה — בלי כספים",
    keys: [
      "dashboard.view",
      "agents.view",
      "agents.manage",
      "vault.view",
      "vault.manage",
      "sales.view",
      "employees.view",
      "employees.agreements",
      "portals.view",
    ],
  },
  {
    id: "full",
    label: "גישה מלאה",
    description: "כל הקטגוריות כולל ניהול משתמשים וכספים",
    keys: ALL,
  },
  {
    id: "custom",
    label: "מותאם אישית",
    description: "בחירה ידנית לכל סעיף",
    keys: [],
  },
];

export function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(value);
}

export function normalizePermissionKeys(
  keys: readonly string[] | null | undefined,
): PermissionKey[] {
  if (!keys?.length) return [];
  const set = new Set<PermissionKey>();
  for (const key of keys) {
    if (isPermissionKey(key)) set.add(key);
  }
  return PERMISSION_KEYS.filter((k) => set.has(k));
}

export function matchPreset(keys: readonly PermissionKey[]): PermissionPresetId {
  const set = new Set(keys);
  const same = (presetKeys: PermissionKey[]) =>
    presetKeys.length === set.size && presetKeys.every((k) => set.has(k));

  for (const preset of PERMISSION_PRESETS) {
    if (preset.id === "custom") continue;
    if (same(preset.keys)) return preset.id;
  }
  return "custom";
}

export function countGrantedInCategory(
  category: PermissionCategory,
  keys: ReadonlySet<string>,
): { granted: number; total: number } {
  const total = category.permissions.length;
  const granted = category.permissions.filter((p) => keys.has(p.key)).length;
  return { granted, total };
}
