import type { SupabaseClient } from "@supabase/supabase-js";
import { executeMcpTool } from "@/lib/mcp/tools";
import type { AuthenticatedAgent } from "@/lib/mcp/auth";
import { parseCdr, SOFIA_EXTENSION, type CdrRecord } from "@/lib/voicenter/cdr";

const BRIDGE_AGENT: AuthenticatedAgent = {
  agentId: "00000000-0000-0000-0000-000000000000",
  agentSlug: "call-control",
  agentName: "voicenter-cdr",
  agentStatus: "active",
  keyId: "voicenter-cdr",
};

export type IngestResult = {
  callId: string;
  stored: boolean;
  transcript: boolean;
  /** True when hangup has a recording or transcript and the call is waiting for call-control. */
  queued: boolean;
};

function callIdFrom(data: unknown): string {
  if (!data || typeof data !== "object") throw new Error("Failed to register call");
  const row = data as { call_id?: unknown; id?: unknown; status?: unknown; skip_analysis?: unknown };
  const id = typeof row.call_id === "string" ? row.call_id : row.id;
  if (typeof id !== "string" || !id) throw new Error("Failed to register call");
  return id;
}

function statusFrom(data: unknown): { status: string; skipAnalysis: boolean } {
  const row =
    data && typeof data === "object"
      ? (data as { status?: unknown; skip_analysis?: unknown })
      : {};
  return {
    status: typeof row.status === "string" ? row.status : "pending",
    skipAnalysis: row.skip_analysis === true,
  };
}

async function setStatus(
  admin: SupabaseClient,
  callId: string,
  status: "pending" | "skipped",
) {
  const result = await executeMcpTool(admin, BRIDGE_AGENT, "calls.set_status", {
    call_id: callId,
    status,
  });
  if (!result.ok) throw new Error(result.error);
}

/** Store one Voicenter CDR. Recording files are not downloaded; RecordURL is enough. */
export async function ingestVoicenterCdr(
  admin: SupabaseClient,
  cdr: CdrRecord,
): Promise<IngestResult> {
  const parsed = parseCdr(cdr);
  if (!parsed) throw new Error("Missing call id");
  if (!parsed.sofia) {
    return { callId: parsed.callId, stored: false, transcript: false, queued: false };
  }

  const metadata: Record<string, unknown> = {
    voicenter_call_id: parsed.callId,
    agent_name: "סופיה",
    rep_name: parsed.representativeName ?? "סופיה",
    extension: SOFIA_EXTENSION,
    received_via: "webhook",
    received_at: new Date().toISOString(),
    voicenter_stage: parsed.stage,
  };
  if (parsed.callerPhone) metadata.caller_phone = parsed.callerPhone;
  if (parsed.recordUrl) metadata.record_url = parsed.recordUrl;
  if (parsed.direction) metadata.direction = parsed.direction;
  if (parsed.callType) metadata.voicenter_type = parsed.callType;
  if (parsed.dialStatus) metadata.voicenter_status = parsed.dialStatus;
  if (parsed.aiSummary) metadata.ai_summary = parsed.aiSummary;
  if (parsed.fullText) metadata.has_ai_transcript = true;

  const registered = await executeMcpTool(admin, BRIDGE_AGENT, "calls.register", {
    external_id: parsed.callId,
    source: "voicenter",
    call_date: parsed.callDate,
    duration_sec: parsed.durationSec,
    audio_path: parsed.recordUrl,
    agent_name: "סופיה",
    metadata,
  });
  if (!registered.ok) throw new Error(registered.error);

  const callId = callIdFrom(registered.data);
  const { status, skipAnalysis } = statusFrom(registered.data);

  const hasTranscript = Boolean(parsed.fullText);
  if (hasTranscript) {
    const saved = await executeMcpTool(admin, BRIDGE_AGENT, "calls.save_transcript", {
      call_id: callId,
      full_text: parsed.fullText,
      segments: parsed.segments,
      provider: "voicenter",
      language: "he",
    });
    if (!saved.ok) throw new Error(saved.error);
  }

  const readyForAgent =
    parsed.stage === "hangup" && Boolean(parsed.recordUrl || parsed.fullText);
  if (readyForAgent && !skipAnalysis && status !== "done" && status !== "processing" && status !== "claimed") {
    if (status !== "pending") await setStatus(admin, callId, "pending");
    return { callId: parsed.callId, stored: true, transcript: hasTranscript, queued: true };
  }

  // Ring and answer only enrich the same ivruniqueid. They must not mark the call skipped
  // before the hangup arrives with the recording or transcript.
  if (parsed.stage === "ring" || parsed.stage === "answer") {
    return { callId: parsed.callId, stored: true, transcript: hasTranscript, queued: false };
  }

  if (!readyForAgent && status === "pending" && !hasTranscript && !parsed.recordUrl) {
    await setStatus(admin, callId, "skipped");
  }
  return { callId: parsed.callId, stored: true, transcript: hasTranscript, queued: false };
}
