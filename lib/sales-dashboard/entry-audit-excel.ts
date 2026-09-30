import type { EntryGap } from "@/lib/sales-dashboard/entry-audit";

export async function downloadEntryAuditExcel(input: {
  rangeLabel: string;
  rows: EntryGap[];
}): Promise<void> {
  const XLSX = await import("xlsx");
  const lines = input.rows.map((row, index) => ({
    "#": index + 1,
    לקוח: row.client || "בלי שם",
    משווק: row.agent || "",
    "העברה ליצרן": row.transfer || "",
    חברה: row.company || "",
    סטטוס: row.status || "",
    להשלים: row.missing.map((field) => field.label).join(", "),
    גיליון: row.sheet,
    שורה: row.excelRow,
  }));
  const sheet = XLSX.utils.json_to_sheet(
    lines.length > 0
      ? lines
      : [{ "#": "", לקוח: "אין שורות להשלמה", משווק: "", "העברה ליצרן": "", חברה: "", סטטוס: "", להשלים: "", גיליון: "", שורה: "" }],
  );
  sheet["!cols"] = [6, 22, 18, 16, 16, 18, 42, 14, 8].map((width) => ({ wch: width }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "השלמות");
  const stamp = input.rangeLabel.replace(/[\\/:*?"<>|]/g, " ").trim() || "הכל";
  XLSX.writeFile(book, `בקרת-הזנה ${stamp}.xlsx`);
}
