import { NextResponse } from "next/server";
import {
  authorizeSalesDashboardRequest,
  salesUploadTokenMatches,
} from "@/lib/sales-dashboard/kiosk-auth";
import { saveIngestedWorkbook } from "@/lib/sales-dashboard/ingest-store";
import { parseSalesWorkbook } from "@/lib/sales-dashboard/parse";
import { replaceSalesDashboardSnapshot } from "@/lib/sales-dashboard/snapshot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 20 * 1024 * 1024;

function ingestToken(request: Request): string | null {
  const url = new URL(request.url);
  return (
    request.headers.get("x-sales-excel-token") ??
    request.headers.get("x-sales-tv-token") ??
    url.searchParams.get("token")
  );
}

export async function POST(request: Request) {
  const token = ingestToken(request);
  const allowed =
    salesUploadTokenMatches(token) ||
    (await authorizeSalesDashboardRequest(request));
  if (!allowed) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "חסר קובץ אקסל" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "הקובץ גדול מדי" }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let parsed;
  try {
    parsed = parseSalesWorkbook(buffer, file.name);
  } catch {
    return NextResponse.json({ error: "לא הצלחנו לקרוא את האקסל" }, { status: 400 });
  }

  try {
    await saveIngestedWorkbook(buffer, file.name);
  } catch (err) {
    const message = err instanceof Error ? err.message : "שמירת הקובץ נכשלה";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  replaceSalesDashboardSnapshot(parsed);
  return NextResponse.json({
    ok: true,
    fileName: parsed.fileName,
    syncedAt: parsed.syncedAt,
    active: parsed.active,
  });
}
