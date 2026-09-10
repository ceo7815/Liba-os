import { NextResponse } from "next/server";
import { ingestCallRecordingFile } from "@/app/actions/agents";
import { getCurrentProfile } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Multipart upload for call-control recordings.
 * Uses the same FormData path as sales-dashboard ingest (works behind xCloud Nginx),
 * then stores via service-role to Supabase Storage.
 */
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !hasPermission(profile, "agents.manage")) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "גוף הבקשה אינו תקין — הקובץ גדול מדי לשרת או נקטע" },
      { status: 413 },
    );
  }

  const slug = String(form.get("slug") || "call-control");
  const result = await ingestCallRecordingFile(slug, form, profile.id);
  if (result.error !== null) {
    const status = /גדול/i.test(result.error) ? 413 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    callId: result.callId,
    runId: result.runId,
    status: result.status,
    waiting: result.waiting ?? false,
    message: result.message,
  });
}
