import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthenticatedAgent } from "@/lib/mcp/auth";
import { SOCIAL_STORAGE_BUCKET } from "@/lib/social-media/constants";

type McpResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string; status?: number };

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

function num(v: unknown, name: string, fallback = 0): number {
  if (v == null) return fallback;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) {
    return Number(v);
  }
  throw new Error(`Missing or invalid param: ${name}`);
}

function asObject(v: unknown): Record<string, unknown> {
  if (v == null) return {};
  if (typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  throw new Error("Expected object");
}

export const SOCIAL_MCP_TOOLS = [
  "social.poll_due",
  "social.complete",
  "social.fail",
  "social.list_published",
  "social.save_analytics",
  "social.inbox_upsert",
] as const;

export function assertSocialAgent(agent: AuthenticatedAgent): McpResult | null {
  if (agent.agentSlug !== "social-media") {
    return {
      ok: false,
      error: "social.* tools require the social-media agent API key",
      status: 403,
    };
  }
  return null;
}

async function signAssets(
  admin: SupabaseClient,
  assets: Array<Record<string, unknown>>,
) {
  return Promise.all(
    assets.map(async (asset) => {
      const path = String(asset.storage_path ?? "");
      if (!path) return { ...asset, signed_url: null };
      const { data } = await admin.storage
        .from(SOCIAL_STORAGE_BUCKET)
        .createSignedUrl(path, 3600);
      return { ...asset, signed_url: data?.signedUrl ?? null };
    }),
  );
}

export async function executeSocialTool(
  admin: SupabaseClient,
  agent: AuthenticatedAgent,
  tool: string,
  params: Params,
): Promise<McpResult> {
  const denied = assertSocialAgent(agent);
  if (denied) return denied;

  switch (tool) {
    case "social.poll_due":
      return pollDue(admin, agent, params);
    case "social.complete":
      return completePublish(admin, agent, params);
    case "social.fail":
      return failPublish(admin, params);
    case "social.list_published":
      return listPublished(admin, params);
    case "social.save_analytics":
      return saveAnalytics(admin, params);
    case "social.inbox_upsert":
      return inboxUpsert(admin, params);
    default:
      return { ok: false, error: `Unknown tool: ${tool}`, status: 400 };
  }
}

async function pollDue(
  admin: SupabaseClient,
  agent: AuthenticatedAgent,
  params: Params,
): Promise<McpResult> {
  const { data: claimed, error } = await admin.rpc("claim_social_publish_queue");
  if (error) throw new Error(error.message);

  const row = Array.isArray(claimed) ? claimed[0] : claimed;
  if (!row) {
    return { ok: true, data: { has_work: false } };
  }

  const postId = row.post_id as string;
  const queueId = row.queue_id as string;

  const { error: postErr } = await admin
    .from("social_posts")
    .update({ status: "publishing", error: null })
    .eq("id", postId)
    .in("status", ["scheduled", "publishing", "failed"]);

  if (postErr) throw new Error(postErr.message);

  await admin
    .from("social_publish_queue")
    .update({ agent_run_id: optStr(params.run_id) })
    .eq("id", queueId);

  const { data: post, error: loadErr } = await admin
    .from("social_posts")
    .select(
      "id, scheduled_at, status, caption, media_mode, platforms, formats, holiday_key, meta_ids",
    )
    .eq("id", postId)
    .single();

  if (loadErr || !post) throw new Error(loadErr?.message ?? "Post not found");

  const { data: assets } = await admin
    .from("social_assets")
    .select(
      "id, post_id, kind, mime_type, storage_path, file_name, file_size, width, height, source",
    )
    .eq("post_id", postId);

  const signed = await signAssets(admin, assets ?? []);

  return {
    ok: true,
    data: {
      has_work: true,
      queue_id: queueId,
      scheduled_for: row.scheduled_for,
      agent_slug: agent.agentSlug,
      post,
      assets: signed,
    },
  };
}

async function completePublish(
  admin: SupabaseClient,
  agent: AuthenticatedAgent,
  params: Params,
): Promise<McpResult> {
  const queueId = str(params.queue_id, "queue_id");
  const postId = str(params.post_id, "post_id");
  const metaIds = asObject(params.meta_ids);
  const runId = optStr(params.run_id);
  const now = new Date().toISOString();

  const { error: qErr } = await admin
    .from("social_publish_queue")
    .update({
      status: "completed",
      completed_at: now,
      error_message: null,
      agent_run_id: runId,
    })
    .eq("id", queueId);

  if (qErr) throw new Error(qErr.message);

  const { error: pErr } = await admin
    .from("social_posts")
    .update({
      status: "published",
      published_at: now,
      meta_ids: metaIds,
      error: null,
    })
    .eq("id", postId);

  if (pErr) throw new Error(pErr.message);

  return {
    ok: true,
    data: {
      queue_id: queueId,
      post_id: postId,
      status: "published",
      published_at: now,
      agent_slug: agent.agentSlug,
    },
  };
}

async function failPublish(
  admin: SupabaseClient,
  params: Params,
): Promise<McpResult> {
  const queueId = str(params.queue_id, "queue_id");
  const postId = str(params.post_id, "post_id");
  const message = str(params.error_message, "error_message");
  const now = new Date().toISOString();

  await admin
    .from("social_publish_queue")
    .update({
      status: "failed",
      completed_at: now,
      error_message: message,
    })
    .eq("id", queueId);

  await admin
    .from("social_posts")
    .update({ status: "failed", error: message })
    .eq("id", postId);

  return {
    ok: true,
    data: { queue_id: queueId, post_id: postId, status: "failed" },
  };
}

async function listPublished(
  admin: SupabaseClient,
  params: Params,
): Promise<McpResult> {
  const limit = Math.min(50, Math.max(1, Math.trunc(num(params.limit, "limit", 20))));
  const { data, error } = await admin
    .from("social_posts")
    .select("id, platforms, formats, published_at, meta_ids, caption, holiday_key")
    .eq("status", "published")
    .not("meta_ids", "is", null)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return { ok: true, data: { posts: data ?? [] } };
}

async function saveAnalytics(
  admin: SupabaseClient,
  params: Params,
): Promise<McpResult> {
  const postId = str(params.post_id, "post_id");
  const payload = {
    post_id: postId,
    impressions: Math.trunc(num(params.impressions, "impressions")),
    reach: Math.trunc(num(params.reach, "reach")),
    likes: Math.trunc(num(params.likes, "likes")),
    comments: Math.trunc(num(params.comments, "comments")),
    saves: Math.trunc(num(params.saves, "saves")),
    shares: Math.trunc(num(params.shares, "shares")),
    link_clicks: Math.trunc(num(params.link_clicks, "link_clicks")),
    story_views: Math.trunc(num(params.story_views, "story_views")),
    new_followers: Math.trunc(num(params.new_followers, "new_followers")),
    recorded_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from("social_post_analytics")
    .upsert(payload, { onConflict: "post_id" })
    .select("post_id, recorded_at")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to save analytics");

  const engagement =
    payload.likes + payload.comments + payload.saves + payload.shares;
  const topic = optStr(params.topic_key) || "general";
  const format = optStr(params.format) || "feed";

  const { data: existing } = await admin
    .from("social_learn_stats")
    .select("sample_count, avg_engagement")
    .eq("topic_key", topic)
    .eq("format", format)
    .maybeSingle();

  if (existing) {
    const n = Number(existing.sample_count ?? 0) + 1;
    const prev = Number(existing.avg_engagement ?? 0);
    const avg = (prev * (n - 1) + engagement) / n;
    await admin
      .from("social_learn_stats")
      .update({ sample_count: n, avg_engagement: avg, updated_at: payload.recorded_at })
      .eq("topic_key", topic)
      .eq("format", format);
  } else {
    await admin.from("social_learn_stats").insert({
      topic_key: topic,
      format,
      sample_count: 1,
      avg_engagement: engagement,
    });
  }

  return { ok: true, data };
}

async function inboxUpsert(
  admin: SupabaseClient,
  params: Params,
): Promise<McpResult> {
  const platform = str(params.platform, "platform");
  if (platform !== "facebook_page" && platform !== "instagram") {
    throw new Error("platform must be facebook_page or instagram");
  }
  const externalId = str(params.external_id, "external_id");
  const body = str(params.body, "body");
  const row = {
    platform,
    external_id: externalId,
    post_id: optStr(params.post_id),
    author_name: optStr(params.author_name),
    author_handle: optStr(params.author_handle),
    body,
    received_at: optStr(params.received_at) || new Date().toISOString(),
    status: "new",
  };

  const { data, error } = await admin
    .from("social_inbox")
    .upsert(row, { onConflict: "platform,external_id", ignoreDuplicates: true })
    .select("id, platform, external_id, status")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return { ok: true, data: data ?? { platform, external_id: externalId, skipped: true } };
}
