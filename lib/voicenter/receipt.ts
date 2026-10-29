import { createHash } from "node:crypto";
import { CDR_POST_OUTCOMES, type CdrPostOutcome } from "./outcomes";

export { CDR_POST_OUTCOMES, type CdrPostOutcome };

export type ReceiptMeta = {
  token_hash_prefix: string;
  content_type: string | null;
  body_bytes: number;
};

const HASH_PREFIX_LEN = 8;

/** First 8 hex chars of sha256(token). Not a prefix of the token. */
export function tokenHashPrefix(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex").slice(0, HASH_PREFIX_LEN);
}

export function buildReceiptMeta(input: {
  token: string;
  contentType: string | null;
  bodyText: string;
}): ReceiptMeta {
  let contentType = (input.contentType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (input.token && contentType.includes(input.token)) contentType = "";
  if (contentType.length > 80) contentType = contentType.slice(0, 80);
  return {
    token_hash_prefix: tokenHashPrefix(input.token),
    content_type: contentType || null,
    body_bytes: Buffer.byteLength(input.bodyText, "utf8"),
  };
}

export function postOutcome(counts: { stored: number; recognized: number }): CdrPostOutcome {
  if (counts.stored > 0) return "stored";
  if (counts.recognized > 0) return "other_extension";
  return "bad_json";
}

/** Body Voicenter treats as a successful CDR push. `status` is kept for our own logs. */
export function voicenterAckBody() {
  return { Err: 0, Errdesc: "OK", status: "OK" } as const;
}

export type CdrOutcomeTimes = Record<CdrPostOutcome, string | null>;

export function emptyOutcomeTimes(): CdrOutcomeTimes {
  return {
    unauthorized: null,
    bad_json: null,
    other_extension: null,
    stored: null,
  };
}

/** Latest received_at for each known outcome. Rows may arrive in any order. */
export function latestReceiptByOutcome(
  rows: Array<{ outcome?: string | null; received_at?: string | null }>,
): CdrOutcomeTimes {
  const latest = emptyOutcomeTimes();
  for (const row of rows) {
    const outcome = row.outcome;
    const receivedAt = row.received_at;
    if (!outcome || !receivedAt) continue;
    if (!CDR_POST_OUTCOMES.includes(outcome as CdrPostOutcome)) continue;
    const key = outcome as CdrPostOutcome;
    const prev = latest[key];
    if (!prev || Date.parse(receivedAt) > Date.parse(prev)) latest[key] = receivedAt;
  }
  return latest;
}
