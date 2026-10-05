import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashAgentApiKey } from "@/lib/agents/api-key";
import { parseCdrBody } from "@/lib/voicenter/cdr";
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

  const cdr = parseCdrBody(payload);
  if (!cdr) return json({ status: "ERROR", message: "expected JSON" }, 400);

  try {
    const result = await ingestVoicenterCdr(createAdminClient(), cdr);
    console.info(
      "voicenter cdr",
      JSON.stringify({
        stored: result.stored,
        transcript: result.transcript,
      }),
    );
    return json({ status: "OK" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ingest failed";
    console.error("voicenter cdr failed", message);
    return json({ status: "ERROR" }, 500);
  }
}
