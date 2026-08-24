/** Excel contract for the sales dashboard. First sheet only. Headers must match after trim. */

export const COL = {
  status: "סטאטוס פוליסה",
  premium: "פרמיה",
  process: "סוג תהליך",
  transferDate: "תאריך העברה ליצרן",
  startDate: "תאריך תחילת ביטוח",
  client: "שם לקוח",
  agent: "משווק",
  product: "סוג המוצר",
  company: "חברת הביטוח",
  source: "מקור הפנייה",
} as const;

export const STATUS = {
  active: "פעילה",
  activeShort: "פעיל",
  pending: "ממתינה למינוי",
  archived: "גניזה",
  cancelled: "בוטלה",
} as const;

export const PROCESS = {
  sale: "מכירה",
  appointment: "מינוי",
} as const;

export const HEBREW_MONTHS: Record<string, string> = {
  "01": "ינו",
  "02": "פבר",
  "03": "מרץ",
  "04": "אפר",
  "05": "מאי",
  "06": "יוני",
  "07": "יולי",
  "08": "אוג",
  "09": "ספט",
  "10": "אוק",
  "11": "נוב",
  "12": "דצ",
};

export const JERUSALEM_TZ = "Asia/Jerusalem";
