import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthenticatedAgent } from "@/lib/mcp/auth";
import { executeSocialTool, SOCIAL_MCP_TOOLS } from "@/lib/mcp/social-tools";

export type McpOk = { ok: true; data: unknown };
export type McpErr = { ok: false; error: string; status?: number };
export type McpResult = McpOk | McpErr;

type Params = Record<string, unknown>;

function str(v: unknown, name: string): string {
  if (typeof v !== "string" || !v.trim()) {
    throw new Error(`Missing or invalid param: ${name}`);
  }
  return v.trim();
}

function optStr(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v !== "string") throw new Error("Expected string");
  return v;
}

function num(v: unknown, name: string, fallback?: number): number {
  if (v == null && fallback !== undefined) return fallback;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) {
    return Number(v);
  }
  throw new Error(`Missing or invalid param: ${name}`);
}

function optNum(v: unknown): number | null {
  if (v == null) return null;
  return num(v, "number");
}

function asObject(v: unknown): Record<string, unknown> {
  if (v == null) return {};
  if (typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  throw new Error("Expected object");
}

function asStringArray(v: unknown): string[] | null {
  if (v == null) return null;
  if (!Array.isArray(v) || !v.every((x) => typeof x === "string")) {
    throw new Error("Expected string[]");
  }
  return v;
}

async function requireRunForAgent(
  admin: SupabaseClient,
  runId: string,
  agentId: string,
) {
  const { data, error } = await admin
    .from("agent_runs")
    .select("id, agent_id, status")
    .eq("id", runId)
    .eq("agent_id", agentId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Run not found for this agent");
  }
  return data;
}

export const MCP_TOOL_NAMES = [
  "os.start_run",
  "os.finish_run",
  "os.report_cost",
  "os.report_tool_status",
  "os.log",
  "os.poll_work",
  "os.heartbeat",
  "calls.register",
  "calls.get_pending",
  "calls.set_status",
  "calls.save_transcript",
  "calls.save_analysis",
  ...SOCIAL_MCP_TOOLS,
] as const;

export type McpToolName = (typeof MCP_TOOL_NAMES)[number];

export async function executeMcpTool(
  admin: SupabaseClient,
  agent: AuthenticatedAgent,
  tool: string,
  params: Params,
): Promise<McpResult> {
  try {
    switch (tool) {
      case "os.start_run":
        return await startRun(admin, agent, params);
      case "os.finish_run":
        return await finishRun(admin, agent, params);
      case "os.report_cost":
        return await reportCost(admin, agent, params);
      case "os.report_tool_status":
        return await reportToolStatus(admin, agent, params);
      case "os.log":
        return await logLine(admin, agent, params);
      case "os.poll_work":
        return await pollWork(admin, agent, params);
      case "os.heartbeat":
        return await heartbeat(admin, agent, params);
      case "calls.register":
        return await registerCall(admin, params);
      case "calls.get_pending":
        return await getPendingCalls(admin, params);
      case "calls.set_status":
        return await setCallStatus(admin, params);
      case "calls.save_transcript":
        return await saveTranscript(admin, params);
      case "calls.save_analysis":
        return await saveAnalysis(admin, agent, params);
      default:
        if (tool.startsWith("social.")) {
          return await executeSocialTool(admin, agent, tool, params);
        }
        return { ok: false, error: `Unknown tool: ${tool}`, status: 400 };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tool execution failed";
    return { ok: false, error: message, status: 400 };
  }
}

async function assertAgentSlug(
  agent: AuthenticatedAgent,
  params: Params,
): Promise<McpResult | null> {
  const slug = str(params.agent_slug ?? agent.agentSlug, "agent_slug");
  if (slug !== agent.agentSlug) {
    return {
      ok: false,
      error: "agent_slug does not match authenticated agent",
      status: 403,
    };
  }
  return null;
}

/**
 * os.poll_work — claim oldest queued run → status=claimed.
 * Hermes then calls os.start_run({ run_id }) to move claimed → running.
 */
async function pollWork(
  admin: SupabaseClient,
  agent: AuthenticatedAgent,
  params: Params,
): Promise<McpResult> {
  const mismatch = await assertAgentSlug(agent, params);
  if (mismatch) return mismatch;

  const { data, error } = await admin.rpc("claim_queued_agent_run", {
    p_agent_id: agent.agentId,
  });

  if (error) throw new Error(error.message);

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { ok: true, data: { has_work: false } };
  }

  return {
    ok: true,
    data: {
      has_work: true,
      run_id: row.id,
      trigger: row.trigger,
      metadata: row.metadata ?? {},
      queued_at: row.started_at,
      status: row.status,
    },
  };
}

async function heartbeat(
  admin: SupabaseClient,
  agent: AuthenticatedAgent,
  params: Params,
): Promise<McpResult> {
  const mismatch = await assertAgentSlug(agent, params);
  if (mismatch) return mismatch;

  const status = str(params.status, "status");
  if (status !== "online" && status !== "offline") {
    throw new Error('status must be "online" or "offline"');
  }

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("agents")
    .update({ hermes_status: status, hermes_last_seen_at: now })
    .eq("id", agent.agentId)
    .select("slug, hermes_status, hermes_last_seen_at")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to update heartbeat");
  return { ok: true, data };
}

async function startRun(
  admin: SupabaseClient,
  agent: AuthenticatedAgent,
  params: Params,
): Promise<McpResult> {
  const mismatch = await assertAgentSlug(agent, params);
  if (mismatch) return mismatch;

  const existingRunId = optStr(params.run_id);

  // Continue a queued/claimed work item created by the dashboard button
  if (existingRunId) {
    const existing = await requireRunForAgent(admin, existingRunId, agent.agentId);
    if (existing.status !== "queued" && existing.status !== "claimed") {
      throw new Error(
        `run_id ${existingRunId} is not queued/claimed (status=${existing.status})`,
      );
    }

    const now = new Date().toISOString();
    const { data, error } = await admin
      .from("agent_runs")
      .update({ status: "running", started_at: now })
      .eq("id", existingRunId)
      .eq("agent_id", agent.agentId)
      .in("status", ["queued", "claimed"])
      .select("id, started_at, status, trigger, metadata")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("Failed to promote queued run (already taken?)");

    await admin
      .from("agents")
      .update({ last_run_at: data.started_at, last_run_status: "running" })
      .eq("id", agent.agentId);

    return {
      ok: true,
      data: {
        run_id: data.id,
        started_at: data.started_at,
        status: data.status,
        resumed: true,
        trigger: data.trigger,
      },
    };
  }

  const trigger = str(params.trigger, "trigger");

  const { data, error } = await admin
    .from("agent_runs")
    .insert({
      agent_id: agent.agentId,
      trigger,
      status: "running",
      metadata: asObject(params.metadata),
    })
    .select("id, started_at, status")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to start run");
  }

  await admin
    .from("agents")
    .update({ last_run_at: data.started_at, last_run_status: "running" })
    .eq("id", agent.agentId);

  return {
    ok: true,
    data: {
      run_id: data.id,
      started_at: data.started_at,
      status: data.status,
      resumed: false,
    },
  };
}

async function finishRun(
  admin: SupabaseClient,
  agent: AuthenticatedAgent,
  params: Params,
): Promise<McpResult> {
  const runId = str(params.run_id, "run_id");
  await requireRunForAgent(admin, runId, agent.agentId);

  const status = str(params.status, "status");
  const allowed = ["success", "failed", "partial", "cancelled"];
  if (!allowed.includes(status)) {
    throw new Error(`status must be one of: ${allowed.join(", ")}`);
  }

  const patch = {
    status,
    finished_at: new Date().toISOString(),
    items_processed: num(params.items_processed, "items_processed", 0),
    items_failed: num(params.items_failed, "items_failed", 0),
    input_tokens: Math.trunc(num(params.input_tokens, "input_tokens", 0)),
    output_tokens: Math.trunc(num(params.output_tokens, "output_tokens", 0)),
    error_message: optStr(params.error_message),
  };

  const { data, error } = await admin
    .from("agent_runs")
    .update(patch)
    .eq("id", runId)
    .eq("agent_id", agent.agentId)
    .select(
      "id, status, finished_at, items_processed, items_failed, input_tokens, output_tokens, cost_usd",
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to finish run");
  }

  await admin
    .from("agents")
    .update({ last_run_at: data.finished_at, last_run_status: status })
    .eq("id", agent.agentId);

  return { ok: true, data };
}

async function reportCost(
  admin: SupabaseClient,
  agent: AuthenticatedAgent,
  params: Params,
): Promise<McpResult> {
  const runId = str(params.run_id, "run_id");
  await requireRunForAgent(admin, runId, agent.agentId);

  const service = str(params.service, "service");
  const costUsd = num(params.cost_usd, "cost_usd");
  if (costUsd < 0) throw new Error("cost_usd must be >= 0");

  const { data: costRow, error } = await admin
    .from("agent_costs")
    .insert({
      run_id: runId,
      agent_id: agent.agentId,
      service,
      units: optNum(params.units),
      unit_type: optStr(params.unit_type),
      cost_usd: costUsd,
    })
    .select("id, service, units, unit_type, cost_usd, occurred_at")
    .single();

  if (error || !costRow) {
    throw new Error(error?.message ?? "Failed to report cost");
  }

  const { data: run } = await admin
    .from("agent_runs")
    .select("cost_usd")
    .eq("id", runId)
    .single();

  const nextTotal = Number(run?.cost_usd ?? 0) + costUsd;
  await admin.from("agent_runs").update({ cost_usd: nextTotal }).eq("id", runId);

  return {
    ok: true,
    data: { ...costRow, run_cost_usd: nextTotal },
  };
}

async function reportToolStatus(
  admin: SupabaseClient,
  agent: AuthenticatedAgent,
  params: Params,
): Promise<McpResult> {
  const slug = str(params.agent_slug ?? agent.agentSlug, "agent_slug");
  if (slug !== agent.agentSlug) {
    return {
      ok: false,
      error: "agent_slug does not match authenticated agent",
      status: 403,
    };
  }

  const toolName = str(params.tool_name, "tool_name");
  const toolType = str(params.tool_type, "tool_type");
  const status = str(params.status, "status");
  const allowed = ["connected", "degraded", "error", "disconnected"];
  if (!allowed.includes(status)) {
    throw new Error(`status must be one of: ${allowed.join(", ")}`);
  }

  const now = new Date().toISOString();
  const { data: existing } = await admin
    .from("agent_tools")
    .select("id")
    .eq("agent_id", agent.agentId)
    .eq("tool_name", toolName)
    .maybeSingle();

  let row;
  if (existing) {
    const { data, error } = await admin
      .from("agent_tools")
      .update({
        tool_type: toolType,
        status,
        last_checked_at: now,
        metadata: asObject(params.metadata),
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Failed to update tool");
    row = data;
  } else {
    const { data, error } = await admin
      .from("agent_tools")
      .insert({
        agent_id: agent.agentId,
        tool_name: toolName,
        tool_type: toolType,
        status,
        last_checked_at: now,
        metadata: asObject(params.metadata),
      })
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Failed to insert tool");
    row = data;
  }

  return { ok: true, data: row };
}

async function logLine(
  admin: SupabaseClient,
  agent: AuthenticatedAgent,
  params: Params,
): Promise<McpResult> {
  const runId = str(params.run_id, "run_id");
  await requireRunForAgent(admin, runId, agent.agentId);

  const level = str(params.level ?? "info", "level");
  const allowed = ["debug", "info", "warn", "error"];
  if (!allowed.includes(level)) {
    throw new Error(`level must be one of: ${allowed.join(", ")}`);
  }
  const message = str(params.message, "message");

  const { data, error } = await admin
    .from("agent_logs")
    .insert({
      run_id: runId,
      agent_id: agent.agentId,
      level,
      message,
    })
    .select("id, level, message, created_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to write log");
  }

  return { ok: true, data };
}

function softStr(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t || null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function softNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return null;
}

function isHttpUrl(v: string | null | undefined): v is string {
  return typeof v === "string" && /^https?:\/\//i.test(v);
}

/** Normalize Hermes register payload: top-level + metadata aliases. */
function buildRegisterPayload(params: Params) {
  const externalId = str(params.external_id, "external_id");
  const source = str(params.source, "source");
  const metadata: Record<string, unknown> = { ...asObject(params.metadata) };

  const customerName =
    softStr(metadata.customer_name) ?? softStr(params.customer_name);
  const displayName =
    softStr(metadata.display_name) ??
    softStr(params.display_name) ??
    customerName;
  const fileName =
    softStr(metadata.file_name) ??
    softStr(params.file_name) ??
    softStr(metadata.name);

  if (displayName) metadata.display_name = displayName;
  if (customerName) metadata.customer_name = customerName;
  if (fileName) {
    if (!softStr(metadata.file_name)) metadata.file_name = fileName;
    if (!softStr(metadata.name)) metadata.name = fileName;
  }

  const callDate =
    softStr(params.call_date) ?? softStr(metadata.call_date);
  const durationSec =
    softNum(params.duration_sec) ?? softNum(metadata.duration_sec);

  const driveUrl =
    softStr(metadata.drive_url) ??
    softStr(params.drive_url) ??
    (isHttpUrl(softStr(params.audio_path))
      ? softStr(params.audio_path)
      : null);
  if (driveUrl) metadata.drive_url = driveUrl;

  // Prefer HTTPS Drive URL over local cache paths.
  let audioPath = softStr(params.audio_path);
  if (!isHttpUrl(audioPath) && isHttpUrl(driveUrl)) {
    audioPath = driveUrl;
  }

  return {
    external_id: externalId,
    source,
    duration_sec: durationSec,
    call_date: callDate,
    audio_path: audioPath,
    metadata,
  };
}

async function registerCall(
  admin: SupabaseClient,
  params: Params,
): Promise<McpResult> {
  const payload = buildRegisterPayload(params);

  const { data: existing } = await admin
    .from("calls")
    .select("id, status, external_id, source, metadata, call_date, duration_sec, audio_path")
    .eq("external_id", payload.external_id)
    .maybeSingle();

  if (existing) {
    // Already analyzed → skip re-analysis, but ALWAYS upsert identity fields.
    let skipAnalysis = false;
    if (existing.status === "done") {
      const { count } = await admin
        .from("call_analyses")
        .select("id", { count: "exact", head: true })
        .eq("call_id", existing.id);
      skipAnalysis = (count ?? 0) > 0;
    }

    const existingMeta =
      existing.metadata &&
      typeof existing.metadata === "object" &&
      !Array.isArray(existing.metadata)
        ? (existing.metadata as Record<string, unknown>)
        : {};

    const mergedMeta = { ...existingMeta, ...payload.metadata };
    // Keep human titles if incoming omit them
    if (!softStr(mergedMeta.display_name) && softStr(existingMeta.display_name)) {
      mergedMeta.display_name = existingMeta.display_name;
    }
    if (!softStr(mergedMeta.customer_name) && softStr(existingMeta.customer_name)) {
      mergedMeta.customer_name = existingMeta.customer_name;
    }
    if (!softStr(mergedMeta.drive_url) && softStr(existingMeta.drive_url)) {
      mergedMeta.drive_url = existingMeta.drive_url;
    }

    const nextAudio = isHttpUrl(payload.audio_path)
      ? payload.audio_path
      : isHttpUrl(existing.audio_path)
        ? existing.audio_path
        : payload.audio_path ?? existing.audio_path ?? null;

    const patch: Record<string, unknown> = {
      source: payload.source,
      metadata: mergedMeta,
    };
    if (payload.duration_sec != null) patch.duration_sec = payload.duration_sec;
    if (payload.call_date) patch.call_date = payload.call_date;
    if (nextAudio) patch.audio_path = nextAudio;

    const { data, error } = await admin
      .from("calls")
      .update(patch)
      .eq("id", existing.id)
      .select("id, external_id, status, source, call_date, duration_sec, audio_path, metadata")
      .single();

    if (error || !data) throw new Error(error?.message ?? "Failed to update call");

    return {
      ok: true,
      data: {
        ...data,
        call_id: data.id,
        created: false,
        skip_analysis: skipAnalysis,
        reason: skipAnalysis ? "already_analyzed" : undefined,
      },
    };
  }

  const { data, error } = await admin
    .from("calls")
    .insert({
      ...payload,
      status: "pending",
    })
    .select("id, external_id, status, source, call_date, duration_sec, audio_path, metadata")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to register call");
  return {
    ok: true,
    data: {
      ...data,
      call_id: data.id,
      created: true,
      skip_analysis: false,
    },
  };
}

async function getPendingCalls(
  admin: SupabaseClient,
  params: Params,
): Promise<McpResult> {
  const limit = Math.trunc(num(params.limit, "limit", 10));
  const { data, error } = await admin.rpc("claim_pending_calls", {
    p_limit: limit,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { ok: true, data: { calls: data ?? [], count: (data ?? []).length } };
}

async function setCallStatus(
  admin: SupabaseClient,
  params: Params,
): Promise<McpResult> {
  const callId = str(params.call_id, "call_id");
  const status = str(params.status, "status");
  const allowed = ["pending", "claimed", "processing", "done", "failed", "skipped"];
  if (!allowed.includes(status)) {
    throw new Error(`status must be one of: ${allowed.join(", ")}`);
  }

  const { data, error } = await admin
    .from("calls")
    .update({ status })
    .eq("id", callId)
    .select("id, status, external_id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Call not found");
  return { ok: true, data };
}

async function saveTranscript(
  admin: SupabaseClient,
  params: Params,
): Promise<McpResult> {
  const callId = str(params.call_id, "call_id");
  // Official field: full_text. Alias: text (accepted for convenience / retries).
  const fullText = str(params.full_text ?? params.text, "full_text");

  const { data: call } = await admin
    .from("calls")
    .select("id")
    .eq("id", callId)
    .maybeSingle();
  if (!call) throw new Error("Call not found");

  const payload = {
    full_text: fullText,
    segments: params.segments ?? null,
    provider: optStr(params.provider),
    cost_usd: optNum(params.cost_usd),
    language: optStr(params.language) ?? "he",
  };

  const { data: existing } = await admin
    .from("call_transcripts")
    .select("id")
    .eq("call_id", callId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { data, error } = await admin
      .from("call_transcripts")
      .update(payload)
      .eq("id", existing.id)
      .select("id, call_id, provider, cost_usd, created_at")
      .single();
    if (error || !data) {
      throw new Error(error?.message ?? "Failed to update transcript");
    }
    return { ok: true, data: { ...data, upserted: true, created: false } };
  }

  const { data, error } = await admin
    .from("call_transcripts")
    .insert({ call_id: callId, ...payload })
    .select("id, call_id, provider, cost_usd, created_at")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to save transcript");
  return { ok: true, data: { ...data, upserted: true, created: true } };
}

async function saveAnalysis(
  admin: SupabaseClient,
  agent: AuthenticatedAgent,
  params: Params,
): Promise<McpResult> {
  const callId = str(params.call_id, "call_id");
  const runId = optStr(params.run_id);

  if (runId) {
    await requireRunForAgent(admin, runId, agent.agentId);
  }

  const { data: call } = await admin
    .from("calls")
    .select("id")
    .eq("id", callId)
    .maybeSingle();
  if (!call) throw new Error("Call not found");

  const recommendations = asStringArray(params.recommendations);
  const findingsRaw = params.findings;
  let findings = findingsRaw ?? null;
  if (findings && typeof findings === "object" && !Array.isArray(findings)) {
    const f = { ...(findings as Record<string, unknown>) };
    if (f.schema_version == null) f.schema_version = 1;
    findings = f;
  }

  const rubricScores = params.rubric_scores ?? null;
  let overallScore = optNum(params.overall_score);
  if (
    overallScore == null &&
    rubricScores &&
    typeof rubricScores === "object" &&
    !Array.isArray(rubricScores)
  ) {
    const total = (rubricScores as Record<string, unknown>).total;
    if (typeof total === "number") overallScore = total;
  }

  const payload = {
    run_id: runId,
    summary: optStr(params.summary),
    overall_score: overallScore,
    rubric_scores: rubricScores,
    findings,
    recommendations: recommendations ? recommendations.slice(0, 5) : null,
    model: optStr(params.model),
  };

  const { data: existing } = await admin
    .from("call_analyses")
    .select("id")
    .eq("call_id", callId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { data, error } = await admin
      .from("call_analyses")
      .update(payload)
      .eq("id", existing.id)
      .select("id, call_id, run_id, overall_score, created_at")
      .single();
    if (error || !data) {
      throw new Error(error?.message ?? "Failed to update analysis");
    }
    return { ok: true, data: { ...data, upserted: true, created: false } };
  }

  const { data, error } = await admin
    .from("call_analyses")
    .insert({ call_id: callId, ...payload })
    .select("id, call_id, run_id, overall_score, created_at")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to save analysis");
  return { ok: true, data: { ...data, upserted: true, created: true } };
}
