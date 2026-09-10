/** מסך נפרעים — תבנית בלבד עד שיגיעו דוחות הנפרעים (מקור נפרד מדוח המנהלים). */

export const SETTLED_SCREEN = {
  title: "נפרעים",
  subtitle: "עמלות שוטפות לפי פרמיה שנגבתה בפועל — מקור נתונים נפרד מדוח המנהלים",
  status: "ממתין לדוחות" as const,
  statusNote:
    "הקטגוריה מוכנה. נוסחה וייבוא יחוברו אחרי שנקבל דוח נפרעים ונבין איזה עובד מטפל בו.",
  notFromManagersExcel:
    "דוח המנהלים (Excel) לא משמש כאן. נפרעים מגיעים מדוח נפרד — כשיהיה בידנו נמפה עמודות ונחבר.",
  agreementsHref: "/finance/insurance-agreements",
  agreementsLabel: "הסכמי מגדל — שיעורי נפרעים לפי חוזה",
};

export type SettledTemplateColumn = {
  id: string;
  label: string;
  role: string;
  required: boolean;
};

/** עמודות צפויות בדוח נפרעים — יעודכנו מול הקובץ האמיתי. */
export const SETTLED_TEMPLATE_COLUMNS: SettledTemplateColumn[] = [
  {
    id: "period",
    label: "חודש / תקופת דיווח",
    role: "לאיזה חודש שייכת העמלה ב-PnL",
    required: true,
  },
  {
    id: "company",
    label: "חברת ביטוח",
    role: "סינון מגדל / מקפת / אחר",
    required: true,
  },
  {
    id: "product",
    label: "סוג מוצר / כיסוי",
    role: "בחירת שיעור עמלה מהחוזה",
    required: true,
  },
  {
    id: "policy_ref",
    label: "מספר פוליסה / מזהה",
    role: "קישור לסגירה ולקוח",
    required: false,
  },
  {
    id: "settled_premium",
    label: "נפרעית פרמיה",
    role: "בסיס לחישוב — מה שנגבה בפועל",
    required: true,
  },
  {
    id: "policy_year",
    label: "שנת פוליסה (א' / ב' / …)",
    role: "שיעור משתנה לפי שנה",
    required: true,
  },
  {
    id: "rate",
    label: "שיעור עמלה %",
    role: "מהחוזה או מהדוח — לאימות",
    required: false,
  },
  {
    id: "commission",
    label: "סכום עמלה (₪)",
    role: "תוצאה מהדוח או מחישוב",
    required: true,
  },
  {
    id: "agent",
    label: "משווק / סוכן",
    role: "שיוך פנימי (לא חובה לחישוב מגדל)",
    required: false,
  },
  {
    id: "status",
    label: "סטטוס שורה",
    role: "פעיל / בוטל / החזר",
    required: false,
  },
];

export type SettledPendingItem = {
  id: string;
  title: string;
  detail: string;
};

export const SETTLED_PENDING: SettledPendingItem[] = [
  {
    id: "report-sample",
    title: "קובץ / דגימת דוח נפרעים",
    detail: "Excel או ייצוא מפורטל — גם ריק עם כותרות מספיק להתחלת מיפוי",
  },
  {
    id: "owner-employee",
    title: "איזה עובד אחראי על הדוח",
    detail: "מי מוריד / מעלה / מאמת מול מגדל בכל חודש",
  },
  {
    id: "column-map",
    title: "אישור מיפוי עמודות",
    detail: "התאמת התבנית למטה לשמות האמיתיים בקובץ",
  },
  {
    id: "formula",
    title: "חיבור נוסחה מהחוזה",
    detail: "נפרעית × שיעור לפי מוצר + שנת פוליסה (מגדל noname 2)",
  },
];

export const SETTLED_KPI_PLACEHOLDERS = [
  { id: "month_total", label: "סה״כ נפרעים לחודש", value: "—" },
  { id: "policies", label: "שורות / פוליסות", value: "—" },
  { id: "avg_rate", label: "שיעור ממוצע", value: "—" },
  { id: "companies", label: "חברות בדוח", value: "—" },
] as const;

export const SETTLED_FORMULA_PREVIEW = {
  title: "נוסחה צפויה (טרם מחוברת)",
  formula: "עמלת נפרעים = נפרעית פרמיה × שיעור (מוצר + שנת פוליסה)",
  note: "בריאות §9 ≠ חיים §8 — שיעורים ושנות פוליסה נפרדים. החישוב החי ירוץ אחרי ייבוא מדוח הנפרעים.",
};
