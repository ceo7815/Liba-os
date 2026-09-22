/**
 * Canonical registry of every calculation formula the OS uses.
 * Numbers come from the live constants — do not hardcode rates here.
 * When you add a formula to the system, add a FormulaDoc here (see assertFormulasCatalog).
 */
import {
  DEFAULT_SALARIED_BENEFITS,
  EMPLOYEE_WAGE_FROM_MONTH,
  FREELANCER_FORMULA_OPTIONS,
  FREELANCERS_1,
  FREELANCERS_2,
  FREELANCERS_3,
  FREELANCERS_4,
  MONTHLY_COST_FIELDS,
  PARTNERSHIP,
} from "@/lib/employees/contract";
import {
  ALEXANDER_LEAD_RATE,
  FREELANCER_LEAD_SHARE,
} from "@/lib/employees/lead-costs";
import { EMPLOYEE_AGREEMENTS_PATH, EMPLOYEE_PAYROLL_PATH } from "@/lib/employees/access";
import {
  INSURANCE_AGREEMENTS_PATH,
  SOURCE_PNL_PATH,
  SETTLED_COMMISSIONS_PATH,
} from "@/lib/finance/access";
import {
  DEFAULT_AGENT_MULTIPLIER,
  DEFAULT_PROFIT_THRESHOLD,
  formatIls,
} from "@/lib/sales-dashboard/campaign-math";
import {
  AYALON_ANNUAL_MONTHS,
  AYALON_BASE_VOLUME_RATE,
  AYALON_MORTGAGE_RATE,
  AYALON_SETTLED_PAY_DELAY_MONTHS,
  AYALON_SETTLED_RATE,
  AYALON_VOLUME_PAY_DELAY_MONTHS,
  AYALON_VOLUME_TIERS,
} from "@/lib/finance/ayalon-contract";
import {
  HAREL_ANNUAL_MONTHS,
  HAREL_BASE_VOLUME_RATE,
  HAREL_PAY_DELAY_MONTHS,
  HAREL_SETTLED_RATE,
  HAREL_VOLUME_TIERS,
} from "@/lib/finance/harel-contract";
import {
  PHOENIX_ANNUAL_MONTHS,
  PHOENIX_BASE_VOLUME_RATE,
  PHOENIX_MORTGAGE_WEIGHT,
  PHOENIX_PAY_DELAY_MONTHS,
  PHOENIX_SETTLED_RATE,
  PHOENIX_VOLUME_TIERS,
} from "@/lib/finance/phoenix-contract";
import {
  CLAL_ANNUAL_MONTHS,
  CLAL_GAMACH_RATE,
  CLAL_LADDER_BASE_RATE,
  CLAL_LADDER_TIERS,
  CLAL_MORTGAGE_TIERS,
  CLAL_SETTLED_PAY_DELAY_MONTHS,
  CLAL_SETTLED_RATE,
  CLAL_VOLUME_PAY_DELAY_MONTHS,
} from "@/lib/finance/clal-contract";
import {
  MIGDAL_ANNUAL_MONTHS,
  MIGDAL_BASE_VOLUME_RATE,
  MIGDAL_GAMACH_RATE,
  MIGDAL_SETTLED_PAY_DELAY_MONTHS,
  MIGDAL_SETTLED_RATE,
  MIGDAL_VOLUME_TIERS,
} from "@/lib/finance/migdal-contract";
import { FORMULAS_PATH } from "@/lib/formulas/access";
import type { FormulaCategory, FormulaDoc } from "@/lib/formulas/types";

const EMPLOYEES = "/employees";
const PAYROLL = EMPLOYEE_PAYROLL_PATH;
const AGREEMENTS = EMPLOYEE_AGREEMENTS_PATH;

function pct(value: number): string {
  return `${value}%`;
}

function monthHe(month: string): string {
  const [year, m] = month.split("-");
  return `${m}/${year}`;
}

export const FORMULA_CATEGORIES: FormulaCategory[] = [
  {
    id: "leads",
    label: "לידים",
    description: "מה יורד משכר עצמאי על ליד שהופק — לפי מקור.",
  },
  {
    id: "freelancer",
    label: "שכר עצמאים",
    description: "נוסחאות היקף ונפרעים שמופיעות בכרטיס העובד.",
  },
  {
    id: "partnership",
    label: "שותפים",
    description: "תשלום לפי מקור הפניה, לא לפי שם מוכר.",
  },
  {
    id: "salaried",
    label: "שכר שכירים",
    description: "שעתי, גלובלי, רק משכורת, והפרשות מעסיק.",
  },
  {
    id: "wage-rules",
    label: "כללי שכר",
    description: "חודש מכירה, מה נספר להיקף, ומה יורד מהשכר.",
  },
  {
    id: "pnl",
    label: "רווח והפסד",
    description: "הכנסה מחברות, הוצאות קמפיין ושכר בקוביות השיווק.",
  },
  {
    id: "insurance",
    label: "הסכמי ביטוח",
    description: "נוסחאות עמלה מול חברות — מפורטות במסך ההסכמים.",
  },
];

export const CALCULATION_FORMULAS: FormulaDoc[] = [
  {
    id: "leads-google-facebook",
    category: "leads",
    title: "גוגל ופייסבוק — 50% מ־CPL",
    summary: "עצמאי משלם מחצית מעלות הליד של אותו מקור באותו חודש העברה, לכל הפקה פעילה.",
    equation: `חיוב = CPL × ${FREELANCER_LEAD_SHARE}   ·   CPL = הוצאה ÷ לידים`,
    terms: [
      { label: "חלק העצמאי", value: pct(FREELANCER_LEAD_SHARE * 100) },
      { label: "חודש החיוב", value: "חודש העברה (לא חודש תחילת ביטוח)" },
      { label: "גוגל — ליד", value: "שיחה נכנסת" },
      { label: "פייסבוק — ליד", value: "טופס באתר" },
      { label: "מתי", value: "רק הפקה פעילה שנספרת להיקף" },
    ],
    notes: [
      "מקור אורגני בלי הוצאה ממודעות לא מחויב.",
      "מצטבר עם רועי ועם אלכסנדר על הפקות אחרות באותו חודש.",
    ],
    example: {
      given: "הוצאה ₪1,000 על 10 לידים · 3 הפקות",
      result: `CPL ${formatIls(100)} · לכל הפקה ${formatIls(100 * FREELANCER_LEAD_SHARE)} · סה״כ ${formatIls(3 * 100 * FREELANCER_LEAD_SHARE)}`,
    },
    usedIn: [
      { label: "קוביית עובד", href: EMPLOYEES },
      { label: "משכורות", href: PAYROLL },
    ],
  },
  {
    id: "leads-roy-azulai",
    category: "leads",
    title: "רועי אזולאי / קו 2 — פרמיה 1:1",
    summary: "כל שקל פרמיה שהופקה ממקור רועי אזולאי יורד מהשכר, לפי חודש מכירה.",
    equation: "חיוב = פרמיה שהופקה",
    terms: [
      { label: "מקורות", value: "רועי אזולאי · קו 2 רועי אזולאי" },
      { label: "חודש החיוב", value: "חודש מכירה / הפקה" },
      { label: "סטטוס", value: "רק הפקה פעילה שנספרת להיקף" },
    ],
    notes: ["לא מחליף את גוגל/פייסבוק — מצטבר על הפקות אחרות."],
    example: {
      given: "הפקה ₪2,000 מרועי + הפקה ₪500 מקו 2",
      result: `יורד ${formatIls(2500)}`,
    },
    usedIn: [
      { label: "קוביית עובד", href: EMPLOYEES },
      { label: "משכורות", href: PAYROLL },
    ],
  },
  {
    id: "leads-alexander",
    category: "leads",
    title: "קמפיין אלכסנדר — ₪60 לליד",
    summary: "כל סגירה מאלכסנדר מחויבת אוטומטית, ובסוף החודש ממלאים לידים שהתקבלו ולא הופקו.",
    equation: `חיוב = (סגירות + לידים שלא הופקו) × ${formatIls(ALEXANDER_LEAD_RATE)}`,
    terms: [
      { label: "תעריף", value: formatIls(ALEXANDER_LEAD_RATE) },
      { label: "סגירות", value: "מהאקסל, חודש מכירה" },
      { label: "לא הופקו", value: "שדה ידני בכרטיס העצמאי לסוף החודש" },
    ],
    notes: ["לא מחויב ממודעות גוגל/פייסבוק."],
    example: {
      given: "12 סגירות ו־88 לידים שלא הופקו",
      result: `${12 + 88} × ${formatIls(ALEXANDER_LEAD_RATE)} = ${formatIls((12 + 88) * ALEXANDER_LEAD_RATE)}`,
    },
    usedIn: [
      { label: "קוביית עובד", href: EMPLOYEES },
      { label: "משכורות", href: PAYROLL },
    ],
  },
  {
    id: "leads-who-pays",
    category: "leads",
    title: "מי משלם על לידים",
    summary: "רק עצמאי בנוסחה שמשלמת לידים. עצמאים 4 אביחי יוסף פטור.",
    equation: FREELANCERS_4.paysLeadCosts
      ? "עצמאים 4 משלם על לידים"
      : `${FREELANCERS_4.label}: חיוב לידים = ₪0`,
    terms: [
      { label: "משלמים", value: "עצמאים 1 · עצמאים 2 · עצמאים 3 · נוסחה ידנית" },
      { label: "לא משלמים", value: FREELANCERS_4.label },
      { label: "שכיר / ללא שכר", value: "אין חיוב לידים" },
    ],
    usedIn: [
      { label: "קוביית עובד", href: EMPLOYEES },
      { label: "נוסחאות חישוב", href: FORMULAS_PATH },
    ],
  },
  {
    id: "wage-freelancers_1",
    category: "freelancer",
    title: FREELANCERS_1.label,
    summary: "נפרעים שוטף 60 ונגרר: העסק מקבל חלק מהפרמיה, והעצמאי מקבל מחצית מזה.",
    equation: `נפרע לעצמאי = פרמיה × ${pct(FREELANCERS_1.companyPercent)} × ${pct(FREELANCERS_1.sharePercent)} = ${pct(FREELANCERS_1.settledPercent)}`,
    terms: [
      { label: "לעסק", value: pct(FREELANCERS_1.companyPercent) },
      { label: "חלק העצמאי מתוך העסק", value: pct(FREELANCERS_1.sharePercent) },
      { label: "לעצמאי מהפרמיה", value: pct(FREELANCERS_1.settledPercent) },
      { label: "עיכוב תשלום", value: `${FREELANCERS_1.payDelayMonths} חודשים (שוטף 60)` },
    ],
    notes: ["מכירה בינואר משתלמת ממרץ, ואז נגרר כל עוד הפוליסה פעילה."],
    example: {
      given: `פרמיה ${formatIls(300)}`,
      result: formatIls(Math.round((300 * FREELANCERS_1.settledPercent) / 100)),
    },
    usedIn: [
      { label: "כרטיס עובד — הסכם", href: EMPLOYEES },
      { label: "משכורות", href: PAYROLL },
    ],
  },
  {
    id: "wage-freelancers_2",
    category: "freelancer",
    title: FREELANCERS_2.label,
    summary: "כמו עצמאים 1 בשוטף 60 ונגרר, עם אחוז נפרעים אחר מהפרמיה.",
    equation: `נפרע לעצמאי = פרמיה × ${pct(FREELANCERS_2.settledPercent)}`,
    terms: [
      { label: "לעצמאי מהפרמיה", value: pct(FREELANCERS_2.settledPercent) },
      { label: "עיכוב תשלום", value: `${FREELANCERS_2.payDelayMonths} חודשים (שוטף 60)` },
    ],
    example: {
      given: `פרמיה ${formatIls(300)}`,
      result: formatIls(Math.round((300 * FREELANCERS_2.settledPercent) / 100)),
    },
    usedIn: [
      { label: "כרטיס עובד — הסכם", href: EMPLOYEES },
      { label: "משכורות", href: PAYROLL },
    ],
  },
  {
    id: "wage-freelancers_3",
    category: "freelancer",
    title: FREELANCERS_3.label,
    summary: "רק היקף: מכפיל על פרמיית מכירה פעילה בחודש המכירה. אין נפרעים.",
    equation: `שכר היקף = פרמיה × ${FREELANCERS_3.volumeMultiplier}`,
    terms: [
      { label: "מכפיל", value: String(FREELANCERS_3.volumeMultiplier) },
      { label: "אחוז היקף", value: pct(FREELANCERS_3.volumePercent) },
      { label: "נפרעים", value: "אין" },
    ],
    example: {
      given: `פרמיה ${formatIls(1000)}`,
      result: formatIls(1000 * FREELANCERS_3.volumeMultiplier),
    },
    usedIn: [
      { label: "כרטיס עובד — הסכם", href: EMPLOYEES },
      { label: "משכורות", href: PAYROLL },
    ],
  },
  {
    id: "wage-freelancers_4",
    category: "freelancer",
    title: FREELANCERS_4.label,
    summary: "שכר קבוע כל חודש, היקף לפי מוקד ליבה, נפרעים 3% שוטף 60 על ליבה בלבד. בלי עלויות לידים.",
    equation: `שכר = ${formatIls(FREELANCERS_4.fixedMonthly)} + היקף ליבה + נפרעים ${pct(FREELANCERS_4.settledPercent)}`,
    terms: [
      { label: "קבוע חודשי", value: formatIls(FREELANCERS_4.fixedMonthly) },
      {
        label: "סף מוקד",
        value: `${FREELANCERS_4.hubThreshold.toLocaleString("he-IL")}+ → ${pct(FREELANCERS_4.highVolumePercent)} · מתחת → ${pct(FREELANCERS_4.lowVolumePercent)}`,
      },
      { label: "נפרעים", value: `${pct(FREELANCERS_4.settledPercent)} מליבה · שוטף 60 · בלי שמש` },
      { label: "לידים", value: FREELANCERS_4.paysLeadCosts ? "משלם" : "לא מחויב" },
      {
        label: "שמש — תמיד בהיקף",
        value: FREELANCERS_4.shemeshAlwaysAgents.join(" · "),
      },
      {
        label: "שמש — רק בחלון",
        value: `${monthHe(FREELANCERS_4.shemeshVolumeFromMonth)}–${monthHe(FREELANCERS_4.shemeshVolumeToMonth)}`,
      },
      {
        label: "פער קיזוזים",
        value: `${formatIls(FREELANCERS_4.oneTimeGap.amount)} · ${FREELANCERS_4.oneTimeGap.note} · ${monthHe(FREELANCERS_4.oneTimeGap.month)}`,
      },
    ],
    notes: [
      "היקף לפי מקורות ליבה של כל המוקד, לא רק סגירות על שם אביחי.",
      "ניב לב רן נכנס להיקף גם על מקור שמש כל התקופה. בלי נפרעים על השמש.",
    ],
    example: {
      given: `מוקד ${formatIls(21000)}`,
      result: `${formatIls(FREELANCERS_4.fixedMonthly)} + ${formatIls(21000 * (FREELANCERS_4.highVolumePercent / 100))} = ${formatIls(FREELANCERS_4.fixedMonthly + 21000 * (FREELANCERS_4.highVolumePercent / 100))} (בלי נפרעים)`,
    },
    usedIn: [
      { label: "כרטיס עובד — הסכם", href: EMPLOYEES },
      { label: "משכורות", href: PAYROLL },
    ],
  },
  {
    id: "wage-custom",
    category: "freelancer",
    title: "ידני — אחוזים בהסכם",
    summary: "היקף ונפרעים לפי האחוזים שנשמרו בהסכם של אותו עובד, בלי תבנית קבועה.",
    equation: "שכר = פרמיית היקף × % היקף + פרמיית נפרעים × % נפרעים − עלויות",
    terms: [
      { label: "היקף", value: "אחוז / מכפיל מההסכם" },
      { label: "נפרעים", value: "אחוז מההסכם, אם הוגדר" },
      { label: "לידים", value: "עצמאי ידני משלם לפי נוסחאות הלידים" },
    ],
    usedIn: [{ label: "כרטיס עובד — הסכם", href: EMPLOYEES }],
  },
  {
    id: "wage-salaried-hourly",
    category: "salaried",
    title: "שכיר שעתי",
    summary: "שכר בסיס משעות החודש, ועליו מדרגות היקף, נסיעות והפרשות מעסיק. אין נפרעים.",
    equation: "שכר = (שעות × תעריף) + מדרגות היקף + נסיעות + הפרשות − עלויות הסכם",
    terms: [
      { label: "שעות", value: "קובץ נוכחות חודשי" },
      { label: "היקף", value: "מדרגות מכפיל לפי סה״כ פרמיה בחודש, בלי תאונות אישיות" },
      { label: "נפרעים", value: "שכיר לא מקבל נפרעים" },
    ],
    usedIn: [
      { label: "כרטיס עובד", href: EMPLOYEES },
      { label: "משכורות", href: PAYROLL },
    ],
  },
  {
    id: "wage-salaried-global",
    category: "salaried",
    title: "שכיר גלובלי",
    summary: "משכורת חודשית קבועה. אין מדרגות על מכירות ואין נפרעים. אפשר נסיעות והפרשות.",
    equation: "שכר = משכורת גלובלית + נסיעות + הפרשות − עלויות הסכם",
    usedIn: [{ label: "כרטיס עובד", href: EMPLOYEES }],
  },
  {
    id: "wage-salaried-salary-only",
    category: "salaried",
    title: "שכיר — רק משכורת",
    summary: "משכורת חודשית בלבד. בלי מדרגות, בונוסים, נסיעות ונפרעים.",
    equation: "שכר = משכורת חודשית − עלויות הסכם",
    usedIn: [{ label: "כרטיס עובד", href: EMPLOYEES }],
  },
  {
    id: "wage-salaried-benefits",
    category: "salaried",
    title: "הפרשות מעסיק — ברירת מחדל",
    summary: "ערכי ברירת מחדל להסכם שכיר חדש. אפשר לשנות לעובד.",
    equation: "הפרשה = בסיס (עד תקרה) × שיעור מעסיק",
    terms: [
      { label: "תקרה", value: formatIls(DEFAULT_SALARIED_BENEFITS.contributionCeiling) },
      { label: "פיצויים מעסיק", value: pct(DEFAULT_SALARIED_BENEFITS.severanceEmployerPercent) },
      { label: "פנסיה עובד / מעסיק", value: `${pct(DEFAULT_SALARIED_BENEFITS.pensionEmployeePercent)} / ${pct(DEFAULT_SALARIED_BENEFITS.pensionEmployerPercent)}` },
      { label: "השתלמות עובד / מעסיק", value: `${pct(DEFAULT_SALARIED_BENEFITS.studyFundEmployeePercent)} / ${pct(DEFAULT_SALARIED_BENEFITS.studyFundEmployerPercent)}` },
      { label: "נסיעות", value: formatIls(DEFAULT_SALARIED_BENEFITS.travelAmount) },
    ],
    usedIn: [{ label: "כרטיס עובד — הסכם", href: EMPLOYEES }],
  },
  {
    id: "wage-unpaid",
    category: "wage-rules",
    title: "ללא שכר",
    summary: "הסגירות נכנסות לדוחות בלי הוצאת שכר — רווח ישיר לחברה.",
    equation: "שכר לעובד = ₪0   ·   הכנסה לחברה = פרמיה × מכפיל חברות",
    usedIn: [{ label: "קוביית עובד", href: EMPLOYEES }],
  },
  {
    id: "wage-partnership",
    category: "partnership",
    title: "שותפים — אורשן משכנתאות",
    summary:
      "שיתוף פעולה לפי מקור הפניה, לא עובד. תשלום לשותף על כל סגירה פעילה מהמקור, כולל תאונות אישיות. הנפרעים נשארים בחברה. מוכר ליבה לא מקבל עמלה על אותה שורה.",
    equation: `תשלום לשותף = פרמיה × ${PARTNERSHIP.volumeMultiplier}   ·   נפרעים לשותף = ₪0   ·   שכר מוכר ליבה = ₪0`,
    terms: [
      { label: "מקור", value: `${PARTNERSHIP.canonicalSource} · גם אושרן משכנתאות` },
      { label: "מכפיל", value: `×${PARTNERSHIP.volumeMultiplier}` },
      { label: "מה נספר", value: "כל סגירה פעילה מהמקור, כולל תאונות אישיות" },
      { label: "נפרעים", value: "נשארים בדוח החברה" },
    ],
    notes: [
      "בלי כרטיס שותף עדיין נספרת הוצאה ×4 ברווח לפי מקור.",
      "אל תפתחו את אושרן כעצמאי — השורות באקסל הן על שם מוכר ליבה.",
    ],
    example: {
      given: "פרמיה ₪400 ממקור אורשן",
      result: `תשלום לשותף ${formatIls(400 * PARTNERSHIP.volumeMultiplier)} · נפרעים לשותף ${formatIls(0)}`,
    },
    usedIn: [
      { label: "קוביית שותף", href: EMPLOYEES },
      { label: "רווח והפסד לפי מקור", href: SOURCE_PNL_PATH },
      { label: "משכורות", href: PAYROLL },
    ],
  },
  {
    id: "wage-month",
    category: "wage-rules",
    title: "חודש השכר",
    summary: "חודש השכר הוא חודש המכירה (תחילת ביטוח). הפקה ב־1 לחודש שייכת לחודש שלפניו.",
    equation: "אם יום = 01 → חודש קודם   ·   אחרת → חודש התאריך",
    terms: [
      { label: "מתאריך", value: `טבלאות שכר מ־${monthHe(EMPLOYEE_WAGE_FROM_MONTH)}` },
      { label: "שעות", value: "לא זזות עם כלל ה־1 לחודש" },
    ],
    notes: ["עלויות לידים מגוגל/פייסבוק רצות לפי חודש העברה, לא לפי חודש מכירה."],
    usedIn: [
      { label: "סקירת עובד", href: EMPLOYEES },
      { label: "משכורות", href: PAYROLL },
    ],
  },
  {
    id: "wage-volume-eligibility",
    category: "wage-rules",
    title: "מה נספר להיקף",
    summary: "רק מכירה פעילה נספרת להיקף ולמדרגות. תאונות אישיות בחוץ.",
    equation: "היקף ← סטטוס פעיל + תהליך מכירה + לא תאונות אישיות",
    terms: [
      { label: "לא נספר", value: "ממתין · בוטל · תאונות אישיות" },
      { label: "גם ללידים", value: "חיוב ליד רק על הפקה שנספרת להיקף" },
    ],
    notes: [
      "שותף אורשן משכנתאות: תאונות אישיות כן נספרות לתשלום ×4.",
    ],
    usedIn: [
      { label: "סקירת עובד", href: EMPLOYEES },
      { label: "משכורות", href: PAYROLL },
    ],
  },
  {
    id: "wage-agreement-costs",
    category: "wage-rules",
    title: "עלויות הסכם שקוזזו",
    summary: "עמדה, תפעול ומשרד יורדים מהשכר כל חודש שבו ההסכם בתוקף.",
    equation: `עלויות = ${MONTHLY_COST_FIELDS.map((row) => row.label).join(" + ")}`,
    terms: MONTHLY_COST_FIELDS.map((row) => ({ label: row.label, value: "סכום מההסכם, לחודש" })),
    usedIn: [
      { label: "קוביית עובד", href: EMPLOYEES },
      { label: "משכורות", href: PAYROLL },
    ],
  },
  {
    id: "wage-paid",
    category: "wage-rules",
    title: "שכר ששולם",
    summary: "הסכום אחרי היקף, נפרעים וקיזוזים — מה שמופיע בראש הקובייה.",
    equation: "שכר ששולם = היקף + נפרעים + קבוע − עלויות הסכם − עלויות לידים",
    notes: ["לעצמאים 4 אין רכיב עלויות לידים."],
    usedIn: [
      { label: "קוביית עובד", href: EMPLOYEES },
      { label: "משכורות", href: PAYROLL },
    ],
  },
  {
    id: "pnl-insurer-income",
    category: "pnl",
    title: "הכנסה מחברות הביטוח",
    summary: "רק לפי חוזה שמור לכל חברה. בלי חוזה ההכנסה היא ₪0 — אין מכפיל קבוע.",
    equation: "הכנסה = סכום חוזי החברות על סגירות פעילות (מגדל + כלל + איילון + הפניקס + הראל · השאר ₪0)",
    terms: [
      { label: "מגדל", value: "היקף לפי מדרגה + נפרעים 22%" },
      { label: "כלל", value: "היקף ריסק/בריאות 75/78/85 · משכנתא 70/75/80 + נפרעים 22%" },
      { label: "איילון", value: "היקף לפי מדרגה + נפרעים 22%" },
      { label: "הפניקס", value: "היקף לפי מדרגה + נפרעים 24% על מכירה" },
      { label: "הראל", value: "היקף 75/85 + נפרעים 24% על מכירה" },
      { label: "חברה בלי הסכם", value: "₪0" },
    ],
    notes: ["הוסר מכפיל ×9. כל חברה מחוברת בנפרד לפי החוזה שלה."],
    usedIn: [
      { label: "רווח והפסד לפי מקור", href: SOURCE_PNL_PATH },
      { label: "הסכמי ביטוח", href: INSURANCE_AGREEMENTS_PATH },
    ],
  },
  {
    id: "pnl-campaign",
    category: "pnl",
    title: "רווח קמפיין",
    summary: "הכנסה מחברות פחות שכר עובדים פחות הוצאות מודעות.",
    equation: "רווח = הכנסה לפי חוזה − שכר − מודעות",
    terms: [
      { label: "סף ירוק", value: pct(Math.round(DEFAULT_PROFIT_THRESHOLD * 100)) },
      {
        label: "מכפיל שכר בלי הסכם",
        value: String(DEFAULT_AGENT_MULTIPLIER),
      },
    ],
    notes: ["בלי הסכם שמור אין שכר מומצא — המכפיל הוא 0."],
    usedIn: [{ label: "שיווק / מקורות", href: SOURCE_PNL_PATH }],
  },
  {
    id: "pnl-source-settled",
    category: "pnl",
    title: "היקף מול נפרעים בדוחות",
    summary: "דוח היקף סופר מכירות. דוח נפרעים סופר מינוי סוכן מהאקסל.",
    equation: "היקף ← תהליך מכירה   ·   נפרעים ← מינוי / נפרע מהאקסל",
    usedIn: [
      { label: "רווח והפסד לפי מקור", href: SOURCE_PNL_PATH },
      { label: "נפרעים", href: SETTLED_COMMISSIONS_PATH },
    ],
  },
  {
    id: "insurance-contracts",
    category: "insurance",
    title: "עמלות מול חברות הביטוח",
    summary: "כל חברה בכרטיס משלה. החישוב החי רץ רק מחוזה שמור — מגדל, כלל, איילון, הפניקס והראל מחוברות.",
    equation: "עמלה = לפי חוזה החברה (מוצר × מדרגה × שיעור)",
    notes: ["חברה בלי הסכם נשארת ₪0 בדוח עד שמזינים אותה."],
    usedIn: [
      { label: "הסכמי ביטוח", href: INSURANCE_AGREEMENTS_PATH },
      { label: "הסכמי עובדים", href: AGREEMENTS },
    ],
  },
  {
    id: "insurance-migdal-volume",
    category: "insurance",
    title: "מגדל — היקף לפי מדרגה שנתית",
    summary:
      "פרמיה חודשית × 12 = פרמיה קובעת. מדרגה אחת לכל השנה (ינואר–דצמבר), רטרו על כל המכירות הפעילות.",
    equation: `היקף = (פרמיה × ${MIGDAL_ANNUAL_MONTHS}) × שיעור מדרגה`,
    terms: MIGDAL_VOLUME_TIERS.map((tier) => ({
      label: tier.to == null ? `מ־${tier.from.toLocaleString("he-IL")}` : `${tier.from.toLocaleString("he-IL")}–${tier.to.toLocaleString("he-IL")}`,
      value: `${Math.round(tier.rate * 100)}% · שוטף ${Math.round(tier.cashRate * 100)}%`,
    })),
    notes: [
      "מוצרים: חיים, משכנתאות, בריאות, מחלות קשות, מחלות סרטן.",
      "רק סגירה פעילה מסוג מכירה.",
      `ביעד העליון מקבלים רטרו ${Math.round((MIGDAL_VOLUME_TIERS[2].rate - MIGDAL_BASE_VOLUME_RATE) * 100)} נקודות אחוז על כל הפעילות השנה.`,
    ],
    example: {
      given: `פרמיה חודשית ${formatIls(500)} במדרגת 75%`,
      result: `${formatIls(500)} × ${MIGDAL_ANNUAL_MONTHS} × 75% = ${formatIls(4500)}`,
    },
    usedIn: [
      { label: "הסכמי ביטוח — מגדל", href: INSURANCE_AGREEMENTS_PATH },
      { label: "רווח והפסד לפי מקור", href: SOURCE_PNL_PATH },
    ],
  },
  {
    id: "insurance-migdal-gamach",
    category: "insurance",
    title: "מגדל — גמ״ח 20% לסוף שנה",
    summary: "מתוך ההיקף, 20 נקודות אחוז נשארות במגדל ומתקבלות בסוף שנת לוח.",
    equation: `גמ״ח = (פרמיה × ${MIGDAL_ANNUAL_MONTHS}) × ${Math.round(MIGDAL_GAMACH_RATE * 100)}%`,
    terms: [
      { label: "שוטף", value: "55% / 58% / 65% לפי מדרגה" },
      { label: "גמ״ח", value: "20% לסוף שנה" },
    ],
    notes: ["בדוח ההכנסה נרשמת במלואה (75/78/85). הגמ״ח מוצג בנפרד כיתרה אצל מגדל."],
    example: {
      given: `פרמיה קובעת ${formatIls(6000)} במדרגה ראשונה`,
      result: `שוטף ${formatIls(3300)} · גמ״ח ${formatIls(1200)}`,
    },
    usedIn: [{ label: "הסכמי ביטוח — מגדל", href: INSURANCE_AGREEMENTS_PATH }],
  },
  {
    id: "insurance-migdal-settled",
    category: "insurance",
    title: "מגדל — נפרעים 22% שוטף 60",
    summary: "מינוי פעיל במגדל על אותם מוצרים משולם 22% מהפרמיה החודשית, שוטף 60.",
    equation: `נפרעים = פרמיה × ${Math.round(MIGDAL_SETTLED_RATE * 100)}%`,
    terms: [
      { label: "שיעור", value: `${Math.round(MIGDAL_SETTLED_RATE * 100)}%` },
      { label: "תזמון", value: `שוטף ${MIGDAL_SETTLED_PAY_DELAY_MONTHS * 30}` },
      { label: "תהליך באקסל", value: "מינוי / מינוי סוכן" },
    ],
    example: {
      given: `פרמיה ${formatIls(500)}`,
      result: formatIls(Math.round(500 * MIGDAL_SETTLED_RATE)),
    },
    usedIn: [
      { label: "הסכמי ביטוח — מגדל", href: INSURANCE_AGREEMENTS_PATH },
      { label: "נפרעים", href: SETTLED_COMMISSIONS_PATH },
    ],
  },
  {
    id: "insurance-clal-volume",
    category: "insurance",
    title: "כלל — היקף ריסק / בריאות / מחלות",
    summary:
      "פרמיה חודשית × 12 = פרמיה קובעת. מדרגה נפרדת ממשכנתא, ינואר–דצמבר, רטרו על המכירות הפעילות במסלול.",
    equation: `היקף = (פרמיה × ${CLAL_ANNUAL_MONTHS}) × שיעור מדרגה`,
    terms: CLAL_LADDER_TIERS.map((tier) => ({
      label: tier.to == null ? `מ־${tier.from.toLocaleString("he-IL")}` : `${tier.from.toLocaleString("he-IL")}–${tier.to.toLocaleString("he-IL")}`,
      value: `${Math.round(tier.rate * 100)}% · שוטף ${Math.round(tier.cashRate * 100)}%`,
    })),
    notes: [
      "מוצרים: ריסק, בריאות, מחלות קשות, מחלות סרטן.",
      "רק סגירה פעילה מסוג מכירה.",
      "לא מתערבב עם מדרגת המשכנתא.",
      `ביעד העליון מקבלים רטרו ${Math.round((CLAL_LADDER_TIERS[2].rate - CLAL_LADDER_BASE_RATE) * 100)} נקודות אחוז על המסלול.`,
      `תשלום לפי הפקה · שוטף ${CLAL_VOLUME_PAY_DELAY_MONTHS * 30}.`,
    ],
    example: {
      given: `פרמיה חודשית ${formatIls(500)} במדרגת 75%`,
      result: `${formatIls(500)} × ${CLAL_ANNUAL_MONTHS} × 75% = ${formatIls(4500)}`,
    },
    usedIn: [
      { label: "הסכמי ביטוח — כלל", href: INSURANCE_AGREEMENTS_PATH },
      { label: "רווח והפסד לפי מקור", href: SOURCE_PNL_PATH },
    ],
  },
  {
    id: "insurance-clal-mortgage",
    category: "insurance",
    title: "כלל — היקף משכנתאות",
    summary: "מסלול נפרד: 70/75/80 לפי היקף משכנתא שנתי בלבד. גמ״ח 10% לסוף שנה כמו במסלול הריסק.",
    equation: `היקף משכנתא = (פרמיה × ${CLAL_ANNUAL_MONTHS}) × שיעור מדרגה`,
    terms: CLAL_MORTGAGE_TIERS.map((tier) => ({
      label: tier.to == null ? `מ־${tier.from.toLocaleString("he-IL")}` : `${tier.from.toLocaleString("he-IL")}–${tier.to.toLocaleString("he-IL")}`,
      value: `${Math.round(tier.rate * 100)}% · שוטף ${Math.round(tier.cashRate * 100)}%`,
    })),
    notes: [
      "רק מוצר משכנתא. ריסק משועבד נשאר במסלול הריסק/בריאות.",
      `שוטף ${CLAL_VOLUME_PAY_DELAY_MONTHS * 30} לפי הפקה.`,
    ],
    example: {
      given: `פרמיה חודשית ${formatIls(500)} במדרגת 70%`,
      result: `${formatIls(500)} × ${CLAL_ANNUAL_MONTHS} × 70% = ${formatIls(4200)}`,
    },
    usedIn: [
      { label: "הסכמי ביטוח — כלל", href: INSURANCE_AGREEMENTS_PATH },
      { label: "רווח והפסד לפי מקור", href: SOURCE_PNL_PATH },
    ],
  },
  {
    id: "insurance-clal-gamach",
    category: "insurance",
    title: "כלל — גמ״ח 10% לסוף שנה",
    summary: "מתוך ההיקף, 10 נקודות אחוז נשארות בכלל ומתקבלות בסוף שנת לוח — בשני המסלולים.",
    equation: `גמ״ח = (פרמיה × ${CLAL_ANNUAL_MONTHS}) × ${Math.round(CLAL_GAMACH_RATE * 100)}%`,
    terms: [
      { label: "ריסק / בריאות שוטף", value: "65% / 68% / 75% לפי מדרגה" },
      { label: "משכנתא שוטף", value: "60% / 65% / 70% לפי מדרגה" },
      { label: "גמ״ח", value: "10% לסוף שנה" },
    ],
    notes: ["בדוח ההכנסה נרשמת במלואה (75/78/85 או 70/75/80). הגמ״ח מוצג בנפרד כיתרה אצל כלל."],
    example: {
      given: `פרמיה קובעת ${formatIls(6000)} במדרגת ריסק ראשונה`,
      result: `שוטף ${formatIls(3900)} · גמ״ח ${formatIls(600)}`,
    },
    usedIn: [{ label: "הסכמי ביטוח — כלל", href: INSURANCE_AGREEMENTS_PATH }],
  },
  {
    id: "insurance-clal-settled",
    category: "insurance",
    title: "כלל — נפרעים 22% שוטף 60",
    summary: "מינוי פעיל בכלל על אותם מוצרים משולם 22% מהפרמיה החודשית, שוטף 60 — כמו מגדל.",
    equation: `נפרעים = פרמיה × ${Math.round(CLAL_SETTLED_RATE * 100)}%`,
    terms: [
      { label: "שיעור", value: `${Math.round(CLAL_SETTLED_RATE * 100)}%` },
      { label: "תזמון", value: `שוטף ${CLAL_SETTLED_PAY_DELAY_MONTHS * 30}` },
      { label: "תהליך באקסל", value: "מינוי / מינוי סוכן" },
    ],
    example: {
      given: `פרמיה ${formatIls(500)}`,
      result: formatIls(Math.round(500 * CLAL_SETTLED_RATE)),
    },
    usedIn: [
      { label: "הסכמי ביטוח — כלל", href: INSURANCE_AGREEMENTS_PATH },
      { label: "נפרעים", href: SETTLED_COMMISSIONS_PATH },
    ],
  },
  {
    id: "insurance-ayalon-volume",
    category: "insurance",
    title: "איילון — היקף לפי מדרגה שנתית",
    summary:
      "פרמיה חודשית × 12 = פרמיה קובעת. מדרגה אחת לינואר–דצמבר, רטרו על מוצרי המדרגה. אין גמ״ח — הכל שוטף.",
    equation: `היקף = (פרמיה × ${AYALON_ANNUAL_MONTHS}) × שיעור מדרגה`,
    terms: AYALON_VOLUME_TIERS.map((tier) => ({
      label: tier.to == null ? `מ־${tier.from.toLocaleString("he-IL")}` : `${tier.from.toLocaleString("he-IL")}–${tier.to.toLocaleString("he-IL")}`,
      value: `${Math.round(tier.rate * 100)}% הכל שוטף`,
    })),
    notes: [
      "מוצרים במדרגה: ריסק משועבד, בריאות, מחלות קשות, מחלות סרטן.",
      "רק סגירה פעילה מסוג מכירה.",
      `ביעד העליון מקבלים רטרו ${Math.round((AYALON_VOLUME_TIERS[2].rate - AYALON_BASE_VOLUME_RATE) * 100)} נקודות אחוז על מוצרי המדרגה.`,
      `תשלום לפי הפקה · שוטף ${AYALON_VOLUME_PAY_DELAY_MONTHS * 30}.`,
    ],
    example: {
      given: `פרמיה חודשית ${formatIls(500)} במדרגת 70%`,
      result: `${formatIls(500)} × ${AYALON_ANNUAL_MONTHS} × 70% = ${formatIls(4200)}`,
    },
    usedIn: [
      { label: "הסכמי ביטוח — איילון", href: INSURANCE_AGREEMENTS_PATH },
      { label: "רווח והפסד לפי מקור", href: SOURCE_PNL_PATH },
    ],
  },
  {
    id: "insurance-ayalon-mortgage",
    category: "insurance",
    title: "איילון — משכנתא 60% קבוע",
    summary:
      "ביטוח משכנתא נעול על 60% ולא עולה עם המדרגה. הפרמיה כן נספרת למצטבר השנתי שקובע 70/75/85 לשאר המוצרים.",
    equation: `היקף משכנתא = (פרמיה × ${AYALON_ANNUAL_MONTHS}) × ${Math.round(AYALON_MORTGAGE_RATE * 100)}%`,
    terms: [
      { label: "שיעור", value: `${Math.round(AYALON_MORTGAGE_RATE * 100)}% קבוע` },
      { label: "גמ״ח", value: "אין" },
      { label: "רטרו", value: "אין — לא עולה" },
    ],
    notes: [
      "ריסק משועבד הוא מוצר אחר — הוא במדרגות 70/75/85.",
      "מכירות משכנתא נספרות יחד עם שאר המוצרים לקביעת המדרגה.",
    ],
    example: {
      given: `פרמיה חודשית ${formatIls(500)} במשכנתא, גם אחרי יעד עליון`,
      result: `${formatIls(500)} × ${AYALON_ANNUAL_MONTHS} × 60% = ${formatIls(3600)}`,
    },
    usedIn: [
      { label: "הסכמי ביטוח — איילון", href: INSURANCE_AGREEMENTS_PATH },
      { label: "רווח והפסד לפי מקור", href: SOURCE_PNL_PATH },
    ],
  },
  {
    id: "insurance-ayalon-settled",
    category: "insurance",
    title: "איילון — נפרעים 22% שוטף 60",
    summary: "מינוי פעיל באיילון על אותם מוצרים משולם 22% מהפרמיה החודשית, שוטף 60 — כמו במגדל.",
    equation: `נפרעים = פרמיה × ${Math.round(AYALON_SETTLED_RATE * 100)}%`,
    terms: [
      { label: "שיעור", value: `${Math.round(AYALON_SETTLED_RATE * 100)}%` },
      { label: "תזמון", value: `שוטף ${AYALON_SETTLED_PAY_DELAY_MONTHS * 30}` },
      { label: "תהליך באקסל", value: "מינוי / מינוי סוכן" },
    ],
    notes: ["כולל משכנתא — הנפרעים 22%, לא 60% של היקף המשכנתא."],
    example: {
      given: `פרמיה ${formatIls(500)}`,
      result: formatIls(Math.round(500 * AYALON_SETTLED_RATE)),
    },
    usedIn: [
      { label: "הסכמי ביטוח — איילון", href: INSURANCE_AGREEMENTS_PATH },
      { label: "נפרעים", href: SETTLED_COMMISSIONS_PATH },
    ],
  },
  {
    id: "insurance-phoenix-volume",
    category: "insurance",
    title: "הפניקס — היקף לפי מדרגה שנתית",
    summary:
      "פרמיה חודשית × 12 = פרמיה קובעת. מדרגה אחת לינואר–דצמבר, רטרו על כל המכירות הפעילות. אין גמ״ח — הכל שוטף 60.",
    equation: `היקף = (פרמיה × ${PHOENIX_ANNUAL_MONTHS}) × שיעור מדרגה`,
    terms: PHOENIX_VOLUME_TIERS.map((tier) => ({
      label: tier.to == null ? `מ־${tier.from.toLocaleString("he-IL")}` : `${tier.from.toLocaleString("he-IL")}–${tier.to.toLocaleString("he-IL")}`,
      value: `${Math.round(tier.rate * 100)}% הכל שוטף 60`,
    })),
    notes: [
      "מוצרים: ריסק משועבד, משכנתאות, בריאות, מחלות קשות, מחלות סרטן.",
      "רק סגירה פעילה מסוג מכירה.",
      `ביעד העליון מקבלים רטרו ${Math.round((PHOENIX_VOLUME_TIERS[4].rate - PHOENIX_BASE_VOLUME_RATE) * 100)} נקודות אחוז על כל הפעילות השנה.`,
      `תשלום לפי הפקה · שוטף ${PHOENIX_PAY_DELAY_MONTHS * 30}.`,
    ],
    example: {
      given: `פרמיה חודשית ${formatIls(500)} במדרגת 80%`,
      result: `${formatIls(500)} × ${PHOENIX_ANNUAL_MONTHS} × 80% = ${formatIls(4800)}`,
    },
    usedIn: [
      { label: "הסכמי ביטוח — הפניקס", href: INSURANCE_AGREEMENTS_PATH },
      { label: "רווח והפסד לפי מקור", href: SOURCE_PNL_PATH },
    ],
  },
  {
    id: "insurance-phoenix-mortgage-weight",
    category: "insurance",
    title: "הפניקס — משכנתא נספרת 50% למדרגה",
    summary:
      "מוצר משכנתא נספר לחצי מהפרמיה הקובעת לצורך המדרגה השנתית. התשלום עצמו הוא באחוז המדרגה המלא — אין נעילה על 60%.",
    equation: `משקל למדרגה = (פרמיה × ${PHOENIX_ANNUAL_MONTHS}) × ${Math.round(PHOENIX_MORTGAGE_WEIGHT * 100)}%`,
    terms: [
      { label: "משקל למדרגה", value: `${Math.round(PHOENIX_MORTGAGE_WEIGHT * 100)}%` },
      { label: "תשלום", value: "אחוז המדרגה המלא (80–92%)" },
    ],
    notes: [
      "דוגמה: ₪1,000 משכנתא בשנה נספרים כ־₪500 למדרגה.",
      "ריסק משועבד נספר 100% — זה מוצר אחר.",
    ],
    example: {
      given: `פרמיה חודשית ${formatIls(1000)} במשכנתא, מדרגת 80%`,
      result: `נספר ${formatIls(6000)} · משולם ${formatIls(9600)}`,
    },
    usedIn: [
      { label: "הסכמי ביטוח — הפניקס", href: INSURANCE_AGREEMENTS_PATH },
      { label: "רווח והפסד לפי מקור", href: SOURCE_PNL_PATH },
    ],
  },
  {
    id: "insurance-phoenix-settled",
    category: "insurance",
    title: "הפניקס — נפרעים 24% על מכירה",
    summary: "נפרעים 24% מהפרמיה החודשית על מכירה פעילה. מינוי סוכן טרם הוגדר. מגדל ואיילון נשארים 22%.",
    equation: `נפרעים = פרמיה × ${Math.round(PHOENIX_SETTLED_RATE * 100)}%   ·   רק תהליך מכירה`,
    terms: [
      { label: "שיעור", value: `${Math.round(PHOENIX_SETTLED_RATE * 100)}%` },
      { label: "תזמון", value: `שוטף ${PHOENIX_PAY_DELAY_MONTHS * 30}` },
      { label: "תהליך באקסל", value: "מכירה בלבד" },
    ],
    notes: ["לא מחליף את נוסחת מגדל/איילון. רק הפניקס.", "מינוי סוכן יוגדר בהמשך — לא תחת ה־24%."],
    example: {
      given: `פרמיה ${formatIls(500)} במכירה`,
      result: formatIls(Math.round(500 * PHOENIX_SETTLED_RATE)),
    },
    usedIn: [
      { label: "הסכמי ביטוח — הפניקס", href: INSURANCE_AGREEMENTS_PATH },
      { label: "נפרעים", href: SETTLED_COMMISSIONS_PATH },
    ],
  },
  {
    id: "insurance-harel-volume",
    category: "insurance",
    title: "הראל — היקף לפי מדרגה שנתית",
    summary:
      "פרמיה חודשית × 12 = פרמיה קובעת. מדרגה אחת לינואר–דצמבר, רטרו על כל המכירות הפעילות. אין גמ״ח — הכל שוטף 60.",
    equation: `היקף = (פרמיה × ${HAREL_ANNUAL_MONTHS}) × שיעור מדרגה`,
    terms: HAREL_VOLUME_TIERS.map((tier) => ({
      label: tier.to == null ? `מ־${tier.from.toLocaleString("he-IL")}` : `${tier.from.toLocaleString("he-IL")}–${tier.to.toLocaleString("he-IL")}`,
      value: `${Math.round(tier.rate * 100)}% הכל שוטף 60`,
    })),
    notes: [
      "מוצרים: ריסק משועבד, משכנתאות, בריאות, מחלות קשות, מחלות סרטן.",
      "משכנתא במדרגה המלאה — בלי משקל 50% ובלי נעילה 60%.",
      "רק סגירה פעילה מסוג מכירה.",
      `מעל ₪600K מקבלים רטרו ${Math.round((HAREL_VOLUME_TIERS[1].rate - HAREL_BASE_VOLUME_RATE) * 100)} נקודות אחוז על כל הפעילות השנה.`,
      `תשלום לפי הפקה · שוטף ${HAREL_PAY_DELAY_MONTHS * 30}.`,
    ],
    example: {
      given: `פרמיה חודשית ${formatIls(500)} במדרגת 75%`,
      result: `${formatIls(500)} × ${HAREL_ANNUAL_MONTHS} × 75% = ${formatIls(4500)}`,
    },
    usedIn: [
      { label: "הסכמי ביטוח — הראל", href: INSURANCE_AGREEMENTS_PATH },
      { label: "רווח והפסד לפי מקור", href: SOURCE_PNL_PATH },
    ],
  },
  {
    id: "insurance-harel-settled",
    category: "insurance",
    title: "הראל — נפרעים 24% על מכירה",
    summary: "נפרעים 24% מהפרמיה החודשית על מכירה פעילה. מינוי סוכן טרם הוגדר.",
    equation: `נפרעים = פרמיה × ${Math.round(HAREL_SETTLED_RATE * 100)}%   ·   רק תהליך מכירה`,
    terms: [
      { label: "שיעור", value: `${Math.round(HAREL_SETTLED_RATE * 100)}%` },
      { label: "תזמון", value: `שוטף ${HAREL_PAY_DELAY_MONTHS * 30}` },
      { label: "תהליך באקסל", value: "מכירה" },
    ],
    notes: ["מינוי סוכן יוגדר בהמשך — לא תחת ה־24%."],
    example: {
      given: `פרמיה ${formatIls(500)} במכירה`,
      result: formatIls(Math.round(500 * HAREL_SETTLED_RATE)),
    },
    usedIn: [
      { label: "הסכמי ביטוח — הראל", href: INSURANCE_AGREEMENTS_PATH },
      { label: "נפרעים", href: SETTLED_COMMISSIONS_PATH },
    ],
  },
];

export function formulasInCategory(category: FormulaCategory["id"] | "all"): FormulaDoc[] {
  if (category === "all") return CALCULATION_FORMULAS;
  return CALCULATION_FORMULAS.filter((row) => row.category === category);
}

export function assertFormulasCatalog(): void {
  const ids = new Set<string>();
  for (const row of CALCULATION_FORMULAS) {
    if (ids.has(row.id)) throw new Error(`duplicate formula id ${row.id}`);
    ids.add(row.id);
    if (!row.title.trim() || !row.equation.trim()) {
      throw new Error(`formula ${row.id} needs title and equation`);
    }
  }
  for (const option of FREELANCER_FORMULA_OPTIONS) {
    const id = `wage-${option.id}`;
    if (!ids.has(id)) {
      throw new Error(`FREELANCER_FORMULA_OPTIONS ${option.id} must have catalog entry ${id}`);
    }
  }
  for (const required of [
    "leads-google-facebook",
    "leads-roy-azulai",
    "leads-alexander",
    "leads-who-pays",
    "wage-month",
    "wage-partnership",
    "pnl-insurer-income",
    "insurance-migdal-volume",
    "insurance-migdal-gamach",
    "insurance-migdal-settled",
    "insurance-clal-volume",
    "insurance-clal-mortgage",
    "insurance-clal-gamach",
    "insurance-clal-settled",
    "insurance-ayalon-volume",
    "insurance-ayalon-mortgage",
    "insurance-ayalon-settled",
    "insurance-phoenix-volume",
    "insurance-phoenix-mortgage-weight",
    "insurance-phoenix-settled",
    "insurance-harel-volume",
    "insurance-harel-settled",
  ]) {
    if (!ids.has(required)) throw new Error(`missing required formula ${required}`);
  }
}
