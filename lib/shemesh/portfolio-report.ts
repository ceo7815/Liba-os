export type ReportCost = { id: string; label: string; amount: string };

export type ReportSide = {
  title: string;
  note: string;
  lines: string;
  costs: ReportCost[];
  total: string;
};

export type ReportBlock = {
  id: string;
  title: string;
  existing: ReportSide;
  proposed: ReportSide;
};

export type PortfolioReport = {
  familyName: string;
  manager: string;
  updatedOn: string;
  phone: string;
  existingCaption: string;
  proposedCaption: string;
  blocks: ReportBlock[];
  gains: string;
  checks: string;
};

export function reportId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function emptySide(): ReportSide {
  return { title: "", note: "", lines: "", costs: [], total: "" };
}

export function emptyBlock(): ReportBlock {
  return { id: reportId(), title: "", existing: emptySide(), proposed: emptySide() };
}

function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
}

export function emptyReport(): PortfolioReport {
  return {
    familyName: "",
    manager: "שי בר-און",
    updatedOn: todayIso(),
    phone: "077-2376102",
    existingCaption: "",
    proposedCaption: "",
    blocks: [emptyBlock()],
    gains: "",
    checks: "",
  };
}

function side(title: string, note: string, lines: string, costs: [string, string][], total: string): ReportSide {
  return {
    title,
    note,
    lines,
    costs: costs.map(([label, amount]) => ({ id: reportId(), label, amount })),
    total,
  };
}

export function tantFamilyReport(): PortfolioReport {
  return {
    familyName: "משפחת טאנט",
    manager: "שי בר-און",
    updatedOn: "2026-10-12",
    phone: "077-2376102",
    existingCaption: "6 פוליסות ב־3 חברות",
    proposedCaption: "3 הצעות חדשות במגדל, ו־3 פוליסות מגדל שנשארות",
    blocks: [
      {
        id: "life",
        title: "ביטוח חיים / ריסק — פומפיל טאנט",
        existing: side(
          "מנורה מבטחים · פוליסה 371506445 · ריסק 1",
          "",
          "סכום ביטוח ₪1,016,482.76 · מוות מכל סיבה, תאונה או מחלה.\nתקופת ביטוח 08/2025–07/2039. מעשן. תוספת רפואית 25%.\nהנחה נוכחית 65% עד 07/2027, ואחר כך יורדת בהדרגה.\nהחרגה: בדף הפרטים לא צוינה החרגה רפואית נקובה, מעבר לתנאי הפוליסה.",
          [],
          "1346.19",
        ),
        proposed: side(
          "מגדל · הצעה · ביטוח חיים",
          "",
          "סכום פיצוי ₪1,000,000.\nהנחה 85%.\nהחלטה: לא משנים את מבנה הכיסוי מעבר לסכום ולהנחה שבהצעה.",
          [],
          "365",
        ),
      },
      {
        id: "michaela",
        title: "בריאות ומחלות קשות — מיכאלה סוינה טאנט",
        existing: side(
          "מנורה מבטחים · פוליסה 363329046 · מבוטחת משנית",
          "",
          "מחלות קשות, קרן אור טופ: ₪222,187.15 · ₪561.33. הנחה נוכחית 20% עד 30/11/2026.\nהשתלות וטיפולים מיוחדים בחו״ל ₪14.90 · תרופות מיוחדות ₪25.27.\nניתוחים בישראל, משלים שב״ן, ללא השתתפות עצמית ₪180.75.\nניתוחים וטיפולים מחליפי ניתוח בחו״ל ₪11.60 · שירותים אמבולטוריים ₪19.59.\nאבחון מהיר ₪17.72 · תרופה בהתאמה אישית ₪35.34.\nניהול רפואי אישי ₪10.32 · רפואה אלטרנטיבית ₪19.56.\nהחרגות: אין. בדף הפרטים לא רשומה החרגה על שמה.",
          [],
          "896.38",
        ),
        proposed: side(
          "מגדל · הצעה · ביטוח בריאות",
          "החלטה לביצוע: הורדת סכום הפיצוי למחלות קשות, כדי להוריד עלות ולהיות מכוסים בסל רחב יותר.",
          "השתלות, תרופות מחוץ לסל, ניתוחים בחו״ל, משלים שב״ן, אמבולטורי, אביזרים טכנולוגיים. הנחה 25%.\nמחלות קשות ₪100,000. הנחה 25%.",
          [],
          "817",
        ),
      },
      {
        id: "pompil",
        title: "בריאות ופיצוי סרטן — פומפיל טאנט",
        existing: side(
          "בריאות · מנורה · פוליסה 363329046",
          "",
          "השתלות וטיפולים מיוחדים בחו״ל ₪12.33 · תרופות מיוחדות ₪24.26.\nניתוחים בישראל, משלים שב״ן, ללא השתתפות עצמית ₪281.91.\nניתוחים בחו״ל ₪12.88 · שירותים אמבולטוריים ₪19.10 · אבחון מהיר ₪17.72.\nתרופה בהתאמה אישית ₪51.99 · ניהול רפואי אישי ₪10.32 · רפואה אלטרנטיבית ₪19.56.\nהחרגה: הגבלת לב וכלי דם כליליים על השתלות, תרופות מיוחדות, ניתוחים בישראל, ניתוחים בחו״ל ואמבולטורי.",
          [
            ["בריאות", "450.07"],
            ["מחלות קשות · כלל · פוליסה 120221555 · ₪140,823.01 · החרגה על לב ואירוע מוחי", "1566.30"],
            ["יחד", "2016.37"],
          ],
          "2016.37",
        ),
        proposed: side(
          "מגדל · הצעה · בריאות ופיצוי סרטן, מחוברים",
          "מחלות קשות ₪100,000 בעלות ₪751 יורדות מההצעה. במקומן פיצוי סרטן, מחובר לביטוח הבריאות. ההחרגה באמבולטורי מוסרת.\nהסיבה: בכלל יש החרגה על לב ועל אירוע מוחי. רוב הפוליסה מוחרג, רוב המחלות לא רלוונטיות, ויכול להיות שלא יתקבל כסף גם במחלה אחרת. העלות בכלל קיצונית, והמעבר חוסך.",
          "בריאות: השתלות, תרופות מחוץ לסל, ניתוחים בחו״ל, משלים שב״ן, אמבולטורי, אבחון מהיר, אביזרים טכנולוגיים.\nפיצוי סרטן ₪200,000. הנחה 25%.\nפוליסת כלל 120221555 יוצאת מהתיק. אין מחלות קשות ₪100,000 בהצעה.",
          [
            ["בריאות", "577"],
            ["פיצוי סרטן ₪200,000 · הנחה 25%", "703"],
          ],
          "1280",
        ),
      },
      {
        id: "keep",
        title: "תאונות אישיות וסיעוד — נשארות, בלי שינוי כיסוי",
        existing: side(
          "שלוש פוליסות מגדל, גם בתיק הקיים",
          "",
          "14867333 · מיכאלה סוינה טאנט · תאונות אישיות + סיעודי · ₪320.\n14867330 · פומפיל טאנט · סיעוד · ₪121.\n16263767 · פומפיל טאנט · תאונות אישיות · ₪80.",
          [],
          "521",
        ),
        proposed: side(
          "אותן פוליסות, אותם כיסויים",
          "",
          "מינוי סוכן ועדכון הנחה אגרסיבית, בלי שינוי בפוליסה.\nסכום ההנחה החדש עדיין לא נמסר, ולכן העלות בסיכום נשארת ₪320, ₪121 ו־₪80.",
          [],
          "521",
        ),
      },
    ],
    gains:
      "ריכוז הבריאות והחיים למגדל, במקום מנורה וכלל. שלוש פוליסות התאונות והסיעוד כבר במגדל ונשארות.\nלפומפיל: בריאות מגדל מחוברת לפיצוי סרטן ₪200,000 בהנחה 25%, במקום מחלות קשות בכלל עם החרגה על לב ואירוע מוחי. ההחרגה באמבולטורי מוסרת.\nלמיכאלה: סל בריאות עם אביזרים טכנולוגיים, ומחלות קשות ₪100,000 במקום ₪222,187.\nהנחה 85% בביטוח החיים, מול הנחה נוכחית של 65% שפוחתת בהמשך.",
    checks:
      "למיכאלה סכום מחלות הקשות יורד מ־₪222,187.15 ל־₪100,000. לפומפיל אין מחלות קשות בהצעה: במקום ₪140,823.01 בכלל יש פיצוי סרטן ₪200,000. סכום הריסק יורד מ־₪1,016,482.76 ל־₪1,000,000.\nלא נכללו בהצעת מגדל, ויש היום במנורה: ניהול רפואי אישי, רפואה אלטרנטיבית ותרופה בהתאמה אישית. אבחון מהיר יש היום למיכאלה ולא נכלל בהצעה שלה.\nפיצוי הסרטן אינו מחלות קשות. הוא לא מכסה את ההחרגה על לב ואירוע מוחי, והפוליסה בכלל יוצאת כי רובה מוחרג והעלות קיצונית.\nאין לבטל פוליסה קיימת לפני קבלה בכתב במגדל, חיתום, ותחילת ביטוח בפועל. תקופת אכשרה מתחילה מחדש בכיסוי חדש.\nההנחה האגרסיבית בשלוש פוליסות מגדל הקיימות עדיין בלי סכום. עד שיגיע, הן נספרות בעלות הנוכחית.",
  };
}

export function parseReportAmount(value: string): number {
  const cleaned = value.replace(/[^\d.-]/g, "");
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : 0;
}

export function sideTotal(sideValue: ReportSide): number {
  const typed = parseReportAmount(sideValue.total);
  if (sideValue.total.trim()) return typed;
  return sideValue.costs.reduce((sum, cost) => sum + parseReportAmount(cost.amount), 0);
}

export function formatReportMoney(value: number): string {
  const negative = value < 0;
  const text = new Intl.NumberFormat("he-IL", {
    minimumFractionDigits: Number.isInteger(Math.abs(value)) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  return negative ? `₪ ${text}−` : `₪ ${text}`;
}

export function formatReportDay(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

export function reportLines(value: string): string[] {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

export function reportTotals(report: PortfolioReport) {
  const rows = report.blocks.map((block) => {
    const existing = sideTotal(block.existing);
    const proposed = sideTotal(block.proposed);
    const diff = existing - proposed;
    return { id: block.id, title: block.title || "בלי שם", existing, proposed, diff, annual: diff * 12 };
  });
  const existing = rows.reduce((sum, row) => sum + row.existing, 0);
  const proposed = rows.reduce((sum, row) => sum + row.proposed, 0);
  const diff = existing - proposed;
  return { rows, existing, proposed, diff, annual: diff * 12 };
}
