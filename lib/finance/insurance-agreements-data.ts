import {
  COMMISSION_TYPE_LABELS,
  type CommissionSplitType,
} from "@/lib/finance/categories";
import { COL, PROCESS, STATUS } from "@/lib/sales-dashboard/columns";
import { DEFAULT_INSURER_MULTIPLIER } from "@/lib/sales-dashboard/campaign-math";

export type AgreementStatus = "draft" | "ready" | "coming_soon";

export type InsurerAgreement = {
  id: string;
  name: string;
  status: AgreementStatus;
  statusLabel: string;
  pnlMode: "multiplier" | "contract";
  pnlNote: string;
};

export type FormulaRow = {
  product: string;
  yearOne: string;
  later?: string;
  notes?: string;
  /** הפרדה חובה: בריאות §9 ≠ חיים/אחרות §8 */
  group?: "health" | "other";
};

export type MissingItem = {
  id: string;
  question: string;
  why?: string;
  /** עמודות רלוונטיות בדוח המנהלים (שמות מדויקים). */
  excelColumns?: string[];
  /** מה הדוח / המערכת עושים היום. */
  reportToday?: string;
  /** מה צריך לקבל מהנהלה / בלים. */
  needAnswer?: string;
};

export type MissingCategory = {
  id: string;
  title: string;
  intro?: string;
  relatedDoc?: string;
  /** blocking = חייב לפני חיבור חיים/בריאות; phase2 = לפנסיה/גמל; later = כללי */
  priority: "blocking" | "phase2" | "later";
  items: MissingItem[];
};

export type ContractDocSection = {
  id: string;
  title: string;
  detail?: string;
};

export type ContractDoc = {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  pages: number;
  summary: string;
  /** Original filename when received (e.g. noname (1)). */
  sourceFile: string;
  /** Path under /public — open in browser as /docs/migdal/... */
  pdfPath: string;
  /** Which of the 4 payment types this document feeds */
  paymentTypes: CommissionSplitType[];
  sections: ContractDocSection[];
  duplicateOf?: string;
};

export const DEFAULT_PNL_MULTIPLIER = DEFAULT_INSURER_MULTIPLIER;

export const SOURCE_PNL_REPORT_NAME = "רווח והפסד לפי מקור (היקף)";
export const MANAGERS_EXCEL_NAME = "דוח המנהלים (Excel — גיליון ראשון)";

/** עמודות הדוח — שמות מדויקים כמו בקובץ (`lib/sales-dashboard/columns.ts`). */
export const MIGDAL_EXCEL_COLUMNS: {
  key: keyof typeof COL;
  header: string;
  role: string;
  usedToday: "כן" | "חלקי" | "לא";
  note?: string;
}[] = [
  {
    key: "company",
    header: COL.company,
    role: "זיהוי שורות מגדל",
    usedToday: "כן",
    note: "מסנן לפי «מגדל» — צריך לאשר וריאנטים (מקפת וכו').",
  },
  {
    key: "product",
    header: COL.product,
    role: "בחירת שיעור עמלה מהחוזה",
    usedToday: "לא",
    note: "היום לא משפיע — ביעד: מיפוי 1:1 לטבלת החוזה.",
  },
  {
    key: "premium",
    header: COL.premium,
    role: "בסיס חישוב עמלה (חיים / בריאות / משכנתא)",
    usedToday: "כן",
    note: `היום: ×${DEFAULT_PNL_MULTIPLIER} קבוע. ביעד: ×שיעור מהחוזה.`,
  },
  {
    key: "startDate",
    header: COL.startDate,
    role: "שנת פוליסה (א' / ב' / …) לשיעור עמלה",
    usedToday: "לא",
    note: "קיים בדוח — עדיין לא בחישוב.",
  },
  {
    key: "status",
    header: COL.status,
    role: "האם השורה נספרת ברווח",
    usedToday: "חלקי",
    note: `ערכים: ${STATUS.active}, ${STATUS.pending}, ${STATUS.cancelled}, ${STATUS.archived}`,
  },
  {
    key: "process",
    header: COL.process,
    role: "מכירה מול מינוי",
    usedToday: "לא",
    note: `${PROCESS.sale} / ${PROCESS.appointment}`,
  },
  {
    key: "transferDate",
    header: COL.transferDate,
    role: "מתי נסגר — סינון תאריכים בדוח",
    usedToday: "כן",
  },
  {
    key: "source",
    header: COL.source,
    role: "מקור הפנייה — קוביות ב-PnL",
    usedToday: "כן",
  },
  {
    key: "agent",
    header: COL.agent,
    role: "שכר סוכן (נפרד מעמלת מגדל)",
    usedToday: "כן",
  },
  {
    key: "client",
    header: COL.client,
    role: "זיהוי לקוח בלבד",
    usedToday: "לא",
  },
];

export type ProductMapRow = {
  excelProduct: string;
  contractRow: string;
  /** נפרעים — שנה א' */
  settledYearOne: string;
  /** היקף — יעד מכירות 1 (noname 3) */
  volumeTarget1: string;
  status: "לפי חוזה" | "חסר בחוזה" | "חסר באקסל";
};

export type ExcelGapItem = {
  id: string;
  topic: string;
  excelColumn?: string;
  needFromYou: string;
};

export type MigdalCalcRule = {
  id: string;
  name: string;
  paymentType: CommissionSplitType;
  formula: string;
  basis: string;
  timing: string;
  contractRef: string;
  conditions?: string[];
  notes?: string;
};

export type MigdalPolicyTermScale = {
  period: string;
  factor: string;
  appliesTo: string;
};

export type MigdalOpenQuestion = {
  id: string;
  phase: "א" | "ב" | "ג";
  priority: "חובה" | "חשוב" | "משני";
  paymentType?: CommissionSplitType;
  /** כותרת קצרה לשאלה */
  question: string;
  /** למה זה חוסם / חשוב */
  why: string;
  /** הסבר מורחב לשיחה עם הבעלים */
  detail?: string;
  /** מה בדיוק צריך לקבל כתשובה */
  askFor?: string;
  /** האם אפשר לזהות מהאקסל כיום */
  excelDetect:
    | "יש_עמודה_לא_ברור"
    | "חסר_באקסל"
    | "חלקי"
    | "מחוץ_לדוח";
  excelColumns?: string[];
  /** Closed after owner / Bali confirmation — keep visible with answer. */
  status?: "open" | "answered";
  answer?: string;
};

/** מה שאין / לא ניתן לזהות מדוח המנהלים — לשיחה ולמיפוי. */
export type MigdalNotInExcel = {
  id: string;
  title: string;
  why: string;
  neededFor: string;
};

export const MIGDAL_NOT_IN_EXCEL: MigdalNotInExcel[] = [
  {
    id: "transfer-amount",
    title: "סכום העברה / ניוד (₪)",
    why: "אין עמודה לסכום שהועבר — יש רק «תאריך העברה ליצרן».",
    neededFor: "עמלת היקף לפי ₪ למיליון (פנסיה / גמל / ניוד)",
  },
  {
    id: "policy-term",
    title: "תקופת ביטוח (שנים)",
    why: "אין עמודה לתקופה — לא יודעים אם 100% / 50% / 0% על פרמיה קובעת בריסק.",
    neededFor: "שיקול היקף בריסק (נספח 2025)",
  },
  {
    id: "pension-contrib",
    title: "דמי גמולים / הפקדות פנסיה",
    why: "«פרמיה» בדוח היא לביטוח חיים/בריאות — לא בסיס גמולים לפנסיה.",
    neededFor: "עמלת צבירה / פנסיה",
  },
  {
    id: "gemel-balance",
    title: "יתרת צבירה / הפקדות גמל",
    why: "אין שדה יתרה או הפקדה לגמל/השתלמות בדוח המנהלים.",
    neededFor: "עמלת צבירה גמל + היקף הפקדות",
  },
  {
    id: "sales-tier",
    title: "מצטבר יעדי מכירות / מדרגה מול מגדל",
    why: "הדוח לא אומר אם אתם ביעד 1 / 2 / 3 — זה נתון שנתי מול החברה.",
    neededFor: "שיעור היקף 75% / 78% / 82%",
  },
  {
    id: "campaigns",
    title: "השתתפות במבצעים / בונוסים",
    why: "אין סימון מבצע בתקופה — זה מחוץ לדוח המנהלים.",
    neededFor: "עמלת מבצעים",
  },
  {
    id: "premium-collected",
    title: "האם הפרמיה נגבתה בפועל (נפרעית)",
    why: "יש מספר ב«פרמיה» — אין סימון גבייה / פיגור / הצעה בלבד.",
    neededFor: "נפרעים מדויקים לפי החוזה",
  },
  {
    id: "pension-flags",
    title: "שכיר/עצמאי · הצטרפות/ניוד",
    why: "אין דגלים כאלה בדוח — רק סוג מוצר כללי אם בכלל.",
    neededFor: "שיעורי פנסיה/גמל לפי מסלול",
  },
];

/** ערכי «סוג המוצר» שמופיעים בדוח — מיפוי לחוזה (לאישור בלים). */
export const MIGDAL_PRODUCT_MAP: ProductMapRow[] = [
  {
    excelProduct: "בריאות",
    contractRow: "§9.1 בריאות — א'–ה' 22% · ו'–טו' 19% · מטז' 7%",
    settledYearOne: "22%",
    volumeTarget1: "75%",
    status: "לפי חוזה",
  },
  {
    excelProduct: "בריאות + מחלות קשות",
    contractRow: "§9.1 מזור לסרטן / מחלות קשות — אותה טבלת בריאות (לא §8)",
    settledYearOne: "22%",
    volumeTarget1: "75%",
    status: "לפי חוזה",
  },
  {
    excelProduct: "משכנתא",
    contractRow: "§8 ריסק למשכנתאות — א'–טו' 15% · מטז' 3%",
    settledYearOne: "15%",
    volumeTarget1: "75% (ריסק)",
    status: "לפי חוזה",
  },
  {
    excelProduct: "תאונות",
    contractRow: "§8.1 נכות/מוות מתאונה — א'–ו' 22% · ז'–טו' 19% · מטז' 9%",
    settledYearOne: "22%",
    volumeTarget1: "75% (ריסק)",
    status: "לפי חוזה",
  },
  {
    excelProduct: "אכ\"ע",
    contractRow: "§8 אובדן כושר — מנהלים 8% / פרט 10% (א'–טו') · מטז' 4%",
    settledYearOne: "8%–10%",
    volumeTarget1: "6.5% (חיסכון)",
    status: "לפי חוזה",
  },
  {
    excelProduct: "התפתחות הילד",
    contractRow: "§9.1 כתב שירות — א'–ה' 4.75% · ו'–טו' 4% · מטז' 1%",
    settledYearOne: "4.75%",
    volumeTarget1: "—",
    status: "לפי חוזה",
  },
];

/** מה חסר באקסל או לא ברור — צריך שתספק מהנהלה / בלים. */
export const MIGDAL_EXCEL_GAPS: ExcelGapItem[] = [
  {
    id: "premium-period",
    topic: "תקופת «פרמיה»",
    excelColumn: COL.premium,
    needFromYou:
      "להיקף אושר: חודשית. לנפרעים — עדיין לאשר אם אותה עמודה חודשית = נפרעית.",
  },
  {
    id: "premium-meaning",
    topic: "משמעות «פרמיה» בדוח",
    excelColumn: COL.premium,
    needFromYou: "האם זה = «נפרעית פרמיה» לנפרעים? או «פרמיה קובעת» להיקף? או שניהם?",
  },
  {
    id: "determining-premium",
    topic: "פרמיה קובעת (היקף)",
    needFromYou:
      "אושר: חודשי × 12. נשאר לאשר יעד מכירות מדויק לשנה (1/2/3) ומסלולי העברה/ניוד.",
  },
  {
    id: "health-critical",
    topic: "בריאות + מחלות קשות",
    excelColumn: COL.product,
    needFromYou: "איזה שורה / שיעור בחוזה? (לא מופיע במפורש בנספח שחילצנו)",
  },
  {
    id: "policy-year",
    topic: "שנת פוליסה",
    excelColumn: COL.startDate,
    needFromYou: "«תאריך תחילת ביטוח» תמיד מלא? איך מחשבים שנה א'/ב' — מתאריך העברה או מתחילת ביטוח?",
  },
  {
    id: "transfer-amount",
    topic: "העברות / ניוד (פנסיה, גמל)",
    needFromYou: "אין בעמודות הדוח — שדה נפרד? מחוץ לאקסל?",
  },
  {
    id: "accumulation-base",
    topic: "דמי גמולים / צבירה (פנסיה, גמל)",
    needFromYou: "אין בעמודות הדוח — מאיפה נמשוך בסיס לעמלת צבירה?",
  },
];

/** נוסחת-על: סכום כל סוגי התשלום מסגירה אחת. */
export const MIGDAL_INCOME_MODEL = {
  title: "נוסחת הכנסה ממגדל — לפי חוזה",
  masterFormula:
    "הכנסה מסגירה = נפרעים + היקף + מבצעים + מוצרי צבירה",
  intro:
    "כל סגירה במגדל יכולה לייצר עד ארבעה סוגי תשלום. כל סוג — נוסחה, בסיס ותזמון שונים. סכמו את מה שרלוונטי למוצר.",
  components: [
    {
      type: "settled" as const,
      label: "נפרעים",
      timing: "שוטף — כל חודש",
      formula: "נפרעית פרמיה × שיעור",
      explain: "אחוז ממה שהלקוח שילם בפועל באותו חודש. תלוי במוצר ובשנת הפוליסה.",
    },
    {
      type: "volume" as const,
      label: "היקף",
      timing: "חד-פעמי — בדרך כלל",
      formula: "(פרמיה חודשית × 12) × שיעור מדרגת יעד",
      explain:
        "אושר מול בעלים: פרמיה באקסל = חודשית → ×12 = פרמיה קובעת שנתית → אחוז לפי יעד מכירות (75%/78%/82%). לא חל על נפרעים — נפרעים מקטגוריה/דוח נפרד.",
    },
    {
      type: "campaigns" as const,
      label: "מבצעים",
      timing: "תנאי / לפי הודעה",
      formula: "יעד = תנאי · בונוס = לפי מבצע",
      explain: "יעדי מכירות קובעים אם מקבלים היקף. בונוסים נפרדים — לפי הודעות מגדל.",
    },
    {
      type: "accumulation" as const,
      label: "מוצרי צבירה",
      timing: "שוטף — על גמולים / צבירה",
      formula: "דמי גמולים × שיעור",
      explain: "פנסיה, גמל, חיסכון — בסיס שונה מפרמיה חודשית של ביטוח בריאות.",
    },
  ],
  definitions: [
    {
      term: "נפרעית פרמיה",
      meaning: "פרמיה שוטפת שנגבתה בפועל — noname (2)",
      usedFor: "נפרעים",
    },
    {
      term: "פרמיה קובעת",
      meaning:
        "להיקף: פרמיה חודשית מהדוח × 12 (אושר). בסיס שנתי למדרגות היקף — לא זהה לנפרעית פרמיה.",
      usedFor: "היקף",
    },
    {
      term: "«פרמיה» בדוח",
      meaning:
        "להיקף: חודשית (אושר). לנפרעים: עדיין לאשר אם זהה לנפרעית שנגבתה בפועל.",
      usedFor: "היקף (אושר) · נפרעים (פתוח)",
    },
  ],
  todayNote: `היום ב-${SOURCE_PNL_REPORT_NAME}: עדיין ${COL.premium} × ${DEFAULT_PNL_MULTIPLIER}. נוסחת היקף מהחוזה מתועדת בדף — טרם מחוברת לדוח החי.`,
  notes: [
    "לא כל סגירה כוללת את 4 הסוגים — תלוי במוצר (בריאות ≠ פנסיה).",
    "נפרעים = שוטף · היקף = חד-פעמי (בדרך כלל) · מבצעים = תנאי/בונוס · צבירה = גמולים/צבירה.",
    "היקף (אושר): פרמיה חודשית × 12 × אחוז מדרגת יעד מכירות (75% / 78% / 82%).",
    "עברתם ~₪500K מצטבר → יעד 3 → 82% (בריאות/ריסק).",
    `היום ב-${SOURCE_PNL_REPORT_NAME}: רק ${COL.premium} × ${DEFAULT_PNL_MULTIPLIER} — לא מפרק לפי סוג.`,
  ],
};

/** שיקול תקופת ביטוח על פרמיה קובעת — תכניות ריסק (noname 3). */
export const MIGDAL_POLICY_TERM_SCALE: MigdalPolicyTermScale[] = [
  { period: "עד 5 שנים", factor: "100%", appliesTo: "ריסק — פרמיה קובעת לעמלת היקף" },
  { period: "5–8 שנים", factor: "50%", appliesTo: "ריסק — פרמיה קובעת לעמלת היקף" },
  { period: "מעל 8 שנים", factor: "0%", appliesTo: "ריסק — פרמיה קובעת לעמלת היקף" },
];

export const MIGDAL_CALC_RULES: MigdalCalcRule[] = [
  {
    id: "settled-base",
    name: "נפרעים — בסיס",
    paymentType: "settled",
    formula: "עמלה = נפרעית פרמיה × שיעור",
    basis: "פרמיה שוטפת שנגבתה בפועל (לא הצעה, לא פיגורים, לא חד-פעמי)",
    timing: "כל חודש — כל תשלום לקוח",
    contractRef: "noname (2) · סעיפי עמלת נפרעים",
    conditions: ["פוליסה פעילה", "הפרמיה נגבתה בפועל"],
  },
  {
    id: "settled-year",
    name: "נפרעים — שנת פוליסה",
    paymentType: "settled",
    formula: "שיעור לפי שנת פוליסה (א' / ב' / …) — טבלה נפרדת לבריאות ולחיים",
    basis: `${COL.startDate} → חישוב שנים מיום תחילת הביטוח`,
    timing: "שוטף",
    contractRef: "noname (2) · §9 בריאות · §8 חיים/אחרות",
    notes:
      "אסור לערבב: בריאות §9 = א'–ה' 22% → ו'–טו' 19% → מטז' 7%. חיים/תאונות §8.1 = א'–ו' 22% → ז'–טו' 19% → מטז' 9%.",
  },
  {
    id: "volume-premium",
    name: "היקף — אחוז מפרמיה קובעת",
    paymentType: "volume",
    formula:
      "עמלה = (פרמיה חודשית × 12) × שיעור מדרגת יעד × שיקול תקופה (ריסק)",
    basis:
      "פרמיה קובעת שנתית = עמודת «פרמיה» חודשית × 12 (אושר מול בעלים). שיעור = 75%/78%/82% לפי יעד מכירות.",
    timing: "חד-פעמי",
    contractRef: "noname (3) · 2.1.1 + אישור בעלים",
    conditions: [
      "עמידה ביעדי מכירות שנתיים",
      "ביטולים קלנדאריים בניכוי",
      "מדרגה אחת — הגבוהה שהסוכן הגיע אליה (2.1.6)",
    ],
    notes:
      "דוגמה יעד 3 (~₪500K): 500 × 12 = 6,000 × 82% = 4,920 ₪. לא חל על נפרעים.",
  },
  {
    id: "volume-sales-tier",
    name: "היקף — בחירת מדרגת יעד מכירות",
    paymentType: "volume",
    formula: "יעד 1 → 75% · יעד 2 (~₪250K) → 78% · יעד 3 (~₪500K) → 82%",
    basis: "מצטבר מכירות שנתי (ח\"ש) לפי נספח 2025",
    timing: "שנתי — קובע את שיעור ההיקף על סגירות הזכאיות",
    contractRef: "noname (3) · 2.1.1",
    conditions: ["רק המדרגה הגבוהה שהושגה"],
    notes: "אושר: עברתם ~₪500K → האחוז גדל (יעד 3 / 82% לבריאות וריסק).",
  },
  {
    id: "volume-transfer",
    name: "היקף — העברה / ניוד",
    paymentType: "volume",
    formula: "עמלה = (סכום העברה נטו ÷ 1,000,000) × ₪ למדרגה",
    basis: "סכום העברות נטו כוללות — לפי סוג תוכנית (קשת פרט / גמל / פנסיה)",
    timing: "חד-פעמי — לפי מדרגות",
    contractRef: "noname (3) · 2.1.5",
    notes: "2.1.6: מדרגה אחת בלבד — הגבוהה שהסוכן הגיע אליה",
  },
  {
    id: "volume-annuity",
    name: "היקף — המרה לקצבה מיידית",
    paymentType: "volume",
    formula: "₪7,605 × (סכום ניוד/הפקדה ÷ 1,000,000)",
    basis: "חיסכון שהועבר לקצבה מיידית — לא מפדיון",
    timing: "חד-פעמי",
    contractRef: "noname (3) · 2.1.8",
    conditions: ["2.1.7: תכניות מקבוצת מגדל — 50% מעמלת ההיקף"],
  },
  {
    id: "volume-gemel-deposit",
    name: "היקף — הפקדות גמל",
    paymentType: "volume",
    formula: "2.00% × פרמיה קובעת · 1.60% / 6.67% — הפקדות חד-פעמיות",
    basis: "קופות גמל — קשת פרט / מגדלור / בקשה לתגמול",
    timing: "חד-פעמי",
    contractRef: "noname (3) · 2.1.3–2.1.4",
    conditions: ["יעד מכירות ~₪100,000", "רק הפקדות ששולמו"],
  },
  {
    id: "campaigns-target",
    name: "מבצעים — יעדי מכירות",
    paymentType: "campaigns",
    formula: "יעד = תנאי לזכאות · לא סכום קבוע",
    basis: "יעדי מכירות שנתיים (ח\"ש) — קובעים מדרגת היקף (75% / 78% / 82%)",
    timing: "שנתי — בדיקת עמידה",
    contractRef: "noname (3) · 2.1.1",
    notes: "אי-עמידה → אולי 0 היקף גם על סגירה תקינה",
  },
  {
    id: "campaigns-bonus",
    name: "מבצעים — בונוסים",
    paymentType: "campaigns",
    formula: "לפי הודעת / מבצע חברה — לא בטבלה קבועה",
    basis: "מבצעים מיוחדים מעבר לנספח הבסיס",
    timing: "לפי מבצע",
    contractRef: "noname (3) + הודעות חברה",
  },
  {
    id: "accum-pension",
    name: "צבירה — פנסיה שוטפת",
    paymentType: "accumulation",
    formula: "0.3% × דמי גמולים שנתיים (מקפת אישית / משלימה)",
    basis: "דמי גמולים שהופקדו בפועל לקרן — לא חד-פעמי",
    timing: "שוטף — על כל הפקדת גמולים",
    contractRef: "noname · סעיף 3",
    conditions: ["הסוכן = מטפל בעמית", "עמית חדש / מועמד לפי נספח"],
  },
  {
    id: "accum-gemel",
    name: "צבירה — גמל שוטף",
    paymentType: "accumulation",
    formula: "0.24% × (יתרת צבירה ÷ 12) — שנתי",
    basis: "יתרת החיסכון הצבורה בקופת גמל",
    timing: "שוטף — חודשי",
    contractRef: "noname (1) · סעיף 3",
  },
  {
    id: "accum-savings-life",
    name: "צבירה — חיסכון בחיים",
    paymentType: "accumulation",
    formula: "עמלה על «המצטבר חיסכון» — ניוד / משיכה / העברה",
    basis: "סכומים שהועברו מצבירה — לפי הגדרה ב-noname (2)",
    timing: "לפי אירוע",
    contractRef: "noname (2) + noname (3)",
    notes: "כולל ניכויי ניהול / מפדיון — לא כל העברה",
  },
];

export const MIGDAL_PNL_COMPARISON = {
  today: {
    title: "היום ב«רווח והפסד לפי מקור»",
    formula: `הכנסה ממגדל = ${COL.premium} × ${DEFAULT_PNL_MULTIPLIER}`,
    applies: "כל מוצר · כל שנה · בלי «סוג המוצר» ובלי «תאריך תחילת ביטוח»",
    example:
      "דוגמה: פרמיה 500 → הכנסה 4,500 (בלי קשר אם בריאות או משכנתא)",
  },
  target: {
    title: "יעד — לפי חוזה מגדל",
    formula: "הכנסה = נפרעית פרמיה × שיעור (לפי מוצר + שנת פוליסה)",
    applies: `מבוסס ${COL.product}, ${COL.premium}, ${COL.startDate}, ${COL.company}`,
    example:
      "דוגמה: בריאות, שנה א', פרמיה 500 (חודשי?) → 500 × 22% = 110 (לא 4,500)",
  },
} as const;

const COMING_SOON_PNL_NOTE = "טרם הוזן הסכם. בדוח: פרמיה × 9.";

/** Same insurers and order as «איחוד פורטלים» (`lib/portals.config.ts`). */
export const INSURERS: InsurerAgreement[] = [
  {
    id: "migdal",
    name: "מגדל",
    status: "draft",
    statusLabel: "בהכנה — בדוח עדיין ×9",
    pnlMode: "multiplier",
    pnlNote:
      "עד שסוגרים את הנוסחה ומאשרים אותה, «רווח והפסד לפי מקור» ממשיך לחשב מגדל כמו שאר החברות: פרמיה × 9.",
  },
  {
    id: "phoenix",
    name: "פניקס",
    status: "coming_soon",
    statusLabel: "בקרוב",
    pnlMode: "multiplier",
    pnlNote: COMING_SOON_PNL_NOTE,
  },
  {
    id: "clal",
    name: "כלל",
    status: "coming_soon",
    statusLabel: "בקרוב",
    pnlMode: "multiplier",
    pnlNote: COMING_SOON_PNL_NOTE,
  },
  {
    id: "ayalon",
    name: "איילון",
    status: "coming_soon",
    statusLabel: "בקרוב",
    pnlMode: "multiplier",
    pnlNote: COMING_SOON_PNL_NOTE,
  },
  {
    id: "menora",
    name: "מנורה",
    status: "coming_soon",
    statusLabel: "בקרוב",
    pnlMode: "multiplier",
    pnlNote: COMING_SOON_PNL_NOTE,
  },
  {
    id: "hachshara",
    name: "הכשרה",
    status: "coming_soon",
    statusLabel: "בקרוב",
    pnlMode: "multiplier",
    pnlNote: COMING_SOON_PNL_NOTE,
  },
  {
    id: "harel",
    name: "הראל",
    status: "coming_soon",
    statusLabel: "בקרוב",
    pnlMode: "multiplier",
    pnlNote: COMING_SOON_PNL_NOTE,
  },
  {
    id: "meitav",
    name: "מיטב",
    status: "coming_soon",
    statusLabel: "בקרוב",
    pnlMode: "multiplier",
    pnlNote: COMING_SOON_PNL_NOTE,
  },
];

export const MIGDAL_CONTRACT_PDF_DIR = "/docs/migdal";

export const MIGDAL_CONTRACT_DOCS: ContractDoc[] = [
  {
    id: "pension",
    title: "נספח עמלות שוטפות — קרנות פנסיה",
    subtitle: "מקפת / מגדל · דמי גמולים",
    date: "05/10/2025",
    pages: 4,
    sourceFile: "noname",
    pdfPath: `${MIGDAL_CONTRACT_PDF_DIR}/01-pension.pdf`,
    paymentTypes: ["accumulation"],
    summary:
      "עמלות שוטפות על דמי גמולים בקרנות פנסיה. בסיס: גמולים שהופקדו בפועל — לא הפקדות חד-פעמיות.",
    sections: [
      { id: "1", title: "הגדרות", detail: "דמי גמולים, עמית, עמלת הפצה" },
      { id: "2", title: "עמלות שוטפות", detail: "בסיס: גמולים ששולמו לקרן" },
      { id: "3", title: "שיעור עמלה", detail: "0.3% שנתי על דמי גמולים (מקפת אישית / משלימה)" },
      { id: "4", title: "תנאי זכאות", detail: "עמית חדש · הסוכן = מטפל" },
      { id: "5", title: "בקשה לתשלום", detail: "הודעה לחברה · אישור עמלה" },
      { id: "6", title: "הוראות כלליות", detail: "שינוי שיעורים · תחולה" },
    ],
  },
  {
    id: "gemel",
    title: "נספח עמלות שוטפות — קופות גמל",
    subtitle: "גמל · השתלמות · מטריה",
    date: "05/10/2025",
    pages: 4,
    sourceFile: "noname (1)",
    pdfPath: `${MIGDAL_CONTRACT_PDF_DIR}/02-gemel.pdf`,
    paymentTypes: ["accumulation"],
    summary:
      "עמלות שוטפות בגין קופות גמל. מסגרת נפרדת מפנסיה — אותו תאריך, מסמך שונה.",
    sections: [
      { id: "1", title: "הגדרות", detail: "קופת גמל, יתרת צבירה, עמלת הפצה" },
      { id: "2", title: "עמלות שוטפות", detail: "על הפקדות / צבירה בפועל" },
      { id: "3", title: "שיעור עמלה", detail: "0.24% שנתי (חלקי 12) על יתרת החיסכון" },
      { id: "4", title: "תנאי זכאות", detail: "הסוכן ממשיך לתת שירות לעמית" },
      { id: "5", title: "בקשה לתשלום", detail: "הודעה ואישור מראש" },
      { id: "6", title: "הוראות כלליות", detail: "שינוי שיעורים · תחולה" },
    ],
  },
  {
    id: "life-health",
    title: "נספח עמלות שוטפות — חיים ובריאות",
    subtitle: "נפרעים · ריסק · משכנתא",
    date: "05/10/2025",
    pages: 6,
    sourceFile: "noname (2)",
    pdfPath: `${MIGDAL_CONTRACT_PDF_DIR}/03-life-health.pdf`,
    paymentTypes: ["settled", "accumulation"],
    summary:
      "עמלות נפרעים — אחוז מהפרמיה שנגבתה בפועל. בריאות (§9) וחיים/אחרות (§8) — טבלאות נפרדות.",
    sections: [
      { id: "1", title: "הגדרות", detail: "נפרעית פרמיה · המצטבר חיסכון · ניוד" },
      { id: "2", title: "עמלת נפרעים", detail: "עמלה = נפרעית פרמיה × שיעור" },
      { id: "8", title: "תכניות ביטוח אחרות §8", detail: "אור/ריסק/תאונות/משכנתא/אכ\"ע — א'–ו' 22% → מטז' 9%" },
      { id: "9", title: "תכניות בריאות §9", detail: "א'–ה' 22% → ו'–טו' 19% → מטז' 7% · כתב שירות · התפתחות הילד" },
      { id: "5", title: "חריגים", detail: "מה לא נכלל בנפרעית פרמיה" },
      { id: "6", title: "צבירה בחיים", detail: "עמלה על המצטבר — ניוד / משיכה" },
    ],
  },
  {
    id: "activity-2025",
    title: "נספח פעילות 2025",
    subtitle: "היקף · יעדים · העברות",
    date: "19/10/2025",
    pages: 11,
    sourceFile: "noname (3)",
    pdfPath: `${MIGDAL_CONTRACT_PDF_DIR}/04-activity-2025.pdf`,
    paymentTypes: ["volume", "campaigns"],
    summary:
      "עמלות היקף חד-פעמיות, יעדי מכירות, פרמיה קובעת, העברות וניוד.",
    sections: [
      { id: "1", title: "הגדרות", detail: "פרמיה קובעת · עמלות היקף · יעדי מכירות" },
      { id: "2.1", title: "עמלות היקף — כללי", detail: "חד-פעמי · בכפוף ליעדים" },
      { id: "2.1.1", title: "בריאות / ריסק / פנסיה", detail: "75% · 78% · 82% — לפי יעד" },
      { id: "2.1.2", title: "היקף נוסף — פנסיה", detail: "העברות + יעד מכירות" },
      { id: "2.1.3", title: "היקף — קופות גמל", detail: "2% מפרמיה קובעת" },
      { id: "2.1.4", title: "הפקדות חד-פעמיות", detail: "1.60% · 6.67% — קשת פרט" },
      { id: "2.1.5", title: "העברות / ניוד", detail: "₪5,000–₪8,000 לכל מיליון" },
      { id: "2.1.6", title: "מדרגה אחת", detail: "רק היעד הגבוה שהגעת אליו" },
      { id: "2.1.7–8", title: "קצבה מיידית / המרה", detail: "₪7,605 למיליון · 50% לתכניות מגדל" },
      { id: "2.1.10", title: "תקופת ביטוח", detail: "שיקול 100% / 50% / 0% לריסק" },
      { id: "3", title: "יעדי מכירות 2025", detail: "תנאי לזכאות להיקף" },
    ],
  },
];

/** Target formula per contract — year bands differ: health §9 ≠ life/other §8. */
export const MIGDAL_FORMULA_INTRO =
  "מקור: נספח חיים ובריאות (05/10/2025). עמלה = נפרעית פרמיה × שיעור. בריאות (§9) ≠ חיים/אחרות (§8) — טבלאות ושנות פוליסה נפרדות; אסור להעתיק אחוזים ביניהן.";

export const MIGDAL_HEALTH_FORMULAS: FormulaRow[] = [
  {
    product: "בריאות — רוב הכיסויים (מזור, ניתוחים, השתלות, תרופות, אבחונים…)",
    yearOne: "22% (א'–ה' כולל)",
    later: "19% (ו'–טו'), 7% (מטז')",
    group: "health",
  },
  {
    product: "כתב שירות (אבחון / ייעוץ אונליין / רפואה משלימה / ביקור רופא)",
    yearOne: "19% (א'–ה')",
    later: "16% (ו'–טו'), 4% (מטז')",
    group: "health",
  },
  {
    product: "התפתחות הילד (כתב שירות)",
    yearOne: "4.75% (א'–ה')",
    later: "4% (ו'–טו'), 1% (מטז')",
    group: "health",
  },
];

export const MIGDAL_OTHER_FORMULAS: FormulaRow[] = [
  {
    product: "אור 1 / ריסק Max · הכנסה למשפחה · הקדמת תשלום במחלה חשוכת מרפא",
    yearOne: "22% (א'–ו' כולל)",
    later: "19% (ז'–טו'), 9% (מטז')",
    group: "other",
  },
  {
    product: "נכות / מוות מתאונה",
    yearOne: "22% (א'–ו' כולל)",
    later: "19% (ז'–טו'), 9% (מטז')",
    group: "other",
  },
  {
    product: "ריסק למשכנתאות",
    yearOne: "15% (א'–טו')",
    later: "3% (מטז')",
    group: "other",
  },
  {
    product: "ריסק למשכנתא — בעלי מוגבלויות",
    yearOne: "4% (א'–טו')",
    later: "4% (מטז')",
    group: "other",
  },
  {
    product: "אובדן כושר עבודה — מנהלים ועצמאיים",
    yearOne: "8% (א'–טו')",
    later: "4% (מטז')",
    group: "other",
  },
  {
    product: "שחרור מעבודה — פרט",
    yearOne: "10% (א'–טו')",
    later: "4% (מטז')",
    group: "other",
  },
  {
    product: "מטריה לפנסיה · נכות מוחלטת",
    yearOne: "8% (א'–טו')",
    later: "4% (מטז')",
    group: "other",
  },
];

export const MIGDAL_PENSION_NOTE =
  "פנסיה (noname) וגמל (noname 1) — נספחים נפרדים לעמלות שוטפות על דמי גמולים. נספח 2025 (noname 3) מוסיף מדרגות היקף, העברות ויעדי מכירות. דורש שדות נוספים באקסel — לא מחובר עדיין.";

export type MigdalRateTier = {
  label: string;
  health?: string;
  risk?: string;
  pension?: string;
  gemel?: string;
  notes?: string;
};

export type MigdalTransferTier = {
  netTransfer: string;
  commission: string;
  productScope: string;
};

/** ארבעת סוגי התשלום — כמו בחשבונות ליבה (`COMMISSION_SPLIT_TYPES`). */
export type MigdalPaymentSection = {
  id: CommissionSplitType;
  label: string;
  order: number;
  /** שוטף / חד-פעמי / תנאי */
  timing: string;
  /** מה מחשבים עליו */
  basis: string;
  formula: string;
  intro: string;
  contractFiles: string[];
  pnlStatus: "לא מחובר" | "בתכנון" | "מחובר";
  pnlNote: string;
  formulaRows?: FormulaRow[];
  rateTiers?: MigdalRateTier[];
  transferTiers?: MigdalTransferTier[];
  examples: string[];
  excelColumns: string[];
  calcRuleIds: string[];
};

export const MIGDAL_PAYMENT_INTRO =
  "מגדל משלמת ב-4 סוגים — כמו ברישום בחשבונות ליבה. כל סגירה יכולה לכלול יותר מסוג אחד (למשל: היקף חד-פעמי + נפרעים כל חודש).";

export const MIGDAL_VOLUME_TIERS: MigdalRateTier[] = [
  {
    label: "יעד מכירות 1 (בסיס)",
    health: "75%",
    risk: "75%",
    pension: "6%",
    gemel: "2%",
    notes: "עמידה ביעד שנתי בסיסי",
  },
  {
    label: "יעד מכירות 2 (מצטבר ~₪250,000)",
    health: "78%",
    risk: "78%",
    pension: "6.5%",
    notes: "פנסיה — פרמיה קובעת עד ₪3M",
  },
  {
    label: "יעד מכירות 3 (מצטבר ~₪500,000)",
    health: "82%",
    risk: "82%",
    pension: "7%",
    notes: "אושר: עברתם ~500K → מדרגה זו · האחוז גדל",
  },
  {
    label: "חיסכון / אכ\"ע (מנהלים ופרט)",
    risk: "6.5%",
    notes: "מרכיב חיסכון + כושר — מהפרמיה הקובעת · יעד 1",
  },
  {
    label: "פנסיה — מדרגות פרמיה קובעת",
    pension: "6% → 6.5% → 7%",
    notes: "עד ₪1M · עד ₪3M · מעל",
  },
  {
    label: "גמל — היקף שוטף (2.1.3)",
    gemel: "2%",
    notes: "פרמיה קובעת · בכפוף ליעד ~₪100K",
  },
];

export const MIGDAL_TRANSFER_TIERS: MigdalTransferTier[] = [
  { netTransfer: "₪1,000,000", commission: "₪5,000", productScope: "קשת פרט / העברות נטו" },
  { netTransfer: "₪5,000,000", commission: "₪5,000", productScope: "מדרגה נוספת — לפי סוג תוכנית" },
  { netTransfer: "₪10,000,000", commission: "₪6,000", productScope: "גמל / פנסיה / השתלמות" },
  { netTransfer: "₪15,000,000", commission: "₪7,500", productScope: "מדרגות העברה וניוד" },
  { netTransfer: "₪20,000,000", commission: "₪8,000", productScope: "תקרת מדרגה בנספח 2025" },
  { netTransfer: "לכל ₪1M", commission: "₪7,605", productScope: "המרה לקצבה מיידית (ניוד / הפקדה)" },
];

export const MIGDAL_PAYMENT_SECTIONS: MigdalPaymentSection[] = [
  {
    id: "settled",
    label: COMMISSION_TYPE_LABELS.settled,
    order: 1,
    timing: "שוטף — כל חודש (כל תשלום לקוח)",
    basis: "נפרעית פרמיה — פרמיה שוטפת שנגבתה בפועל מהלקוח / מעסיק",
    formula: "עמלה = נפרעית פרמיה × שיעור (לפי מוצר + שנת פוליסה)",
    intro:
      "נספח חיים ובריאות (noname 2). נפרעים = אחוז ממה שהלקוח שילם באותו חודש. בריאות (§9) וחיים/אחרות (§8) — טבלאות נפרדות; אסור לערבב שיעורים או שנות פוליסה.",
    contractFiles: ["noname (2) · 05/10/2025"],
    pnlStatus: "בתכנון",
    pnlNote: `מקור הנתונים: קטגוריית «נפרעים» (/finance/settled) — דוח נפרד, לא דוח המנהלים. שיעורים לפי חוזה בדף זה.`,
    formulaRows: [...MIGDAL_HEALTH_FORMULAS, ...MIGDAL_OTHER_FORMULAS],
    examples: [
      "בריאות §9, שנה א', 500 ₪/חודש → 500 × 22% = 110 ₪",
      "בריאות §9, שנה ו' → כבר 19% (לא 22% כמו בחיים בשנה ו')",
      "בריאות §9, מטז' → 7% · חיים/תאונות §8 מטז' → 9%",
      "משכנתא §8, שנה א', 500 ₪/חודש → 500 × 15% = 75 ₪",
    ],
    excelColumns: [COL.premium, COL.product, COL.startDate, COL.status],
    calcRuleIds: ["settled-base", "settled-year"],
  },
  {
    id: "volume",
    label: COMMISSION_TYPE_LABELS.volume,
    order: 2,
    timing: "חד-פעמי — בגין סגירה / העברה (לא כל חודש)",
    basis:
      "הפרמיה הקובעת השנתית = פרמיה חודשית מהדוח × 12 (אושר) · או סכום העברה/ניוד נטו",
    formula:
      "עמלה = (פרמיה חודשית × 12) × שיעור מדרגת יעד (75%/78%/82%) · או: ₪ קבוע לכל מיליון ₪ שהועבר",
    intro:
      "נספח פעילות 2025 (noname 3), סעיף 2.1. תשלום נפרד מהנפרעים — בדרך כלל חד-פעמי. מותנה בעמידה ביעדי מכירות. אושר מול בעלים: בסיס שנתי = חודשי × 12; מעל ~₪500K מצטבר → מדרגה גבוהה יותר.",
    contractFiles: ["noname (3) · 19/10/2025"],
    pnlStatus: "בתכנון",
    pnlNote:
      "נוסחת היקף מתועדת ומאושרת חלקית — טרם מחוברת לדוח החי (עדיין ×9).",
    rateTiers: MIGDAL_VOLUME_TIERS,
    transferTiers: MIGDAL_TRANSFER_TIERS,
    examples: [
      "בריאות, יעד 1: (500 × 12) × 75% = 4,500 ₪ חד-פעמי",
      "בריאות, יעד 3 (~₪500K): (500 × 12) × 82% = 4,920 ₪ חד-פעמי",
      "ניוד ₪2M נטו → לפי טבלת ₪ למיליון (לא אחוז מפרמיה)",
      "המרה לקצבה מיידית: ₪7,605 לכל מיליון",
    ],
    excelColumns: [COL.premium, COL.product, COL.transferDate],
    calcRuleIds: [
      "volume-premium",
      "volume-sales-tier",
      "volume-transfer",
      "volume-annuity",
      "volume-gemel-deposit",
    ],
  },
  {
    id: "campaigns",
    label: COMMISSION_TYPE_LABELS.campaigns,
    order: 3,
    timing: "תנאי / תקופתי — לפי יעדים ומבצעים",
    basis: "עמידה ביעדי מכירות שנתיים · מבצעים מיוחדים מהחברה",
    formula: "לא נוסחה אחידה — יעד = תנאי לזכאות; מבצע = לפי כללים בנספח",
    intro:
      "בחוזה מגדל: «יעדי מכירות» הם בעיקר תנאי לקבלת עמלת היקף (לא תשלום נפרד). «מבצעים» = בונוסים / תמריצים שמגדל מפרסמת לתקופה — נרשמים בנפרד בחשבונות.",
    contractFiles: ["noname (3) · 19/10/2025"],
    pnlStatus: "לא מחובר",
    pnlNote: "לא ניתן לחשב אוטומטית מהדוח — צריך לדעת אם עמדתם ביעד ובאילו מבצעים השתתפתם.",
    examples: [
      "לא עמדת ביעד מכירות → אולי אין עמלת היקף (גם אם נסגרה פוליסה)",
      "מבצע רבעוני / שנתי מהחברה → סכום נפרד ברישום הכנסה",
    ],
    excelColumns: [],
    calcRuleIds: ["campaigns-target", "campaigns-bonus"],
  },
  {
    id: "accumulation",
    label: COMMISSION_TYPE_LABELS.accumulation,
    order: 4,
    timing: "שוטף — על צבירה / גמולים (לא פרמיה חודשית רגילה)",
    basis: "דמי גמולים לקרן / קופה · המצטבר חיסכון · הפקדות לצבירה",
    formula: "עמלה = דמי גמולים ששולמו × שיעור · או % מהמצטבר / הפקדה (לפי מוצר)",
    intro:
      "נספחי פנסיה (noname) וגמל (noname 1) + מוצרי חיסכון/צבירה בנספח חיים (noname 2). בסיס שונה לגמרי מ«פרמיה» בדוח חיים/בריאות.",
    contractFiles: ["noname · 05/10/2025", "noname (1) · 05/10/2025", "noname (2) · 05/10/2025"],
    pnlStatus: "לא מחובר",
    pnlNote: "שלב ב' — דורש זיהוי פנסיה/גמל/צבירה בדוח ושדות גמולים / הפקדות.",
    formulaRows: [
      { product: "קרנות פנסיה (מקפת / מגדל)", yearOne: "לפי נספח פנסיה", notes: "על דמי גמולים בפועל" },
      { product: "קופות גמל / השתלמות", yearOne: "לפי נספח גמל", notes: "מסמך נפרד מפנסיה" },
      { product: "המצטבר חיסכון (חיים)", yearOne: "לפי נספח 2 + 2025", notes: "ניוד / משיכה / העברה" },
      { product: "הפקדות חד-פעמיות (גמל)", yearOne: "1.60% / 6.67%", notes: "נספח 2025 — קשת פרט / מגדלור" },
    ],
    examples: [
      "פנסיה: עמלה על דמי גמולים שהופקדו — לא על «פרמיה» 500 ₪ מביטוח בריאות",
      "גמל: רק הפקדות ששולמו בפועל — לא הצעה",
      "ניוד צבירה: חלק מעמלות ההיקף / הצבירה לפי נספח 2025",
    ],
    excelColumns: [COL.product, COL.premium, COL.company],
    calcRuleIds: ["accum-pension", "accum-gemel", "accum-savings-life"],
  },
];

/** שאלות פתוחות — מורחבות לשיחה עם הבעלים (בתחתית הדף). */
export const MIGDAL_OPEN_QUESTIONS: MigdalOpenQuestion[] = [
  {
    id: "q-determining",
    phase: "א",
    priority: "חובה",
    paymentType: "volume",
    question: "«פרמיה קובעת» להיקף — איך מחשבים מ«פרמיה» בדוח?",
    why: "בלי זה אי אפשר לחשב עמלת היקף",
    detail:
      "בחוזה: עמלת היקף = אחוז מ«פרמיה קובעת». באקסל יש רק עמודת «פרמיה». שאלנו איך הופכים את המספר בדוח לפרמיה קובעת.",
    askFor: "כלל חישוב (חודשי × 12 וכו')",
    excelDetect: "יש_עמודה_לא_ברור",
    excelColumns: [COL.premium],
    status: "answered",
    answer:
      "אושר: להיקף בלבד — פרמיה חודשית מהדוח × 12 = פרמיה קובעת שנתית. לא חל על נפרעים.",
  },
  {
    id: "q-sales-targets",
    phase: "ב",
    priority: "חובה",
    paymentType: "campaigns",
    question: "יעדי מכירות — האם מעל ~₪500K האחוז גדל?",
    why: "קובע מדרגת היקף 75% / 78% / 82%",
    detail:
      "בנספח 2025 יש 3 מדרגות יעד. שאלנו אם בפועל אחרי מצטבר גבוה האחוז עולה.",
    askFor: "אישור מדרגות",
    excelDetect: "מחוץ_לדוח",
    status: "answered",
    answer:
      "אושר עקרונית: מעל ~₪500K מצטבר → יעד 3 → האחוז גדל (82% בריאות/ריסק). עדיין לאשר סכום מדויק לשנה (שאלה נפרדת).",
  },
  {
    id: "q-premium-period",
    phase: "א",
    priority: "חובה",
    paymentType: "settled",
    question: `«${COL.premium}» לנפרעים — גם מספר חודשי?`,
    why: "להיקף אושר חודשי×12. לנפרעים חייבים אישור נפרד — טעות = חישוב פי 12",
    detail:
      "עמלת נפרעים = אחוז ממה שהלקוח שילם באותו חודש. אם «פרמיה» באקסל היא חודשית — מכפילים באחוז ישירות (למשל 500 × 22%). אם היא שנתית — חייבים לחלק ב-12 לפני. להיקף כבר אושר: חודשי × 12. עכשיו רק לנפרעים.",
    askFor: "תשובה ברורה: חודשי / שנתי / אחר — לנפרעים",
    excelDetect: "יש_עמודה_לא_ברור",
    excelColumns: [COL.premium],
  },
  {
    id: "q-premium-nefar",
    phase: "א",
    priority: "חובה",
    paymentType: "settled",
    question: `«${COL.premium}» = «נפרעית פרמיה» (נגבה בפועל)?`,
    why: "החוזה מחשב רק מה שנגבה — לא הצעה ולא פיגורים",
    detail:
      "בחוזה «נפרעית פרמיה» = פרמיה שוטפת שנגבתה בפועל מהלקוח/מעסיק. באקסל יש מספר ב«פרמיה» בלי סימון אם זה נגבה, הצעה בלבד, או כולל פיגור. אנחנו לא יכולים לדעת מהדוח אם השורה זכאית לנפרעים.",
    askFor: "כן = אפשר להשתמש כמו שהוא / לא = מאיפה לוקחים נפרעית",
    excelDetect: "חסר_באקסל",
    excelColumns: [COL.premium],
  },
  {
    id: "q-product-map",
    phase: "א",
    priority: "חובה",
    paymentType: "settled",
    question: `מיפוי כל ערך ב«${COL.product}» → שורה בחוזה`,
    why: "כל מוצר = שיעור נפרע + שיעור היקף שונים",
    detail:
      "טבלת מיפוי עודכנה מול הנספח: בריאות §9 (כולל מחלות קשות/מזור) · תאונות/ריסק §8. לאשר מול בלים ערך-ערך בדוח.",
    askFor: "אישור הטבלה המעודכנת (בריאות §9 ≠ חיים §8)",
    excelDetect: "חלקי",
    excelColumns: [COL.product],
  },
  {
    id: "q-start-date",
    phase: "א",
    priority: "חובה",
    paymentType: "settled",
    question: `«${COL.startDate}» = בסיס לשנת עמלה (א'/ב'/…)?`,
    why: "בריאות §9: א'–ה' 22% → ו'–טו' 19% → מטז' 7%. תאונות §8.1: א'–ו' 22% → ז'–טו' 19% → מטז' 9%.",
    detail:
      "העמודה קיימת בדוח. צריך לאשר שמשתמשים בה לחישוב «בן כמה» הפוליסה לעמלת נפרעים — ולא בתאריך העברה ליצרן. גם: חידוש / הגדלה / העברה — האם מתחילים שנה א' מחדש?",
    askFor: "כן מתחילת ביטוח / לא — מה כן + כלל לחידושים",
    excelDetect: "יש_עמודה_לא_ברור",
    excelColumns: [COL.startDate],
  },
  {
    id: "q-validation",
    phase: "א",
    priority: "חובה",
    question: "3 דוגמאות מהבנק: מוצר + פרמיה + נפרעים + היקף בפועל",
    why: "אימות שהנוסחאות מהחוזה = כסף שקיבלתם בפועל",
    detail:
      "לפני שנחבר את הנוסחאות לדוח החי — נבקש 3 פוליסות אמיתיות מהחשבון/בנק: סוג מוצר, פרמיה באקסל, כמה נפרעים נכנסו, כמה היקף נכנס. אם המספרים לא מסתדרים — נתקן לפני אוטומציה.",
    askFor: "3 שורות עם פירוט כספי אמיתי (אפשר בלי שמות לקוח)",
    excelDetect: "מחוץ_לדוח",
    excelColumns: [COL.product, COL.premium],
  },
  {
    id: "q-company",
    phase: "א",
    priority: "חשוב",
    question: `איך «מגדל» / «מקפת» מופיעים ב«${COL.company}»?`,
    why: "סינון שגוי = פספוס שורות או חישוב כפול",
    detail:
      "היום מסננים לפי טקסט שמכיל «מגדל». צריך רשימה מדויקת: מגדל, מגדל מקפת, מקפת, וכו' — ומה נכנס לחוזה מגדל ומה לא.",
    askFor: "רשימת שמות מדויקת כמו שמופיעים באקסל",
    excelDetect: "יש_עמודה_לא_ברור",
    excelColumns: [COL.company],
  },
  {
    id: "q-status",
    phase: "א",
    priority: "חשוב",
    question: `אילו ערכי «${COL.status}» נספרים ברווח?`,
    why: "פעילה / ממתינה למינוי / בוטלה / גניזה",
    detail:
      "ערכים ידועים בדוח: פעילה, ממתינה למינוי, בוטלה, גניזה. צריך כלל: מה נכנס ל-PnL ביום הסגירה, מה מחכים להפעלה, ומה מוציאים.",
    askFor: "רשימה: נכלל / לא נכלל לכל סטטוס",
    excelDetect: "יש_עמודה_לא_ברור",
    excelColumns: [COL.status],
  },
  {
    id: "q-process",
    phase: "א",
    priority: "חשוב",
    question: `«${COL.process}» — מינוי מול מכירה: משפיע על עמלה?`,
    why: "מינוי אולי לא זכאי עד שהפוליסה מופעלת",
    detail:
      "בדוח: מכירה / מינוי. אם מינוי נספר כמו מכירה — ננפח הכנסה. אם לא נספר בכלל — נפספס. צריך כלל ברור מול מגדל.",
    askFor: "כלל: מינוי נכנס / לא נכנס / נכנס רק אחרי סטטוס X",
    excelDetect: "יש_עמודה_לא_ברור",
    excelColumns: [COL.process],
  },
  {
    id: "q-sales-targets-exact",
    phase: "ב",
    priority: "חובה",
    paymentType: "campaigns",
    question: "מה המצטבר המדויק לשנה — יעד 1 / 2 / 3?",
    why: "קובע אם מחשבים 75% / 78% / 82% על כל סגירה",
    detail:
      "אושר עקרונית שמעל ~500K האחוז גדל. עכשיו צריך מספר: כמה מצטבר יש לכם מול מגדל השנה, ובאיזו מדרגה אתם רשמית. בלי זה נחשב היקף באחוז לא נכון.",
    askFor: "מספר מצטבר + מדרגה רשמית (1/2/3) לשנה הנוכחית",
    excelDetect: "מחוץ_לדוח",
  },
  {
    id: "q-transfer",
    phase: "ב",
    priority: "חובה",
    paymentType: "volume",
    question: "סכום העברה / ניוד — מאיפה לוקחים?",
    why: "מסלול היקף נפרד: ₪ קבוע לכל מיליון — לא אחוז מפרמיה",
    detail:
      "בדוח יש «תאריך העברה ליצרן» אבל אין סכום שהועבר. בלי סכום אי אפשר לחשב עמלת ניוד/העברה לפי טבלת המדרגות בנספח.",
    askFor: "מקור הנתונים (גיליון אחר / דוח מגדל / ידני) או «אין ניוד אצלנו»",
    excelDetect: "חסר_באקסל",
  },
  {
    id: "q-policy-term",
    phase: "ב",
    priority: "חשוב",
    paymentType: "volume",
    question: "תקופת ביטוח לריסק — איך יודעים? (100% / 50% / 0%)",
    why: "עד 5 שנים 100%, 5–8 50%, מעל 8 0% על פרמיה קובעת",
    detail:
      "בנספח 2025 יש שיקול תקופה על היקף ריסק. באקסל אין עמודת תקופת ביטוח — אי אפשר לדעת אוטומטית.",
    askFor: "מאיפה לוקחים תקופה / האם מתעלמים אצלכם / כלל קבוע",
    excelDetect: "חסר_באקסל",
  },
  {
    id: "q-pension-excel",
    phase: "ב",
    priority: "חובה",
    paymentType: "accumulation",
    question: "פנסיה בדוח — איזה סוג מוצר? מה בסיס הגמולים?",
    why: "עמלת פנסיה על דמי גמולים — לא על «פרמיה» של בריאות",
    detail:
      "דוח המנהלים בנוי בעיקר לחיים/בריאות/משכנתא. אם יש פנסיה — צריך לדעת איך היא מסומנת ב«סוג המוצר» ומה המספר שמשמש כבסיס (גמולים). אחרת נדחה פנסיה לשלב ב' עם מקור נתונים אחר.",
    askFor: "מיפוי ערכים + מקור סכום גמולים (או «לא בדוח הזה»)",
    excelDetect: "חסר_באקסל",
    excelColumns: [COL.product, COL.premium],
  },
  {
    id: "q-gemel-excel",
    phase: "ב",
    priority: "חובה",
    paymentType: "accumulation",
    question: "גמל / השתלמות — מיפוי בדוח + בסיס צבירה",
    why: "נספח גמל נפרד — יתרה / הפקדות לא בדוח",
    detail:
      "אין יתרת צבירה או הפקדה בגמל בעמודות הדוח. צריך לדעת אם בכלל רצים גמל דרך הדוח הזה, או ממקור אחר.",
    askFor: "מיפוי מוצרים + מקור יתרה/הפקדה (או «לא כאן»)",
    excelDetect: "חסר_באקסל",
    excelColumns: [COL.product],
  },
  {
    id: "q-pension-type",
    phase: "ב",
    priority: "חשוב",
    paymentType: "accumulation",
    question: "שכיר vs עצמאי · הצטרפות vs ניוד — איך מסומן?",
    why: "שיעורים ונוסחאות שונים בנספחי פנסיה/גמל",
    detail:
      "החוזה מבחין בין מסלולים. באקסל אין דגלים כאלה — רק אם מוצפן בתוך שם מוצר.",
    askFor: "איך מזהים / האם רלוונטי אצלכם",
    excelDetect: "חסר_באקסל",
  },
  {
    id: "q-timing",
    phase: "ג",
    priority: "משני",
    question: "עמלה לפי תאריך סגירה או תאריך קבלת כסף?",
    why: "קובע באיזה חודש נרשום הכנסה ב-PnL",
    detail:
      "יש «תאריך העברה ליצרן». הכסף ממגדל יכול להגיע מאוחר יותר. צריך כלל חשבונאי: לפי סגירה (צבירה) או לפי קבלה (מזומן).",
    askFor: "סגירה / קבלה / אחר",
    excelDetect: "חלקי",
    excelColumns: [COL.transferDate],
  },
  {
    id: "q-clawback",
    phase: "ג",
    priority: "משני",
    question: `«${STATUS.cancelled}» — מתי מורידים מהרווח?`,
    why: "החזר עמלות / clawback",
    detail:
      "אם פוליסה בוטלה אחרי שכבר רשמנו הכנסה — מתי ומאיזה חודש מורידים? מיד / בחודש הביטול / לפי הודעת מגדל?",
    askFor: "כלל החזר + האם יש תקופת החזר בחוזה שאתם מיישמים",
    excelDetect: "יש_עמודה_לא_ברור",
    excelColumns: [COL.status],
  },
];

/** @deprecated use MIGDAL_PAYMENT_SECTIONS */
export const MIGDAL_MISSING_CATEGORIES: MissingCategory[] = [
  {
    id: "excel-basics",
    title: "כללים על עמודות הדוח",
    intro: `שמות העמודות = בדיוק כמו ב${MANAGERS_EXCEL_NAME}. חובה לסגור לפני חיבור ל${SOURCE_PNL_REPORT_NAME}.`,
    priority: "blocking",
    items: [
      {
        id: "premium-period",
        question: `המספר בעמודת «${COL.premium}» — סכום לחודש או לשנה?`,
        why: "טעות = חישוב שגוי פי 12. דוגמה: 500 — זה 500 ₪/חודש או 500 ₪/שנה?",
        excelColumns: [COL.premium],
        reportToday: `מכפילים ×${DEFAULT_PNL_MULTIPLIER} בלי לדעת תקופה`,
        needAnswer: "כלל אחד לכל הדוח: חודשי / שנתי",
      },
      {
        id: "premium-definition",
        question: `«${COL.premium}» = «נפרעית פרמיה» מהחוזה (מה שנגבה בפועל)?`,
        why: "החוזה לא מחשב הצעה, פרמיה שנתית, או סכום שלא שולם.",
        excelColumns: [COL.premium],
        reportToday: "לא מאמתים מול «נפרעית פרמיה»",
        needAnswer: "כן / לא — ואם לא, מה כן?",
      },
      {
        id: "company-name",
        question: `איך «מגדל» מופיע בעמודת «${COL.company}»?`,
        why: "רק שורות עם שם נכון ייכנסו לחישוב מגדל.",
        excelColumns: [COL.company],
        reportToday: "מסננים לפי טקסט «מגדל» (בערך)",
        needAnswer: "רשימה: מגדל / מגדל מקפת / …",
      },
      {
        id: "product-map",
        question: `טבלת מיפוי: «${COL.product}» → שורה בחוזה + אחוז`,
        why: "כל ערך בדוח חייב שורה אחת בחוזה — ראו טבלת המיפוי למטה.",
        excelColumns: [COL.product],
        reportToday: "לא בשימוש — כולם ×9",
        needAnswer: "אישור / תיקון טבלת המיפוי",
      },
      {
        id: "start-date",
        question: `«${COL.startDate}» = תחילת פוליסה לחישוב שנת עמלה?`,
        why: "בריאות: א'–ה' 22% / ו' 19%. חיים: א'–ו' 22% / ז' 19%. בלי תאריך אי אפשר.",
        excelColumns: [COL.startDate],
        reportToday: "נקרא מהדוח — לא משפיע על עמלה",
        needAnswer: "כן — משתמשים בו / לא — מה כן?",
      },
      {
        id: "year-one",
        question: "כל שורה חדשה בדוח = תמיד «שנה א'» לעמלה?",
        why: "חידוש / הגדלה / העברה — אולי שנה שנייה ומעלה.",
        excelColumns: [COL.transferDate, COL.startDate],
        reportToday: "לא מחשבים שנת פוליסה",
        needAnswer: "כלל: מתי שנה א', מתי לא",
      },
      {
        id: "status-filter",
        question: `אילו ערכי «${COL.status}» נכנסים לרווח?`,
        why: "קובע אילו שורות סופרות ב-PnL.",
        excelColumns: [COL.status],
        reportToday: `ערכים בדוח: ${STATUS.active}, ${STATUS.pending}, ${STATUS.cancelled}, ${STATUS.archived}`,
        needAnswer: "רשימה: מה נכלל / מה לא",
      },
      {
        id: "process-type",
        question: `«${COL.process}» (${PROCESS.sale} / ${PROCESS.appointment}) — משפיע?`,
        why: "מינוי אולי לא זכאי לעמלה עד הפעלה.",
        excelColumns: [COL.process],
        reportToday: "לא מסננים לפי סוג תהליך",
        needAnswer: "כלל לכלול / להוציא מינוי",
      },
    ],
  },
  {
    id: "life-health",
    title: "חיים ובריאות — אימות מול החוזה",
    relatedDoc: "noname (2) · 05/10/2025",
    intro:
      "נוסחה: נפרעית פרמיה × שיעור. בריאות §9 ≠ חיים §8 — טבלאות ושנות פוליסה נפרדות.",
    priority: "blocking",
    items: [
      {
        id: "rates-confirm",
        question: "לאשר שיעורי שנה א' מהחוזה מול מה שאתם מכירים בפועל",
        why: "בריאות 22% (§9 א'–ה'), משכנתא 15%, תאונות 22% (§8 א'–ו'), אכ\"ע 8–10%, התפתחות הילד 4.75%.",
        excelColumns: [COL.product, COL.premium],
        reportToday: `כולם ×${DEFAULT_PNL_MULTIPLIER}`,
        needAnswer: "אישור או תיקון לכל מוצר",
      },
      {
        id: "health-variants",
        question: "«בריאות» מול «בריאות + מחלות קשות» — אותו אחוז?",
        why: "בחוזה §9.1 מזור לסרטן = אותה טבלת בריאות (22/19/19/7). לא טבלת חיים §8.",
        excelColumns: [COL.product],
        reportToday: "ממופה לאותה טבלת בריאות §9",
        needAnswer: "אישור מיפוי / תיקון אם שונה אצלכם",
      },
      {
        id: "examples",
        question: "3 דוגמאות אימות (טבלה למטה) — מול תשלום ממגדל בפועל",
        why: "הוכחה שהנוסחה = כסף בבנק.",
        excelColumns: [COL.product, COL.premium, COL.startDate],
        reportToday: "אין אימות",
        needAnswer: "מלאו 3 שורות + סכום שקיבלנו",
      },
    ],
  },
  {
    id: "pension",
    title: "קרנות פנסיה",
    relatedDoc: "noname · 05/10/2025",
    intro: "בסיס: דמי גמולים לקרן — לא עמודת «פרמיה» הרגילה.",
    priority: "phase2",
    items: [
      {
        id: "pension-in-excel",
        question: "האם פנסיה מופיעה בדוח? באיזה «סוג המוצר»?",
        why: "בלי שדה — פנסיה נשארת מחוץ ל-PnL בשלב א'.",
        excelColumns: [COL.product, COL.company],
        needAnswer: "רשימת ערכים / «לא מופיע»",
      },
      {
        id: "pension-base",
        question: "מה הסכום בדוח לפנסיה — דמי גמולים? מעסיק? סה\"כ?",
        why: "החוזה: רק גמולים שוטפים שהופקדו.",
        excelColumns: [COL.premium],
        needAnswer: "הגדרה + איזו עמודה",
      },
      {
        id: "pension-salary-type",
        question: "שכיר vs עצמאי — איך מסומן בדוח?",
        why: "שיעורים שונים בנספח הפנסיה.",
        needAnswer: "שדה / הערה / לא קיים",
      },
      {
        id: "pension-transfer",
        question: "הצטרפות חדשה vs העברה / ניוד — איך מבדילים?",
        why: "נספח 2025 — תשלום לפי מיליון העברה.",
        excelColumns: [COL.process, COL.product],
        needAnswer: "כלל זיהוי",
      },
    ],
  },
  {
    id: "gemel",
    title: "קופות גמל",
    relatedDoc: "noname (1) · 05/10/2025",
    intro: "מסמך נפרד מפנסיה.",
    priority: "phase2",
    items: [
      {
        id: "gemel-in-excel",
        question: "אילו ערכי «סוג המוצר» = גמל / השתלמות / מטריה?",
        why: "כל סוג → שיעור בחוזה.",
        excelColumns: [COL.product],
        needAnswer: "רשימה מלאה מהדוח",
      },
      {
        id: "gemel-base",
        question: "בסיס חישוב גמל — גמולים או «פרמיה»?",
        why: "כמו פנסיה — לא תמיד עמודת פרמיה.",
        excelColumns: [COL.premium],
        needAnswer: "הגדרה ברורה",
      },
      {
        id: "gemel-employer",
        question: "רק הפקדות ששולמו — איך זה נראה בדוח?",
        why: "חד-פעמי / שלא נגבה — לא בעמלה.",
        needAnswer: "כלל + דוגמה",
      },
    ],
  },
  {
    id: "activity-2025",
    title: "נספח פעילות 2025",
    relatedDoc: "noname (3) · 19/10/2025",
    intro: "היקף, יעדים, פרמיה קובעת, סכום העברה.",
    priority: "phase2",
    items: [
      {
        id: "when-2025",
        question: "מתי משתמשים בנספח 2025 לעומת נספחים השוטפים?",
        needAnswer: "כלל עסקי מהנהלה",
      },
      {
        id: "determining-premium",
        question: "«פרמיה קובעת» — מה זה אצלכם מול «פרמיה» בדוח?",
        excelColumns: [COL.premium],
        needAnswer: "הגדרה + האם שונה מהעמודה",
      },
      {
        id: "sales-targets",
        question: "יעדי מכירות 2025 — משפיעים על תשלום בפועל?",
        needAnswer: "כן/לא + איך",
      },
      {
        id: "transfer-amount",
        question: "סכום העברה/ניוד — מאיפה בדוח (אם בכלל)?",
        needAnswer: "שדה / מחוץ לדוח",
      },
    ],
  },
  {
    id: "pnl-integration",
    title: `חיבור ל«${SOURCE_PNL_REPORT_NAME}»`,
    intro: "אחרי סגירת שלב א' + דוגמאות.",
    priority: "later",
    items: [
      {
        id: "commission-timing",
        question: "עמלה לפי «תאריך העברה ליצרן» או לפי מועד קבלת כסף?",
        excelColumns: [COL.transferDate],
        reportToday: "לפי תאריך סגירה בדוח",
        needAnswer: "כלל אחד",
      },
      {
        id: "clawback",
        question: `«${STATUS.cancelled}» — מורידים מהרווח? מתי?`,
        excelColumns: [COL.status],
        needAnswer: "כלל ביטול / החזר",
      },
      {
        id: "partial-phased",
        question: "שלב א': רק חיים/בריאות. שלב ב': פנסיה/גמל. מסכימים?",
        reportToday: `×${DEFAULT_PNL_MULTIPLIER} על הכל`,
        needAnswer: "אישור תוכנית שלבים",
      },
    ],
  },
];

/** @deprecated use MIGDAL_MISSING_CATEGORIES */
export const MIGDAL_MISSING_ITEMS = MIGDAL_MISSING_CATEGORIES.flatMap((cat) =>
  cat.items.map((item) => ({
    ...item,
    blocking: cat.priority === "blocking",
  })),
);

export function insurerById(id: string): InsurerAgreement | undefined {
  return INSURERS.find((row) => row.id === id);
}
