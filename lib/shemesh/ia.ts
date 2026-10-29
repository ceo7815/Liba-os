/** Shemesh navigation tree. Pages stay; this only groups them. */

export type ShemeshPage = {
  href: string;
  label: string;
  description: string;
  keywords: string[];
  /** Shay stage, when the page came from the stage list. */
  stage?: string;
};

export type ShemeshGroup = {
  id: string;
  label: string;
  href: string;
  description: string;
  exact?: boolean;
  items: ShemeshPage[];
};

export const SHEMESH_IA: ShemeshGroup[] = [
  {
    id: "home",
    label: "לוח בקרה",
    href: "/shemesh",
    description: "פרסום, לידים ועלות לליד.",
    exact: true,
    items: [],
  },
  {
    id: "clients",
    label: "לקוחות ותיקים",
    href: "/shemesh/clients",
    description: "התיק של הלקוח, מהפדיון ועד הביטוח.",
    items: [
      { href: "/shemesh/cases", label: "תיקים", description: "שלב, מטפל, יעד ו־SLA", keywords: ["תיק", "תיקים", "שלב", "מטפל", "sla"], stage: "pipeline" },
      { href: "/shemesh/alerts", label: "התראות", description: "חריגות SLA, מסמכים חסרים ויעדים", keywords: ["התראה", "התראות", "sla", "מסמך", "יעד"], stage: "alerts" },
      { href: "/shemesh/gviya", label: "פדיונות", description: "גבייה וספר פדיונות", keywords: ["פדיון", "פדיונות", "גבייה", "gviya"], stage: "1" },
      { href: "/shemesh/tax-refunds", label: "החזרי מס", description: "העלאה וספר החזרים", keywords: ["מס", "החזר", "החזרי מס"], stage: "2" },
      { href: "/shemesh/portfolio-report", label: "השוואת תיק", description: "מצב קיים מול מצב חדש", keywords: ["השוואה", "תיק", "פוליסה"] },
      { href: "/shemesh/insurance", label: "ביטוח", description: "התאמה מול חברות", keywords: ["ביטוח", "נפרעים", "פוליסה"], stage: "9" },
    ],
  },
  {
    id: "commercial",
    label: "שיווק ומכירות",
    href: "/shemesh/commercial",
    description: "לידים, קמפיינים ושורות המכירה.",
    items: [
      { href: "/shemesh/leads", label: "לידים", description: "כמות, מקור וסטטוס", keywords: ["ליד", "לידים", "המרה"] },
      { href: "/shemesh/revival", label: "החזרת לידים", description: "תור ותבניות, בלי שליחה", keywords: ["החזרה", "וואטסאפ", "תור"], stage: "7" },
      { href: "/shemesh/marketing", label: "שיווק", description: "קמפיינים בגוגל ובפייסבוק", keywords: ["שיווק", "קמפיין", "גוגל", "פייסבוק"], stage: "8" },
      { href: "/shemesh/sales", label: "שורות מכירה", description: "דוח המכירות של שמש", keywords: ["מכירה", "אקסל", "גיליון"] },
    ],
  },
  {
    id: "finance",
    label: "כספים",
    href: "/shemesh/finance",
    description: "הכנסה, הוצאה והתחשבנות מול ליבה.",
    items: [
      { href: "/shemesh/revenue", label: "הכנסות מגבייה", description: "גבייה וחשבוניות מהדוח", keywords: ["הכנסה", "הכנסות", "גבייה", "חשבונית"] },
      { href: "/shemesh/income", label: "הכנסות חוזרות", description: "כללי הכנסה חודשיים", keywords: ["הכנסה חוזרת", "כלל"] },
      { href: "/shemesh/expenses", label: "הוצאות", description: "הוצאות שוטפות", keywords: ["הוצאה", "הוצאות"] },
      { href: "/shemesh/costs", label: "הוצאות קבועות", description: "שכירות, תוכנה ותקורות", keywords: ["קבוע", "תקורה"], stage: "10" },
      { href: "/shemesh/debts", label: "חובות", description: "הלוואות ותשלום חודשי", keywords: ["חוב", "הלוואה"] },
      { href: "/shemesh/commissions", label: "עמלות", description: "עמלת מטפל לפי רשומה", keywords: ["עמלה", "עמלות"] },
      { href: "/shemesh/receipts", label: "קבלות", description: "קבלות והתאמה לבנק", keywords: ["קבלה", "קבלות"], stage: "4" },
      { href: "/shemesh/payroll", label: "שכר", description: "רשומות שכר בלי סכום קבוע בקוד", keywords: ["שכר", "משכורת"], stage: "5" },
      { href: "/shemesh/reports", label: "רווח והפסד", description: "הכנסות מול פרסום", keywords: ["רווח", "הפסד"] },
      { href: "/shemesh/settlement", label: "התחשבנות מול ליבה", description: "מכירות ביטוח כעצמאי", keywords: ["התחשבנות", "ליבה", "עצמאי"], stage: "11" },
    ],
  },
  {
    id: "system",
    label: "מערכת",
    href: "/shemesh/system",
    description: "חיבורים, נוסחאות, הגדרות והרשאות.",
    items: [
      { href: "/shemesh/sources", label: "חיבורים", description: "פייסבוק, גוגל, שורנס, ריווחית, גרואו וביטוח", keywords: ["חיבור", "ריווחית", "גרואו", "grow", "פייסבוק", "גוגל"] },
      { href: "/shemesh/agency", label: "שורנס", description: "אותה סוכנות או סוכנות נפרדת", keywords: ["שורנס", "surense", "סוכנות"], stage: "3" },
      { href: "/shemesh/formulas", label: "נוסחאות", description: "נוסחאות שמש", keywords: ["נוסחה", "נוסחאות"] },
      { href: "/shemesh/settings", label: "הגדרות", description: "שיעורי עמלה וימי SLA", keywords: ["הגדרות", "עמלה", "sla"] },
      { href: "/shemesh/permissions", label: "הרשאות", description: "צפייה וניהול של שמש", keywords: ["הרשאה", "הרשאות"] },
    ],
  },
];

export function shemeshPages(): ShemeshPage[] {
  return SHEMESH_IA.flatMap((group) => [
    { href: group.href, label: group.label, description: group.description, keywords: [group.label] },
    ...group.items,
  ]);
}

export function shemeshGroupForPath(pathname: string): ShemeshGroup | null {
  const groups = [...SHEMESH_IA].sort((a, b) => b.href.length - a.href.length);
  for (const group of groups) {
    if (group.exact) {
      if (pathname === group.href) return group;
      continue;
    }
    if (
      pathname === group.href ||
      pathname.startsWith(`${group.href}/`) ||
      group.items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    ) {
      return group;
    }
  }
  return null;
}

export function shemeshCrumbs(pathname: string): { href: string; label: string }[] {
  const group = shemeshGroupForPath(pathname);
  if (!group) return [{ href: "/shemesh", label: "שמש" }];
  const page = group.items.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const crumbs = [{ href: "/shemesh", label: "שמש" }];
  if (group.id !== "home") crumbs.push({ href: group.href, label: group.label });
  if (pathname.startsWith("/shemesh/clients/card")) crumbs.push({ href: pathname, label: "כרטיס לקוח" });
  if (page && page.href !== group.href) crumbs.push({ href: page.href, label: page.label });
  return crumbs;
}
