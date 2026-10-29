import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { canViewShemesh } from "@/lib/permissions/access";
import { shemeshProfile } from "@/lib/shemesh/actor";
import { isMissingRelation, shemeshAdmin } from "@/lib/shemesh/db";
import { buildDashboard } from "@/lib/shemesh/dashboard-model";
import { loadShemeshDashboard } from "@/lib/shemesh/dashboard-load";
import { buildShemeshReportPack } from "@/lib/shemesh/report-pack";

export const dynamic = "force-dynamic";

const TABLES: Record<string, string> = {
  cases: "shemesh_cases",
  ledger: "shemesh_ledger",
  rules: "shemesh_rules",
};

export async function GET(request: Request) {
  const profile = await shemeshProfile();
  if (!profile || !canViewShemesh(profile)) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 401 });
  }
  const kind = new URL(request.url).searchParams.get("kind") ?? "";
  if (kind === "dashboard") {
    try {
      const url = new URL(request.url);
      const loaded = await loadShemeshDashboard();
      const from = url.searchParams.get("from") ?? "";
      const to = url.searchParams.get("to") ?? "";
      const source = url.searchParams.get("source") ?? "all";
      const range = /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)
        ? { from, to }
        : { from: `${loaded.input.today.slice(0, 7)}-01`, to: loaded.input.today };
      const view = buildDashboard(loaded.input, range, source);
      const book = XLSX.utils.book_new();
      const add = (name: string, rows: Record<string, string | number | null>[]) => {
        XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows.length ? rows : [{ הערה: "אין שורות" }]), name.slice(0, 31));
      };
      add("מדדים", [
        { מדד: "נמכר", ערך: view.sold, מקור: "דוח מכירות שמש" },
        { מדד: "נגבה", ערך: view.collected, מקור: "דוח מכירות שמש" },
        { מדד: "פתוח לגבייה", ערך: view.openToCollect, מקור: "דוח מכירות שמש" },
        { מדד: "תיקים פעילים", ערך: view.activeCases, מקור: "תיקים" },
        { מדד: "חריגות SLA", ערך: view.slaBreaches, מקור: "תיקים" },
        { מדד: "שכר טרחה פתוח", ערך: view.openFeeKnown, מקור: view.feesPending ? "ממתין לאימות" : "ספר" },
      ]);
      add("משפך", view.funnel.map((stage) => ({ שלב: stage.label, תיקים: stage.count, "מעבר %": stage.conversion, "ימים מאז פתיחה": stage.avgDays })));
      add("צוות", view.team.map((row) => ({ מטפל: row.handler, תיקים: row.cases, חריגות: row.sla })));
      add("גבייה", view.trend.map((row) => ({ חודש: row.month, נגבה: row.collected })));
      const body = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
      return new NextResponse(new Uint8Array(body), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="shemesh-dashboard.xlsx"',
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "ייצוא הלוח נכשל";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
  if (kind === "pack") {
    try {
      const sheets = await buildShemeshReportPack();
      const book = XLSX.utils.book_new();
      for (const sheet of sheets) {
        XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(sheet.rows), sheet.name.slice(0, 31));
      }
      const body = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
      return new NextResponse(new Uint8Array(body), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="shemesh-report-pack.xlsx"',
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "החבילה נכשלה";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
  const [tableKey, filter] = kind.split(":");
  const table = TABLES[tableKey];
  if (!table) return NextResponse.json({ error: "סוג לא מוכר" }, { status: 400 });
  try {
    const admin = shemeshAdmin();
    let query = admin.from(table).select("*").limit(2000);
    if (tableKey === "rules" && filter) query = query.eq("kind", filter);
    if (tableKey === "ledger" && filter) query = query.eq("kind", filter);
    const { data, error } = await query;
    if (error) {
      const status = isMissingRelation(error.message) ? 404 : 500;
      return NextResponse.json({ error: isMissingRelation(error.message) ? "הטבלה עדיין לא הורצה" : error.message }, { status });
    }
    const sheet = XLSX.utils.json_to_sheet(data ?? []);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Shemesh");
    const body = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="shemesh-${tableKey}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "הייצוא נכשל";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
