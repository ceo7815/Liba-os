import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { hashAgentApiKey } from "@/lib/agents/api-key";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestVoicenterCdr } from "@/lib/voicenter/ingest";
import type { CdrReceiptInsert, CdrReceiptPatch } from "@/lib/voicenter/webhook";
import { handleVoicenterPost } from "@/lib/voicenter/webhook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

function tokenOk(presented: string, expectedSha256Hex: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(expectedSha256Hex)) return false;
  const actual = createHash("sha256").update(presented, "utf8").digest();
  const expected = Buffer.from(expectedSha256Hex, "hex");
  return timingSafeEqual(actual, expected);
}

async function authorized(token: string): Promise<boolean> {
  if (token.length < 16 || token.length > 200) return false;
  const envToken = process.env.VOICENTER_CDR_TOKEN?.trim();
  if (envToken && tokenOk(token, hashAgentApiKey(envToken))) return true;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("voicenter_cdr_webhook")
    .select("token_sha256")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data?.token_sha256) return false;
  return tokenOk(token, data.token_sha256);
}

function missingTable(message: string): boolean {
  return /does not exist|schema cache|could not find the table/i.test(message);
}

async function insertReceipt(row: CdrReceiptInsert): Promise<string | null> {
  const admin = createAdminClient();
  const full = {
    call_id: row.callId,
    sofia: row.sofia,
    stored: row.stored,
    has_transcript: row.transcript,
    outcome: row.outcome,
    token_hash_prefix: row.token_hash_prefix,
    content_type: row.content_type,
    body_bytes: row.body_bytes,
    stage: row.stage,
  };
  const inserted = await admin.from("voicenter_cdr_receipts").insert(full).select("id").maybeSingle();
  if (!inserted.error && inserted.data?.id) return String(inserted.data.id);
  const message = inserted.error?.message ?? "";
  if (missingTable(message)) return null;
  if (/token_hash_prefix|content_type|body_bytes|stage/i.test(message)) {
    const legacy = await admin
      .from("voicenter_cdr_receipts")
      .insert({
        call_id: row.callId,
        sofia: row.sofia,
        stored: row.stored,
        has_transcript: row.transcript,
        outcome: row.outcome,
      })
      .select("id")
      .maybeSingle();
    if (legacy.error && !missingTable(legacy.error.message)) {
      console.error("voicenter receipt", legacy.error.message);
    }
    return legacy.data?.id ? String(legacy.data.id) : null;
  }
  console.error("voicenter receipt", message);
  return null;
}

async function updateReceipt(id: string, patch: CdrReceiptPatch): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("voicenter_cdr_receipts")
    .update({
      outcome: patch.outcome,
      call_id: patch.callId,
      sofia: patch.sofia,
      stored: patch.stored,
      has_transcript: patch.transcript,
      stage: patch.stage,
    })
    .eq("id", id);
  if (error && !missingTable(error.message)) {
    console.error("voicenter receipt", error.message);
  }
}

export async function POST(
  request: Request,
  { params }: { params: { token: string } },
) {
  const token = params.token ?? "";
  const bodyText = await request.text();
  const result = await handleVoicenterPost({
    token,
    contentType: request.headers.get("content-type"),
    bodyText,
    authorize: authorized,
    insertReceipt,
    updateReceipt,
    ingest: (cdr) => ingestVoicenterCdr(createAdminClient(), cdr),
  });
  return json(result.body, result.status);
}
