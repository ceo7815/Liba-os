import { callStage, listCdrRecords, parseCdr, type CallStage, type CdrRecord } from "./cdr";
import {
  buildReceiptMeta,
  postOutcome,
  voicenterAckBody,
  type CdrPostOutcome,
  type ReceiptMeta,
} from "./receipt";

export type CdrReceiptInsert = ReceiptMeta & {
  outcome: CdrPostOutcome;
  callId: string | null;
  sofia: boolean;
  stored: boolean;
  transcript: boolean;
  stage: CallStage | null;
};

export type CdrReceiptPatch = {
  outcome: CdrPostOutcome;
  callId: string | null;
  sofia: boolean;
  stored: boolean;
  transcript: boolean;
  stage: CallStage | null;
};

export type VoicenterWebhookDeps = {
  token: string;
  contentType: string | null;
  bodyText: string;
  authorize: (token: string) => Promise<boolean>;
  insertReceipt: (row: CdrReceiptInsert) => Promise<string | null>;
  updateReceipt: (id: string, patch: CdrReceiptPatch) => Promise<void>;
  ingest: (cdr: CdrRecord) => Promise<{ callId: string; stored: boolean; transcript: boolean }>;
};

function parsePayloadText(contentType: string | null, text: string): unknown {
  const type = contentType ?? "";
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

/**
 * Every POST is recorded before auth and before the Sofia extension filter.
 * The insert carries a hash prefix, content-type, and size — never the token.
 */
export async function handleVoicenterPost(
  deps: VoicenterWebhookDeps,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const meta = buildReceiptMeta({
    token: deps.token,
    contentType: deps.contentType,
    bodyText: deps.bodyText,
  });
  let receiptId: string | null = null;
  try {
    receiptId = await deps.insertReceipt({
      ...meta,
      outcome: "unauthorized",
      callId: null,
      sofia: false,
      stored: false,
      transcript: false,
      stage: null,
    });
  } catch (err) {
    console.error(
      "voicenter receipt",
      err instanceof Error ? err.message : "insert failed",
    );
  }

  const mark = async (patch: CdrReceiptPatch) => {
    if (!receiptId) return;
    try {
      await deps.updateReceipt(receiptId, patch);
    } catch (err) {
      console.error(
        "voicenter receipt",
        err instanceof Error ? err.message : "update failed",
      );
    }
  };

  let allowed = false;
  try {
    allowed = await deps.authorize(deps.token);
  } catch {
    return { status: 500, body: { status: "ERROR" } };
  }
  if (!allowed) return { status: 401, body: { status: "ERROR" } };

  let payload: unknown;
  try {
    payload = parsePayloadText(deps.contentType, deps.bodyText);
  } catch {
    await mark({
      outcome: "bad_json",
      callId: null,
      sofia: false,
      stored: false,
      transcript: false,
      stage: null,
    });
    return { status: 400, body: { status: "ERROR", message: "expected JSON" } };
  }

  const records = listCdrRecords(payload);
  if (records.length === 0) {
    await mark({
      outcome: "bad_json",
      callId: null,
      sofia: false,
      stored: false,
      transcript: false,
      stage: null,
    });
    return { status: 400, body: { status: "ERROR", message: "expected JSON" } };
  }

  let stored = 0;
  let recognized = 0;
  let failed = 0;
  let sofia = false;
  let transcript = false;
  let callId: string | null = null;
  let stage: CallStage | null = null;
  const rank: Record<CallStage, number> = { ring: 1, answer: 2, hangup: 3 };

  for (const cdr of records) {
    const parsed = parseCdr(cdr);
    const nextStage = parsed?.stage ?? callStage(cdr);
    if (nextStage && (!stage || rank[nextStage] >= rank[stage])) stage = nextStage;
    if (!parsed) continue;
    recognized += 1;
    if (parsed.sofia) sofia = true;
    try {
      const result = await deps.ingest(cdr);
      if (!callId) callId = result.callId;
      if (result.stored) {
        stored += 1;
        if (result.transcript) transcript = true;
      }
    } catch (err) {
      failed += 1;
      console.error(
        "voicenter cdr failed",
        err instanceof Error ? err.message : "ingest failed",
      );
    }
  }

  const outcome = postOutcome({ stored, recognized });
  await mark({
    outcome,
    callId,
    sofia,
    stored: stored > 0,
    transcript,
    stage,
  });

  console.info(
    "voicenter cdr",
    JSON.stringify({ received: records.length, stored, failed, outcome, stage }),
  );

  // Ring and answer are valid pushes with no recording yet. Never answer them with 4xx.
  if (stage === "ring" || stage === "answer") {
    return { status: 200, body: { ...voicenterAckBody() } };
  }
  if (failed > 0 && stored === 0) {
    return { status: 500, body: { status: "ERROR" } };
  }
  if (recognized === 0 && stage !== "hangup") {
    return { status: 400, body: { status: "ERROR", message: "expected JSON" } };
  }
  return { status: 200, body: { ...voicenterAckBody() } };
}
