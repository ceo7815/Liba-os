import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateAgentBearer } from "@/lib/mcp/auth";
import { executeMcpTool, MCP_TOOL_NAMES } from "@/lib/mcp/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

export async function GET() {
  return json({
    ok: true,
    service: "liba-os-mcp",
    protocol: "REST",
    note: "Liba OS JSON tool bridge (HttpOsClient). Not Hermes MCP stdio.",
    endpoint: "POST /api/mcp",
    auth: "Authorization: Bearer <agent_api_key>",
    body: { tool: "os.start_run", params: {} },
    tools: MCP_TOOL_NAMES,
    conventions: {
      agent_slug: "call-control",
      hermes_profile: "call-qa",
      save_transcript_official_field: "full_text",
      save_transcript_alias: "text",
      save_transcript_save_analysis: "upsert by call_id (retry-safe)",
      calls_register: "upsert by external_id",
      audio_path:
        "Optional downloadable URL or future Storage path. OS does not fetch audio for the agent. Omit for Drive ingest.",
      dual_ingest:
        "Drive → calls.register(source:drive) OR OS queue → calls.get_pending",
      work_queue: {
        poll_work:
          "Claims oldest queued run → status=claimed. Then os.start_run({ run_id }) promotes claimed→running.",
        start_run_with_run_id: "Continues queued/claimed job; does not insert a new run",
        heartbeat: "os.heartbeat({ agent_slug, status: online|offline })",
      register_dedup:
            "If external_id exists and already analyzed → created:false, skip_analysis:true BUT still upserts call_date/duration_sec/audio_path/metadata (display_name, customer_name, drive_url).",
          register_fields: {
            call_date: "ISO datetime (also accepted in metadata.call_date)",
            duration_sec: "number seconds (also metadata.duration_sec)",
            audio_path: "prefer https Drive/view URL; local paths not used as link",
            metadata_display_name: "card title; fallback customer_name / file_name",
          },
      },
      call_qa_report: {
        overall_score: "XX/100",
        rubric_scores: {
          total: "/100",
          compliance: "/60",
          professionalism: "/25",
          service_quality: "/15",
        },
        findings: {
          schema_version: 1,
          identification: "§3/§25.5",
          checklist: "§4–§22 items with status done|partial|not_done|not_relevant|unverifiable",
          done_well: "§25.7",
          gaps: "§25.8",
          critical_events: "§25.9 empty array = none",
          manager_summary: "§25.11",
        },
        recommendations: "up to 5 (§25.10)",
        summary: "short manager text (§25.11)",
      },
      social_publish: {
        agent_slug: "social-media",
        hermes_profile: "social-media",
        poll: "social.poll_due claims queue row + returns post and signed asset URLs",
        complete: "social.complete({ queue_id, post_id, meta_ids, run_id })",
        fail: "social.fail({ queue_id, post_id, error_message })",
        analytics: "social.list_published + social.save_analytics + social.inbox_upsert (display only, never reply)",
        no_meta_from_os: "Liba OS never calls Meta Graph API directly",
      },
    },
  });
}

export async function POST(request: Request) {
  let agent;
  try {
    agent = await authenticateAgentBearer(
      request.headers.get("authorization"),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server misconfigured";
    const status = message.includes("SERVICE_ROLE") ? 503 : 500;
    return json({ ok: false, error: message }, status);
  }

  if (!agent) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ ok: false, error: "Body must be a JSON object" }, 400);
  }

  const { tool, params } = body as { tool?: unknown; params?: unknown };
  if (typeof tool !== "string" || !tool.trim()) {
    return json({ ok: false, error: "Missing tool name" }, 400);
  }

  const toolParams =
    params && typeof params === "object" && !Array.isArray(params)
      ? (params as Record<string, unknown>)
      : {};

  try {
    const admin = createAdminClient();
    const result = await executeMcpTool(admin, agent, tool.trim(), toolParams);

    if (!result.ok) {
      return json(
        { ok: false, error: result.error },
        result.status ?? 400,
      );
    }

    return json({ ok: true, data: result.data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    const status = message.includes("SERVICE_ROLE") ? 503 : 500;
    return json({ ok: false, error: message }, status);
  }
}
