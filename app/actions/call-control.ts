"use server";

import { requirePermission } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isSophiaAgent,
  toCallControlRow,
  type CallControlRow,
} from "@/lib/call-control/view";
import type { CallReportDetail } from "@/app/actions/agents";
import type { ReportedTool } from "@/lib/call-control/management";

export type CallControlManagement = {
  hermesStatus: string | null;
  hermesLastSeenAt: string | null;
  tools: ReportedTool[];
};

export type CallControlListResult = {
  error: string | null;
  rows: CallControlRow[];
};

export async function listCallControlCalls(): Promise<CallControlListResult> {
  await requirePermission("agents.view");
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("calls")
    .select(
      "id, external_id, source, status, call_date, duration_sec, audio_path, metadata, call_analyses(overall_score, findings, rubric_scores, created_at)",
    )
    .eq("source", "voicenter")
    .order("call_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return { error: error.message, rows: [] };
  }

  const rows = (data ?? [])
    .map((row) => {
      const analyses = Array.isArray(row.call_analyses)
        ? [...row.call_analyses].sort((a, b) => {
            const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
            const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
            return tb - ta;
          })
        : [];
      const latest = analyses[0] ?? null;
      return toCallControlRow({
        id: row.id,
        external_id: row.external_id,
        source: row.source,
        status: row.status,
        call_date: row.call_date,
        duration_sec: row.duration_sec,
        audio_path: row.audio_path,
        metadata: row.metadata,
        overall_score: latest?.overall_score ?? null,
        findings: latest?.findings ?? null,
        rubric_scores: latest?.rubric_scores ?? null,
      });
    })
    .filter((row) => isSophiaAgent(row.agentName));

  return { error: null, rows };
}

export async function getCallControlCard(callId: string): Promise<{
  error: string | null;
  row: CallControlRow | null;
  detail: CallReportDetail | null;
}> {
  await requirePermission("agents.view");
  if (!callId?.trim()) {
    return { error: "חסר מזהה שיחה", row: null, detail: null };
  }

  const admin = createAdminClient();
  const [callRes, analysisRes, transcriptRes] = await Promise.all([
    admin
      .from("calls")
      .select(
        "id, external_id, source, status, call_date, duration_sec, audio_path, metadata",
      )
      .eq("id", callId)
      .maybeSingle(),
    admin
      .from("call_analyses")
      .select(
        "overall_score, summary, recommendations, rubric_scores, findings, model, created_at",
      )
      .eq("call_id", callId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("call_transcripts")
      .select("full_text, segments, provider, language")
      .eq("call_id", callId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (callRes.error) {
    return { error: callRes.error.message, row: null, detail: null };
  }
  if (!callRes.data) {
    return { error: "השיחה לא נמצאה", row: null, detail: null };
  }

  const a = analysisRes.data;
  const row = toCallControlRow({
    ...callRes.data,
    overall_score: a?.overall_score ?? null,
    findings: a?.findings ?? null,
    rubric_scores: a?.rubric_scores ?? null,
  });

  if (row.source !== "voicenter" || !isSophiaAgent(row.agentName)) {
    return { error: "השיחה לא שייכת לבקרת שיקוף/רגולציה", row: null, detail: null };
  }

  return {
    error: null,
    row,
    detail: {
      analysis: a
        ? {
            overall_score: a.overall_score,
            summary: a.summary,
            recommendations: a.recommendations,
            rubric_scores: a.rubric_scores,
            findings: a.findings,
            model: a.model ?? null,
          }
        : null,
      transcript: transcriptRes.data
        ? {
            full_text: transcriptRes.data.full_text ?? null,
            segments: transcriptRes.data.segments ?? null,
            provider: transcriptRes.data.provider ?? null,
            language: transcriptRes.data.language ?? null,
          }
        : null,
    },
  };
}

export async function getCallControlManagement(): Promise<{
  error: string | null;
  data: CallControlManagement;
}> {
  await requirePermission("agents.view");
  const empty: CallControlManagement = {
    hermesStatus: null,
    hermesLastSeenAt: null,
    tools: [],
  };
  const admin = createAdminClient();
  const { data: agent, error: agentError } = await admin
    .from("agents")
    .select("id, hermes_status, hermes_last_seen_at")
    .eq("slug", "call-control")
    .maybeSingle();

  if (agentError) {
    return { error: agentError.message, data: empty };
  }
  if (!agent) {
    return { error: null, data: empty };
  }

  const { data: tools, error: toolsError } = await admin
    .from("agent_tools")
    .select("tool_name, tool_type, status, last_checked_at")
    .eq("agent_id", agent.id)
    .order("tool_name");

  if (toolsError) {
    return { error: toolsError.message, data: empty };
  }

  return {
    error: null,
    data: {
      hermesStatus: agent.hermes_status ?? null,
      hermesLastSeenAt: agent.hermes_last_seen_at ?? null,
      tools: (tools ?? []) as ReportedTool[],
    },
  };
}
