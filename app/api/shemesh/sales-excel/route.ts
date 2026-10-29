import { existsSync, readFileSync } from "node:fs";
import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { downloadDriveItem } from "@/lib/shemesh/graph-download";
import { shemeshExcelLocalPath } from "@/lib/shemesh/sales-excel-path";
import {
  chooseShemeshExcelRead,
  SHEMESH_EXCEL_STORED_COPY_WARNING,
} from "@/lib/shemesh/sales-excel-source";
import { ingestShemeshSalesBuffer, loadShemeshSalesWorkbook } from "@/lib/shemesh/sales-workbook-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" };

async function requireAdmin(): Promise<NextResponse | null> {
  const profile = await getCurrentProfile();
  if (profile?.role === "admin") return null;
  return NextResponse.json({ error: "אין הרשאה" }, { status: 401 });
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const workbook = await loadShemeshSalesWorkbook().catch(() => null);
  return NextResponse.json(
    workbook ?? { fileName: null, sheets: [], syncedAt: null, stored: false },
    { headers: NO_STORE },
  );
}

/** Re-read the Shemesh file from this computer, or from its own Graph item. Does not touch Liba's sales workbook. */
export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const path = shemeshExcelLocalPath();
  const stored = await loadShemeshSalesWorkbook().catch(() => null);
  const source = chooseShemeshExcelRead({
    localFileExists: Boolean(path) && existsSync(path),
    driveId: process.env.SHEMESH_EXCEL_DRIVE_ID,
    itemId: process.env.SHEMESH_EXCEL_ITEM_ID,
    hasStoredWorkbook: Boolean(stored?.sheets.length),
  });

  try {
    if (source.kind === "local") {
      const buffer = readFileSync(path);
      const fileName = path.split(/[/\\]/).pop() || "shemesh-sales.xlsx";
      const saved = await ingestShemeshSalesBuffer(buffer, fileName);
      return NextResponse.json({ ok: true, skipped: false, ...saved }, { headers: NO_STORE });
    }
    if (source.kind === "graph") {
      const file = await downloadDriveItem(source.driveId, source.itemId);
      const saved = await ingestShemeshSalesBuffer(Buffer.from(file.buffer), file.fileName);
      return NextResponse.json({ ok: true, skipped: false, ...saved }, { headers: NO_STORE });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "סנכרון האקסל נכשל";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (source.kind === "stored") {
    return NextResponse.json(
      {
        ok: true,
        skipped: true,
        warning: SHEMESH_EXCEL_STORED_COPY_WARNING,
        fileName: stored?.fileName ?? null,
        syncedAt: stored?.syncedAt ?? null,
        rowCount: stored?.sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0) ?? 0,
      },
      { headers: NO_STORE },
    );
  }
  return NextResponse.json({ error: "הקובץ של שמש לא נמצא במחשב הזה" }, { status: 404 });
}
