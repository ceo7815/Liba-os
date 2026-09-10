"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, requireProfile } from "@/lib/auth";
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
  await requirePermission("agents.manage");
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
  await requirePermission("agents.manage");

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
  await requirePermission("agents.manage");
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
  const profile = await requirePermission("agents.manage");

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
          ingest: "drive",
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

const CALL_RECORDINGS_BUCKET = "call-recordings";
const MAX_RECORDING_BYTES = 500 * 1024 * 1024;
const ALLOWED_RECORDING_MIME = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/webm",
  "audio/ogg",
  "audio/aac",
  "audio/flac",
  "video/mp4",
  "video/webm",
  "application/octet-stream",
]);

function resolveRecordingMime(fileName: string, mimeRaw: string | null | undefined): string {
  const mime = (mimeRaw || "").toLowerCase().trim();
  if (ALLOWED_RECORDING_MIME.has(mime) || mime.startsWith("audio/")) return mime;
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".webm")) return "audio/webm";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".aac")) return "audio/aac";
  if (lower.endsWith(".flac")) return "audio/flac";
  if (lower.endsWith(".mp4")) return "video/mp4";
  return mime || "application/octet-stream";
}

function isAllowedRecordingMime(mime: string, fileName: string): boolean {
  if (ALLOWED_RECORDING_MIME.has(mime) || mime.startsWith("audio/")) return true;
  const lower = fileName.toLowerCase();
  return /\.(mp3|m4a|wav|webm|ogg|aac|flac|mp4)$/i.test(lower);
}

async function ensureCallRecordingsBucket(
  admin: ReturnType<typeof createAdminClient>,
) {
  const { error } = await admin.storage.createBucket(CALL_RECORDINGS_BUCKET, {
    public: false,
    fileSizeLimit: MAX_RECORDING_BYTES,
  });
  if (error && !/already exists|duplicate/i.test(error.message)) {
    throw new Error(error.message);
  }
  const { error: updateError } = await admin.storage.updateBucket(
    CALL_RECORDINGS_BUCKET,
    {
      public: false,
      fileSizeLimit: MAX_RECORDING_BYTES,
    },
  );
  if (updateError && !/not found/i.test(updateError.message)) {
    throw new Error(updateError.message);
  }
}

export type UploadRecordingResult =
  | {
      error: null;
      callId: string;
      runId: string | null;
      status: string | null;
      waiting?: boolean;
      message: string;
    }
  | { error: string };

export type PrepareRecordingUploadResult =
  | {
      error: null;
      callId: string;
      storagePath: string;
      signedUrl: string;
      token: string;
      mime: string;
      fileName: string;
      displayName: string;
      bucket: string;
    }
  | { error: string };

type SignedUploadApi = {
  createSignedUploadUrl: (
    path: string,
  ) => Promise<{
    data: { signedUrl: string; token: string; path: string } | null;
    error: { message: string } | null;
  }>;
};

async function enqueueUploadAnalysis(opts: {
  admin: ReturnType<typeof createAdminClient>;
  agentId: string;
  profileId: string;
  slug: string;
  callId: string;
}): Promise<UploadRecordingResult> {
  const { admin, agentId, profileId, slug, callId } = opts;
  const now = new Date().toISOString();

  const { data: active } = await admin
    .from("agent_runs")
    .select("id, status, metadata, started_at")
    .eq("agent_id", agentId)
    .in("status", ["queued", "claimed", "running"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (active && (active.status === "running" || active.status === "claimed")) {
    const meta =
      active.metadata &&
      typeof active.metadata === "object" &&
      !Array.isArray(active.metadata)
        ? { ...(active.metadata as Record<string, unknown>) }
        : {};
    const existingIds = Array.isArray(meta.call_ids)
      ? meta.call_ids.filter((id): id is string => typeof id === "string")
      : [];
    const waitingIds = [...new Set([...existingIds, callId])];
    await admin
      .from("agent_runs")
      .update({
        metadata: {
          ...meta,
          source: "upload",
          ingest: "pending_calls",
          call_ids: waitingIds,
          waiting_count: waitingIds.length,
        },
      })
      .eq("id", active.id);

    revalidatePath(`/agents/${slug}`);
    return {
      error: null,
      callId,
      runId: active.id,
      status: "running",
      waiting: true,
      message:
        "ההקלטה נכנסה לתור. מסיימים את הניתוח הנוכחי ואז ממשיכים אוטומטית",
    };
  }

  if (active?.status === "queued") {
    await admin
      .from("agent_runs")
      .update({
        status: "cancelled",
        finished_at: now,
        error_message: "replaced by immediate upload analysis",
      })
      .eq("id", active.id);
  }

  const { data: run, error: runError } = await admin
    .from("agent_runs")
    .insert({
      agent_id: agentId,
      trigger: "manual",
      status: "running",
      started_at: now,
      metadata: {
        source: "upload",
        ingest: "pending_calls",
        call_ids: [callId],
        requested_by: profileId,
      },
    })
    .select("id, status, started_at")
    .single();

  if (runError || !run) {
    await admin
      .from("agents")
      .update({ last_run_at: now, last_run_status: "running" })
      .eq("id", agentId);
    revalidatePath(`/agents/${slug}`);
    return {
      error: null,
      callId,
      runId: null,
      status: "running",
      waiting: false,
      message: "ההקלטה מוכנה — הסוכן מתחיל לנתח עכשיו (get_pending)",
    };
  }

  await admin
    .from("agents")
    .update({
      last_run_at: run.started_at,
      last_run_status: "running",
    })
    .eq("id", agentId);

  revalidatePath(`/agents/${slug}`);
  return {
    error: null,
    callId,
    runId: run.id,
    status: "running",
    waiting: false,
    message: "מתחיל ניתוח עכשיו לפי הנחיות הסוכן",
  };
}

/**
 * Step 1: mint a short-lived signed upload URL.
 * Browser uploads the file directly to Supabase (bypasses xCloud Nginx body limits).
 */
export async function prepareCallRecordingUpload(
  slug: string,
  input: {
    fileName: string;
    fileSize: number;
    mimeType?: string | null;
    displayName?: string | null;
  },
): Promise<PrepareRecordingUploadResult> {
  await requirePermission("agents.manage");

  try {
    if (slug !== "call-control") {
      return { error: "העלאת הקלטות זמינה רק לסוכן בקרת שיחות" };
    }
    if (!input.fileName?.trim()) return { error: "לא נבחר קובץ הקלטה" };
    if (!Number.isFinite(input.fileSize) || input.fileSize <= 0) {
      return { error: "קובץ ריק" };
    }
    if (input.fileSize > MAX_RECORDING_BYTES) {
      return { error: "הקובץ גדול מ־500MB" };
    }

    const mime = resolveRecordingMime(input.fileName, input.mimeType);
    if (!isAllowedRecordingMime(mime, input.fileName)) {
      return { error: "מותר קבצי אודיו בלבד (mp3, m4a, wav, webm…)" };
    }

    const displayName =
      typeof input.displayName === "string" && input.displayName.trim()
        ? input.displayName.trim()
        : input.fileName.replace(/\.[^.]+$/, "") || input.fileName;

    const agent = await ensureAgentRow(slug);
    const admin = createAdminClient();
    await ensureCallRecordingsBucket(admin);

    const callId = crypto.randomUUID();
    const safeName = input.fileName.replace(
      /[^\w.\u0590-\u05FF\u00A0-\uFFFF\- ()]/g,
      "_",
    );
    const storagePath = `uploads/${callId}/${Date.now()}-${safeName}`;

    const bucket = admin.storage.from(
      CALL_RECORDINGS_BUCKET,
    ) as unknown as SignedUploadApi;
    const { data, error } = await bucket.createSignedUploadUrl(storagePath);
    if (error || !data?.signedUrl || !data.token) {
      return { error: error?.message ?? "יצירת קישור העלאה נכשלה" };
    }

    // Stale run cleanup (light) so finalize can start immediately.
    const staleBefore = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    await admin
      .from("agent_runs")
      .update({
        status: "cancelled",
        finished_at: new Date().toISOString(),
        error_message: "cleared before upload analysis",
      })
      .eq("agent_id", agent.id)
      .in("status", ["queued", "claimed", "running"])
      .lt("started_at", staleBefore);

    return {
      error: null,
      callId,
      storagePath: data.path || storagePath,
      signedUrl: data.signedUrl,
      token: data.token,
      mime,
      fileName: input.fileName,
      displayName,
      bucket: CALL_RECORDINGS_BUCKET,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "הכנת ההעלאה נכשלה",
    };
  }
}

/**
 * Step 2: after the browser finished uploading to Storage, register the call and start analysis.
 */
export async function finalizeCallRecordingUpload(
  slug: string,
  input: {
    callId: string;
    storagePath: string;
    fileName: string;
    mime: string;
    displayName: string;
  },
): Promise<UploadRecordingResult> {
  const profile = await requirePermission("agents.manage");

  try {
    if (slug !== "call-control") {
      return { error: "העלאת הקלטות זמינה רק לסוכן בקרת שיחות" };
    }
    if (!input.callId || !input.storagePath) {
      return { error: "חסרים פרטי העלאה" };
    }

    const agent = await ensureAgentRow(slug);
    const admin = createAdminClient();

    const { data: signed, error: signError } = await admin.storage
      .from(CALL_RECORDINGS_BUCKET)
      .createSignedUrl(input.storagePath, 60 * 60 * 24 * 7);
    if (signError || !signed?.signedUrl) {
      return {
        error:
          signError?.message ??
          "הקובץ לא נמצא ב־Storage אחרי ההעלאה — נסו שוב",
      };
    }

    const externalId = `upload:${input.callId}`;
    const { error: callError } = await admin.from("calls").insert({
      id: input.callId,
      external_id: externalId,
      source: "upload",
      status: "pending",
      audio_path: signed.signedUrl,
      metadata: {
        display_name: input.displayName,
        file_name: input.fileName,
        storage_bucket: CALL_RECORDINGS_BUCKET,
        storage_path: input.storagePath,
        mime_type: input.mime,
        uploaded_by: profile.id,
        source: "upload",
      },
    });

    if (callError) {
      await admin.storage
        .from(CALL_RECORDINGS_BUCKET)
        .remove([input.storagePath]);
      return { error: callError.message };
    }

    return enqueueUploadAnalysis({
      admin,
      agentId: agent.id,
      profileId: profile.id,
      slug,
      callId: input.callId,
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "סיום ההעלאה נכשל",
    };
  }
}

/**
 * Server-side ingest used by /api/agents/call-control/upload.
 * Uploads via service role (proven path) — same pattern as sales Excel ingest.
 */
export async function ingestCallRecordingFile(
  slug: string,
  formData: FormData,
  profileId: string,
): Promise<UploadRecordingResult> {
  try {
    if (slug !== "call-control") {
      return { error: "העלאת הקלטות זמינה רק לסוכן בקרת שיחות" };
    }

    const raw = formData.get("file");
    if (!(raw instanceof File)) {
      return { error: "לא נבחר קובץ הקלטה" };
    }
    const fileName =
      raw.name ||
      String(formData.get("file_name") || "recording.mp3");
    if (raw.size <= 0) return { error: "קובץ ריק" };
    if (raw.size > MAX_RECORDING_BYTES) {
      return { error: `הקובץ גדול מ־${Math.round(MAX_RECORDING_BYTES / (1024 * 1024))}MB` };
    }

    const mime = resolveRecordingMime(fileName, raw.type);
    if (!isAllowedRecordingMime(mime, fileName)) {
      return { error: "מותר קבצי אודיו בלבד (mp3, m4a, wav, webm…)" };
    }

    const displayNameRaw = formData.get("display_name");
    const displayName =
      typeof displayNameRaw === "string" && displayNameRaw.trim()
        ? displayNameRaw.trim()
        : fileName.replace(/\.[^.]+$/, "") || fileName;

    const agent = await ensureAgentRow(slug);
    const admin = createAdminClient();
    await ensureCallRecordingsBucket(admin);

    const staleBefore = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    await admin
      .from("agent_runs")
      .update({
        status: "cancelled",
        finished_at: new Date().toISOString(),
        error_message: "cleared before upload analysis",
      })
      .eq("agent_id", agent.id)
      .in("status", ["queued", "claimed", "running"])
      .lt("started_at", staleBefore);

    const callId = crypto.randomUUID();
    const extMatch = fileName.toLowerCase().match(/(\.[a-z0-9]{2,5})$/);
    const ext = extMatch?.[1] || ".mp3";
    const storagePath = `uploads/${callId}/audio${ext}`;
    const buffer = Buffer.from(await raw.arrayBuffer());

    const { error: uploadError } = await admin.storage
      .from(CALL_RECORDINGS_BUCKET)
      .upload(storagePath, buffer, {
        contentType: mime || "application/octet-stream",
        upsert: false,
      });
    if (uploadError) {
      return {
        error: `שמירה ב־Storage נכשלה: ${uploadError.message} (${(buffer.length / (1024 * 1024)).toFixed(1)}MB)`,
      };
    }

    const { data: signed, error: signError } = await admin.storage
      .from(CALL_RECORDINGS_BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
    if (signError || !signed?.signedUrl) {
      await admin.storage.from(CALL_RECORDINGS_BUCKET).remove([storagePath]);
      return { error: signError?.message ?? "יצירת קישור להקלטה נכשלה" };
    }

    const { error: callError } = await admin.from("calls").insert({
      id: callId,
      external_id: `upload:${callId}`,
      source: "upload",
      status: "pending",
      audio_path: signed.signedUrl,
      metadata: {
        display_name: displayName,
        file_name: fileName,
        storage_bucket: CALL_RECORDINGS_BUCKET,
        storage_path: storagePath,
        mime_type: mime,
        uploaded_by: profileId,
        source: "upload",
      },
    });
    if (callError) {
      await admin.storage.from(CALL_RECORDINGS_BUCKET).remove([storagePath]);
      return { error: callError.message };
    }

    return enqueueUploadAnalysis({
      admin,
      agentId: agent.id,
      profileId,
      slug,
      callId,
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "העלאת ההקלטה נכשלה",
    };
  }
}

/**
 * @deprecated Use POST /api/agents/call-control/upload
 */
export async function uploadCallRecording(): Promise<UploadRecordingResult> {
  return {
    error: "יש לרענן את הדף — ההעלאה עברה לנתיב API חדש",
  };
}

/**
 * Admin-only: hard-delete a call + cascaded transcript/analysis rows.
 * Enables a clean re-ingest of the same Drive file (external_id).
 */
export async function deleteCall(
  slug: string,
  callId: string,
): Promise<{ error: string | null }> {
  await requirePermission("agents.manage");

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
