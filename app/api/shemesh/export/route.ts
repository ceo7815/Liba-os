import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { canViewShemesh } from "@/lib/permissions/access";
import { shemeshProfile } from "@/lib/shemesh/actor";
import { isMissingRelation, shemeshAdmin } from "@/lib/shemesh/db";
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
