# מבנה שמש

העמודים לא נמחקו. התפריט מקבץ אותם. המקור בקוד: `lib/shemesh/ia.ts`.

אין בריפו מסמך אפיון נפרד מלבד רשימת השלבים שב־`lib/shemesh/catalog.ts` והמסכים שכבר נבנו. המיפוי כאן נשען עליהם.

## עץ

- לוח בקרה → `/shemesh`
- לקוחות ותיקים → `/shemesh/clients`
  - תיקים → `/shemesh/cases` (צינור התיק: שלב, מטפל, SLA)
  - פדיונות → `/shemesh/gviya` (שלב 1)
  - החזרי מס → `/shemesh/tax-refunds` (שלב 2)
  - השוואת תיק → `/shemesh/portfolio-report`
  - ביטוח → `/shemesh/insurance` (שלב 9)
- שיווק ומכירות → `/shemesh/commercial`
  - לידים → `/shemesh/leads`
  - החזרת לידים → `/shemesh/revival` (שלב 7)
  - שיווק → `/shemesh/marketing` (שלב 8)
  - שורות מכירה → `/shemesh/sales`
- כספים → `/shemesh/finance`
  - הכנסות מגבייה → `/shemesh/revenue`
  - הכנסות חוזרות → `/shemesh/income`
  - הוצאות → `/shemesh/expenses`
  - הוצאות קבועות → `/shemesh/costs` (שלב 10)
  - חובות → `/shemesh/debts`
  - עמלות → `/shemesh/commissions`
  - קבלות → `/shemesh/receipts` (שלב 4)
  - שכר → `/shemesh/payroll` (שלב 5)
  - רווח והפסד → `/shemesh/reports`
  - התחשבנות מול ליבה → `/shemesh/settlement` (שלב 11)
- מערכת → `/shemesh/system`
  - חיבורים → `/shemesh/sources` (פייסבוק, גוגל, שורנס, ריווחית, גרואו, חברות ביטוח)
  - שורנס → `/shemesh/agency` (שלב 3)
  - נוסחאות → `/shemesh/formulas`
  - הגדרות → `/shemesh/settings`
  - הרשאות → `/shemesh/permissions`

הכנסות מגבייה והכנסות חוזרות הם שני מסכים שונים. אין שני פריטים בשם «הכנסה».

## התנהגות

קבוצה נפתחת ונסגרת. המצב נשמר בדפדפן. העמוד הפעיל מסומן. לכל קבוצה יש עמוד נחיתה עם כרטיסים ומספר אם הוא כבר מחושב. פירורי לחם מופיעים מעל העמוד. Ctrl+K פותח את החיפוש, ואותם יעדים מופיעים שם. במובייל התפריט הוא גיליון תחתון עם אותו עץ.
