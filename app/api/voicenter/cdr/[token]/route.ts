import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashAgentApiKey } from "@/lib/agents/api-key";
import { listCdrRecords, parseCdr } from "@/lib/voicenter/cdr";
import { ingestVoicenterCdr } from "@/lib/voicenter/ingest";

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

async function readPayload(request: Request): Promise<unknown> {
  const type = request.headers.get("content-type") ?? "";
  const text = await request.text();
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (
    type.includes("application/json") ||
    trimmed.startsWith("{") ||
    trimmed.startsWith("[")
  ) {
    return JSON.parse(trimmed);
  }
  if (type.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(trimmed);
    const blob = params.get("json") ?? params.get("data") ?? params.get("cdr");
    if (blob) return JSON.parse(blob);
    const record: Record<string, string> = {};
    params.forEach((value, key) => {
      record[key] = value;
    });
    return record;
  }
  return JSON.parse(trimmed);
}

export async function POST(
  request: Request,
  { params }: { params: { token: string } },
) {
  const token = params.token ?? "";
  let allowed = false;
  try {
    allowed = await authorized(token);
  } catch {
    return json({ status: "ERROR" }, 500);
  }
  if (!allowed) return json({ status: "ERROR" }, 401);

  let payload: unknown;
  try {
    payload = await readPayload(request);
  } catch {
    return json({ status: "ERROR", message: "expected JSON" }, 400);
  }

  const records = listCdrRecords(payload);
  if (records.length === 0) return json({ status: "ERROR", message: "expected JSON" }, 400);

  const admin = createAdminClient();
  let stored = 0;
  let errors = 0;
  for (const cdr of records) {
    const parsed = parseCdr(cdr);
    try {
      if (!parsed) {
        await rememberReceipt(admin, { callId: null, sofia: false, stored: false, transcript: false, outcome: "missing_call_id" });
        continue;
      }
      const result = await ingestVoicenterCdr(admin, cdr);
      if (result.stored) stored += 1;
      await rememberReceipt(admin, {
        callId: result.callId,
        sofia: parsed.sofia,
        stored: result.stored,
        transcript: result.transcript,
        outcome: result.stored ? "stored" : "other_extension",
      });
    } catch (err) {
      errors += 1;
      const message = err instanceof Error ? err.message : "ingest failed";
      console.error("voicenter cdr failed", message);
      await rememberReceipt(admin, {
        callId: parsed?.callId ?? null,
        sofia: parsed?.sofia ?? false,
        stored: false,
        transcript: false,
        outcome: "error",
      });
    }
  }

  console.info("voicenter cdr", JSON.stringify({ received: records.length, stored, errors }));
  if (errors > 0 && stored === 0) return json({ status: "ERROR" }, 500);
  return json({ status: "OK" });
}

async function rememberReceipt(
  admin: ReturnType<typeof createAdminClient>,
  row: { callId: string | null; sofia: boolean; stored: boolean; transcript: boolean; outcome: string },
) {
  const { error } = await admin.from("voicenter_cdr_receipts").insert({
    call_id: row.callId,
    sofia: row.sofia,
    stored: row.stored,
    has_transcript: row.transcript,
    outcome: row.outcome,
  });
  if (error && !/does not exist|schema cache|could not find the table/i.test(error.message)) {
    console.error("voicenter receipt", error.message);
  }
}
