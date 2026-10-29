/** Operational source labels from the Shemesh process list. Not payroll. */

export const SHEMESH_SUPPLIER_SOURCES = [
  "לקוחות שמש",
  "שיחה נכנסת שמש",
  "קמפיין שמש",
  "ליד-קון",
  "יניב פדיונות",
  "אזולאי הצלחה",
  "פדיונות חן בר און",
] as const;

export const SHEMESH_HANDLERS = [
  "מתן בריזלי",
  "אוריאל כהן",
  "יונתן וודובוז",
  "נדב לוי",
  "שי בר און",
  "דורון שושני",
  "אגם פרץ",
  "רועי אזולאי",
  "מאי אברגל",
  "לירון כהן",
  "תפעול שמש",
] as const;

export const CASE_STAGES = [
  { id: "lead", label: "ליד" },
  { id: "eligibility", label: "בדיקת זכאות" },
  { id: "poa", label: "ייפוי כוח נחתם" },
  { id: "documents", label: "מסמכים" },
  { id: "filed", label: "הוגש" },
  { id: "followup", label: "מעקב" },
  { id: "refund", label: "החזר התקבל" },
  { id: "collected", label: "חויב / נגבה" },
] as const;

export type CaseStageId = (typeof CASE_STAGES)[number]["id"];

export const ROADMAP: {
  stage: string;
  title: string;
  detail: string;
  href?: string;
}[] = [
  { stage: "10", href: "/shemesh/costs", title: "הוצאות קבועות", detail: "סעיפים ומחשבון, בלי סכומים אמיתיים בקוד" },
  { stage: "4", href: "/shemesh/receipts", title: "קבלות ותיקייה", detail: "העלאת קבלות גוגל ופייסבוק והוצאות מהתיקייה" },
  { stage: "9", href: "/shemesh/insurance", title: "ביטוח ונפרעים", detail: "התאמה מול חברות, בלי נוסחת עמלה עד אישור" },
  { stage: "11", href: "/shemesh/settlement", title: "הכנסה והתחשבנות", detail: "גבייה, נפרעים, ומעבר מליבה לשמש" },
  { stage: "5", title: "עובדים ושכר", detail: "מבנה הסכם ומחשבון. בלי סכומי שכר בקוד" },
  { stage: "3", title: "היקף שורנס", detail: "אותה סוכנות או סוכנות נפרדת, לפי הגדרה" },
  { stage: "7", title: "תור החזרת לידים", detail: "תור ותבניות הודעה. בלי שליחה" },
];
