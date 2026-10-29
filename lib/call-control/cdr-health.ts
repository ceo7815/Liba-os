import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CDR_POST_OUTCOMES,
  emptyOutcomeTimes,
  latestReceiptByOutcome,
  type CdrOutcomeTimes,
} from "@/lib/voicenter/receipt";

export const CDR_QUIET_MS = 24 * 60 * 60 * 1000;

export type { CdrOutcomeTimes };

export type VoicenterCdrHealth = {
  lastReceivedAt: string | null;
  stale: boolean;
  lastStage: string | null;
  lastByOutcome: CdrOutcomeTimes;
};

export { emptyOutcomeTimes, latestReceiptByOutcome };

export function cdrHealthFromReceipt(
  receivedAt: string | null | undefined,
  now = Date.now(),
  lastByOutcome: CdrOutcomeTimes = emptyOutcomeTimes(),
  lastStage: string | null = null,
): VoicenterCdrHealth {
  const base = { lastByOutcome, lastStage };
  if (!receivedAt) return { ...base, lastReceivedAt: null, stale: true };
  const time = Date.parse(receivedAt);
  if (!Number.isFinite(time)) return { ...base, lastReceivedAt: null, stale: true };
  return {
    ...base,
    lastReceivedAt: new Date(time).toISOString(),
    stale: now - time > CDR_QUIET_MS,
  };
}

export async function loadVoicenterCdrHealth(
  admin: SupabaseClient,
): Promise<VoicenterCdrHealth> {
  const empty = cdrHealthFromReceipt(null);
  const [latest, ...byOutcome] = await Promise.all([
    admin
      .from("voicenter_cdr_receipts")
      .select("received_at, stage")
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    ...CDR_POST_OUTCOMES.map((outcome) =>
      admin
        .from("voicenter_cdr_receipts")
        .select("outcome, received_at")
        .eq("outcome", outcome)
        .order("received_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ),
  ]);
  if (latest.error) {
    if (/does not exist|schema cache|could not find the table/i.test(latest.error.message)) {
      return empty;
    }
    console.error("[voicenter] cdr health failed", latest.error.message);
    return empty;
  }
  const rows = byOutcome.flatMap((result) => (result.data ? [result.data] : []));
  const receivedAt =
    latest.data && typeof latest.data.received_at === "string"
      ? latest.data.received_at
      : null;
  const lastStage =
    latest.data && typeof latest.data.stage === "string" ? latest.data.stage : null;
  return cdrHealthFromReceipt(receivedAt, Date.now(), latestReceiptByOutcome(rows), lastStage);
}
