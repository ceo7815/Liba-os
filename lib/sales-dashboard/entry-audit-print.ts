import type { EntryGap } from "@/lib/sales-dashboard/entry-audit";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function printEntryAudit(input: {
  title: string;
  rangeLabel: string;
  printedAt: string;
  rows: EntryGap[];
  fields: { label: string; count: number }[];
}): void {
  const total = input.rows.length;
  const fieldLine = input.fields.map((field) => `${escapeHtml(field.label)} ${field.count.toLocaleString("he-IL")}`).join(" · ");
  const body = input.rows
    .map((row, index) => {
      const missing = row.missing.map((field) => escapeHtml(field.label)).join(" · ");
      const sheet = row.sheet ? `<div class="muted">${escapeHtml(row.sheet)} · שורה ${row.excelRow}</div>` : "";
      return `<tr>
        <td class="num">${index + 1}</td>
        <td><strong>${escapeHtml(row.client || "בלי שם")}</strong>${sheet}</td>
        <td>${escapeHtml(row.agent || "—")}</td>
        <td class="num">${escapeHtml(row.transfer || "—")}</td>
        <td>${escapeHtml(row.company || "—")}</td>
        <td>${escapeHtml(row.status || "—")}</td>
        <td class="miss">${missing}</td>
      </tr>`;
    })
    .join("");
  const sections = body
    ? `<table>
        <thead>
          <tr>
            <th class="num">#</th>
            <th>לקוח</th>
            <th>משווק</th>
            <th>העברה ליצרן</th>
            <th>חברה</th>
            <th>סטטוס</th>
            <th>להשלים</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(input.title)}</title>
  <style>
    @page { size: A4; margin: 12mm 11mm 14mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #1a1a1a; font-family: Arial, "Segoe UI", sans-serif; font-size: 11px; line-height: 1.35; }
    .top { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; border-bottom: 3px solid #1a1a1a; padding-bottom: 8px; }
    h1 { margin: 0; font-size: 22px; letter-spacing: -0.02em; }
    .mark { display: inline-block; margin-inline-end: 8px; background: #ffe14a; padding: 1px 7px; font-size: 12px; font-weight: 700; }
    .meta { margin: 6px 0 0; color: #5c5c56; }
    .when { color: #5c5c56; text-align: left; white-space: nowrap; }
    .lead { margin: 10px 0 0; }
    .fields { margin: 8px 0 0; color: #5c5c56; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
    th { padding: 5px 6px; border-bottom: 1px solid #ddd; color: #5c5c56; font-size: 10px; font-weight: 700; text-align: right; }
    td { padding: 5px 6px; border-bottom: 1px solid #eee; vertical-align: top; text-align: right; }
    tr { break-inside: avoid; }
    .num { width: 72px; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .miss { font-weight: 700; }
    .muted { color: #5c5c56; font-size: 10px; font-weight: 400; }
    .note { margin-top: 14px; color: #5c5c56; }
  </style>
</head>
<body>
  <header class="top">
    <div>
      <h1><span class="mark">ליבה</span>בקרת הזנה</h1>
      <p class="meta">${escapeHtml(input.rangeLabel)} · ${total.toLocaleString("he-IL")} שורות להשלמה</p>
    </div>
    <div class="when">הופק ${escapeHtml(input.printedAt)}</div>
  </header>
  <p class="lead">לכל שורה, להשלים בדוח המנהלים את השדות שבעמודה «להשלים». בפעילה, בתהליך הפקה, חוסרים נציג, תהליך שימור ותנאי חיתום מופיע כל חוסר. בדחייה, בוטלה וגניזה מופיע כל חוסר חוץ מתחילת ביטוח ופרמיה.</p>
  ${fieldLine ? `<p class="fields">${fieldLine}</p>` : ""}
  ${sections || "<p>אין שורות להשלמה בטווח הזה.</p>"}
  <p class="note">רק שורות מכירה בסטטוסים האלה. מינוי לא נכלל. פרמיה 0 נחשבת מלאה. שורה בלי תאריך העברה לא נכנסת לסינון של חודש.</p>
</body>
</html>`;

  const page = window.open("", "_blank");
  if (!page) return;
  page.document.open();
  page.document.write(html);
  page.document.close();
  window.setTimeout(() => {
    page.focus();
    page.print();
  }, 200);
}
