"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateAgentApiKey, hashAgentApiKey } from "@/lib/agents/api-key";
import { getAgentBySlug } from "@/lib/agents.config";

export type AgentKeyMeta = {
  id: string;
  label: string | null;
  created_at: string;
  revoked_at: string | null;
};

export type CreateAgentKeyResult =
  | {
      error: null;
      apiKey: string;
      keyId: string;
      agentId: string;
    }
  | { error: string; apiKey?: undefined };

async function ensureAgentRow(slug: string) {
  const admin = createAdminClient();
  const config = getAgentBySlug(slug);

  const { data: existing } = await admin
    .from("agents")
    .select("id, slug, name, status")
    .eq("slug", slug)
    .maybeSingle();

  if (existing) return existing;

  if (!config) {
    throw new Error("Agent not found in registry");
  }

  const { data, error } = await admin
    .from("agents")
    .insert({
      slug: config.slug,
      name: config.name,
      description: config.description,
      status: "active",
      hermes_profile: config.slug === "call-control" ? "call-qa" : config.slug,
    })
    .select("id, slug, name, status")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create agent row");
  }

  return data;
}

export async function listAgentApiKeys(slug: string): Promise<{
  error: string | null;
  keys: AgentKeyMeta[];
}> {
  await requireAdmin();
  try {
    const agent = await ensureAgentRow(slug);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("agent_api_keys")
      .select("id, label, created_at, revoked_at")
      .eq("agent_id", agent.id)
      .order("created_at", { ascending: false });

    if (error) {
      return { error: error.message, keys: [] };
    }

    return { error: null, keys: (data ?? []) as AgentKeyMeta[] };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to list keys",
      keys: [],
    };
  }
}

export async function createAgentApiKey(
  slug: string,
  label?: string,
): Promise<CreateAgentKeyResult> {
  await requireAdmin();

  try {
    const agent = await ensureAgentRow(slug);
    const rawKey = generateAgentApiKey();
    const keyHash = hashAgentApiKey(rawKey);
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("agent_api_keys")
      .insert({
        agent_id: agent.id,
        key_hash: keyHash,
        label: label?.trim() || "סוכן בקרת שיחות",
      })
      .select("id")
      .single();

    if (error || !data) {
      return { error: error?.message ?? "יצירת המפתח נכשלה" };
    }

    revalidatePath(`/agents/${slug}`);
    return {
      error: null,
      apiKey: rawKey,
      keyId: data.id,
      agentId: agent.id,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "יצירת המפתח נכשלה",
    };
  }
}

export async function revokeAgentApiKey(slug: string, keyId: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const agent = await ensureAgentRow(slug);

  const { error } = await admin
    .from("agent_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("agent_id", agent.id)
    .is("revoked_at", null);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/agents/${slug}`);
  return { error: null };
}

export type QueueAnalysisResult =
  | {
      error: null;
      alreadyQueued: boolean;
      runId: string;
      status: string;
      message: string;
    }
  | { error: string };

/**
 * Admin-only: enqueue a Drive analysis job for Hermes (no Drive/STT in OS).
 */
export async function requestCallAnalysis(
  slug: string,
): Promise<QueueAnalysisResult> {
  const profile = await requireAdmin();

  try {
    const agent = await ensureAgentRow(slug);
    const admin = createAdminClient();

    const { data: active } = await admin
      .from("agent_runs")
      .select("id, status, started_at")
      .eq("agent_id", agent.id)
      .in("status", ["queued", "claimed", "running"])
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (active) {
      return {
        error: null,
        alreadyQueued: true,
        runId: active.id,
        status: active.status,
        message:
          active.status === "running"
            ? "כבר רץ — ממתין לסיום ההרצה הנוכחית"
            : "כבר בתור — הסוכן ימשוך את העבודה ב־poll",
      };
    }

    const { data, error } = await admin
      .from("agent_runs")
      .insert({
        agent_id: agent.id,
        trigger: "manual",
        status: "queued",
        metadata: {
          source: "drive",
          requested_by: profile.id,
        },
      })
      .select("id, status, started_at")
      .single();

    if (error || !data) {
      return { error: error?.message ?? "יצירת תור העבודה נכשלה" };
    }

    await admin
      .from("agents")
      .update({
        last_run_at: data.started_at,
        last_run_status: "queued",
      })
      .eq("id", agent.id);

    revalidatePath(`/agents/${slug}`);
    return {
      error: null,
      alreadyQueued: false,
      runId: data.id,
      status: data.status,
      message: "נוסף לתור — ממתין לסוכן בקרת שיחות",
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "יצירת תור העבודה נכשלה",
    };
  }
}

/**
 * Admin-only: hard-delete a call + cascaded transcript/analysis rows.
 * Enables a clean re-ingest of the same Drive file (external_id).
 */
export async function deleteCall(
  slug: string,
  callId: string,
): Promise<{ error: string | null }> {
  await requireAdmin();

  if (!callId?.trim()) {
    return { error: "חסר מזהה שיחה" };
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("calls")
      .delete()
      .eq("id", callId)
      .select("id")
      .maybeSingle();

    if (error) {
      return { error: error.message };
    }
    if (!data) {
      return { error: "השיחה לא נמצאה או כבר נמחקה" };
    }

    revalidatePath(`/agents/${slug}`);
    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "מחיקת השיחה נכשלה",
    };
  }
}

export type CallReportDetail = {
  analysis: {
    overall_score: number | string | null;
    summary: string | null;
    recommendations: string[] | null;
    rubric_scores: unknown;
    findings: unknown;
    model: string | null;
  } | null;
  transcript: {
    full_text: string | null;
    segments: unknown;
    provider: string | null;
    language: string | null;
  } | null;
};

/** Lazy-load heavy report fields only when a call is opened. */
export async function getCallReportDetail(
  callId: string,
): Promise<{ error: string | null; detail: CallReportDetail | null }> {
  await requireProfile();

  if (!callId?.trim()) {
    return { error: "חסר מזהה שיחה", detail: null };
  }

  const supabase = createClient();

  const [analysisRes, transcriptRes] = await Promise.all([
    supabase
      .from("call_analyses")
      .select(
        "overall_score, summary, recommendations, rubric_scores, findings, model, created_at",
      )
      .eq("call_id", callId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("call_transcripts")
      .select("full_text, segments, provider, language, created_at")
      .eq("call_id", callId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (analysisRes.error) {
    return { error: analysisRes.error.message, detail: null };
  }
  if (transcriptRes.error) {
    return { error: transcriptRes.error.message, detail: null };
  }

  const a = analysisRes.data;
  const t = transcriptRes.data;

  return {
    error: null,
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
      transcript: t
        ? {
            full_text: t.full_text ?? null,
            segments: t.segments ?? null,
            provider: t.provider ?? null,
            language: t.language ?? null,
          }
        : null,
    },
  };
}
