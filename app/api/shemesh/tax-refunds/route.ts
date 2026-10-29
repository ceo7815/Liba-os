import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { saveTaxRefundUpload } from "@/lib/shemesh/tax-refunds-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 401 });
  }
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "חסר קובץ" }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "הקובץ גדול מ־8MB" }, { status: 400 });
  }
  const name = file.name.toLowerCase();
  if (!name.endsWith(".xlsx") && !name.endsWith(".xls") && !name.endsWith(".csv")) {
    return NextResponse.json({ error: "אפשר להעלות xlsx או csv" }, { status: 400 });
  }
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const saved = await saveTaxRefundUpload(buffer, file.name);
    const rows = saved.sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0);
    return NextResponse.json({ ok: true, fileName: saved.fileName, rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ההעלאה נכשלה";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
