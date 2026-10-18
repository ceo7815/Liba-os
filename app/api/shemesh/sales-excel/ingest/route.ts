import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { salesUploadTokenMatches } from "@/lib/sales-dashboard/kiosk-auth";
import { ingestShemeshSalesBuffer } from "@/lib/shemesh/sales-workbook-store";

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

async function allowed(request: Request): Promise<boolean> {
  if (salesUploadTokenMatches(ingestToken(request))) return true;
  const profile = await getCurrentProfile();
  return profile?.role === "admin";
}

export async function POST(request: Request) {
  if (!(await allowed(request))) {
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
  try {
    const saved = await ingestShemeshSalesBuffer(buffer, file.name);
    return NextResponse.json({ ok: true, ...saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "לא הצלחנו לקרוא את האקסל";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
