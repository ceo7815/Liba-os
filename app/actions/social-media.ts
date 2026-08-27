"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile, requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildAiCaptionSuggestion, buildImagePrompt } from "@/lib/social-media/ai-suggest";
import { composeSocialCaption } from "@/lib/social-media/caption-gen";
import { planSocialImage } from "@/lib/social-media/image-plan";
import { finalizeCaption } from "@/lib/social-media/caption-format";
import {
  DEFAULT_BRAND,
  DEFAULT_CTAS,
  DEFAULT_PUBLISH_TIME,
  SOCIAL_STORAGE_BUCKET,
} from "@/lib/social-media/constants";
import {
  checkForbiddenPhrases,
  forbiddenErrorMessage,
} from "@/lib/social-media/forbidden";
import { getHolidayForDate } from "@/lib/social-media/holidays";
import {
  generateSocialImages,
  OPENAI_IMAGE_ESTIMATED_COST_USD,
} from "@/lib/social-media/image-gen";
import {
  isoToJerusalemDate,
  jerusalemDateTimeToIso,
  monthRangeIso,
} from "@/lib/social-media/scheduling";
import type {
  InboxStatus,
  SocialAsset,
  SocialDashboardPayload,
  SocialFormat,
  SocialInboxItem,
  SocialMutationResult,
  SocialPlatform,
  SocialPost,
  SocialPostStatus,
  SocialSettings,
} from "@/lib/social-media/types";

const AGENT_SLUG = "social-media";
const REVALIDATE = "/agents/social-media";

const POST_COLS =
  "id, scheduled_at, status, caption, caption_locked, media_mode, platforms, formats, include_image_text, holiday_key, ai_suggestion, user_notes, image_prompt, image_revision_notes, approved_at, approved_by, published_at, meta_ids, analytics, error, created_at, updated_at";

type DbSettings = {
  id: string;
  brand: Record<string, unknown>;
  tone_guidelines: string;
  forbidden_phrases: string[];
  default_publish_time: string;
  platforms: string[];
  phone: string | null;
  phone_secondary: string | null;
  email: string | null;
  address: string | null;
  license_number: string | null;
  ctas: unknown;
  updated_at: string;
};

function asClock(value: unknown): string {
  const raw = String(value ?? DEFAULT_PUBLISH_TIME);
  return raw.length >= 5 ? raw.slice(0, 5) : DEFAULT_PUBLISH_TIME;
}

function fallbackSettings(): SocialSettings {
  return {
    id: "fallback",
    brand: { ...DEFAULT_BRAND },
    tone_guidelines: "",
    forbidden_phrases: [],
    default_publish_time: DEFAULT_PUBLISH_TIME,
    platforms: ["facebook_page", "instagram"],
    phone: null,
    phone_secondary: null,
    email: null,
    address: null,
    license_number: null,
    ctas: DEFAULT_CTAS,
    updated_at: new Date().toISOString(),
  };
}

function emptyDashboard(): SocialDashboardPayload {
  return {
    settings: fallbackSettings(),
    posts: [],
    inbox: [],
    runs: [],
    costs: [],
    monthlyCostUsd: 0,
    agentId: null,
  };
}

function mapSettings(row: DbSettings): SocialSettings {
  const brandRaw = row.brand ?? {};
  return {
    id: row.id,
    brand: {
      name: String(brandRaw.name ?? DEFAULT_BRAND.name),
      altName: brandRaw.altName ? String(brandRaw.altName) : DEFAULT_BRAND.altName,
      primaryColor: brandRaw.primaryColor ? String(brandRaw.primaryColor) : DEFAULT_BRAND.primaryColor,
      secondaryColor: brandRaw.secondaryColor ? String(brandRaw.secondaryColor) : DEFAULT_BRAND.secondaryColor,
      logoPath: "/brand/liba-logo.png",
      website: brandRaw.website ? String(brandRaw.website) : DEFAULT_BRAND.website,
      visualLanguage: brandRaw.visualLanguage
        ? String(brandRaw.visualLanguage)
        : DEFAULT_BRAND.visualLanguage,
    },
    tone_guidelines: row.tone_guidelines ?? "",
    forbidden_phrases: row.forbidden_phrases ?? [],
    default_publish_time: asClock(row.default_publish_time),
    platforms: (row.platforms ?? ["facebook_page", "instagram"]) as SocialPlatform[],
    phone: row.phone,
    phone_secondary: row.phone_secondary ?? null,
    email: row.email,
    address: row.address,
    license_number: row.license_number,
    ctas: Array.isArray(row.ctas)
      ? (row.ctas as SocialSettings["ctas"])
      : DEFAULT_CTAS,
    updated_at: row.updated_at,
  };
}

function mapPost(row: Record<string, unknown>): SocialPost {
  return {
    id: String(row.id),
    scheduled_at: String(row.scheduled_at),
    status: row.status as SocialPostStatus,
    caption: String(row.caption ?? ""),
    caption_locked: Boolean(row.caption_locked),
    media_mode: row.media_mode as SocialPost["media_mode"],
    platforms: (row.platforms ?? []) as SocialPlatform[],
    formats: (row.formats ?? []) as SocialFormat[],
    include_image_text: Boolean(row.include_image_text),
    holiday_key: row.holiday_key ? String(row.holiday_key) : null,
    ai_suggestion: row.ai_suggestion ? String(row.ai_suggestion) : null,
    user_notes: row.user_notes ? String(row.user_notes) : null,
    image_prompt: row.image_prompt ? String(row.image_prompt) : null,
    image_revision_notes: row.image_revision_notes
      ? String(row.image_revision_notes)
      : null,
    approved_at: row.approved_at ? String(row.approved_at) : null,
    approved_by: row.approved_by ? String(row.approved_by) : null,
    published_at: row.published_at ? String(row.published_at) : null,
    meta_ids: (row.meta_ids as Record<string, unknown>) ?? null,
    analytics: (row.analytics as Record<string, unknown>) ?? {},
    error: row.error ? String(row.error) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    queue_trigger: null,
    queue_status: null,
    queue_error: null,
  };
}

async function attachLatestQueue(
  admin: ReturnType<typeof createAdminClient>,
  posts: SocialPost[],
): Promise<SocialPost[]> {
  if (posts.length === 0) return posts;
  const { data } = await admin
    .from("social_publish_queue")
    .select("post_id, status, trigger, error_message")
    .in(
      "post_id",
      posts.map((p) => p.id),
    )
    .order("created_at", { ascending: false });

  const latest = new Map<
    string,
    { status: string; trigger: string; error_message: string | null }
  >();
  for (const row of data ?? []) {
    if (!latest.has(row.post_id)) {
      latest.set(row.post_id, {
        status: String(row.status),
        trigger: String(row.trigger ?? "scheduled"),
        error_message: row.error_message ? String(row.error_message) : null,
      });
    }
  }

  return posts.map((post) => {
    const q = latest.get(post.id);
    if (!q) return post;
    return {
      ...post,
      queue_status: q.status,
      queue_trigger: q.trigger === "immediate" ? "immediate" : "scheduled",
      queue_error: q.error_message,
    };
  });
}

async function getAgentId(admin: ReturnType<typeof createAdminClient>) {
  const { data } = await admin
    .from("agents")
    .select("id")
    .eq("slug", AGENT_SLUG)
    .maybeSingle();
  return data?.id ?? null;
}

async function attachSignedUrls(
  admin: ReturnType<typeof createAdminClient>,
  assets: SocialAsset[],
): Promise<SocialAsset[]> {
  return Promise.all(
    assets.map(async (asset) => {
      const { data } = await admin.storage
        .from(SOCIAL_STORAGE_BUCKET)
        .createSignedUrl(asset.storage_path, 3600);
      return { ...asset, signed_url: data?.signedUrl ?? null };
    }),
  );
}

async function loadSettings(admin: ReturnType<typeof createAdminClient>) {
  const { data, error } = await admin
    .from("social_settings")
    .select("*")
    .limit(1)
    .maybeSingle<DbSettings>();

  if (error) {
    console.error("[social-media] social_settings query failed", error.message);
    return fallbackSettings();
  }
  if (!data) {
    console.error("[social-media] social_settings row missing");
    return fallbackSettings();
  }
  return mapSettings(data);
}

export async function loadSocialDashboard(
  year: number,
  month: number,
): Promise<SocialDashboardPayload> {
  await requireProfile();
  try {
    return await loadSocialDashboardUnsafe(year, month);
  } catch (err) {
    console.error("[social-media] loadSocialDashboard failed", err);
    return emptyDashboard();
  }
}

async function loadSocialDashboardUnsafe(
  year: number,
  month: number,
): Promise<SocialDashboardPayload> {
  const admin = createAdminClient();
  const settings = await loadSettings(admin);
  const range = monthRangeIso(year, month);
  const agentId = await getAgentId(admin);

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [postsRes, inboxRes, runsRes, costsRes] = await Promise.all([
    admin
      .from("social_posts")
      .select(POST_COLS)
      .gte("scheduled_at", range.start)
      .lte("scheduled_at", range.end)
      .order("scheduled_at"),
    admin
      .from("social_inbox")
      .select(
        "id, platform, external_id, post_id, author_name, author_handle, body, received_at, status",
      )
      .order("received_at", { ascending: false })
      .limit(100),
    agentId
      ? admin
          .from("agent_runs")
          .select(
            "id, trigger, started_at, finished_at, status, items_processed, items_failed, cost_usd",
          )
          .eq("agent_id", agentId)
          .order("started_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as never[], error: null }),
    agentId
      ? admin
          .from("agent_costs")
          .select("id, service, units, unit_type, cost_usd, occurred_at")
          .eq("agent_id", agentId)
          .gte("occurred_at", monthStart.toISOString())
          .order("occurred_at", { ascending: false })
          .limit(40)
      : Promise.resolve({ data: [] as never[], error: null }),
  ]);

  if (postsRes.error) {
    console.error("[social-media] social_posts query failed", postsRes.error.message);
  }
  if (inboxRes.error) {
    console.error("[social-media] social_inbox query failed", inboxRes.error.message);
  }
  if (runsRes.error) {
    console.error("[social-media] agent_runs query failed", runsRes.error.message);
  }
  if (costsRes.error) {
    console.error("[social-media] agent_costs query failed", costsRes.error.message);
  }

  const postIds = (postsRes.data ?? []).map((p) => p.id);
  const assetsByPost: Record<string, SocialAsset[]> = {};

  if (postIds.length > 0) {
    const { data: assets } = await admin
      .from("social_assets")
      .select(
        "id, post_id, kind, mime_type, storage_path, file_name, file_size, width, height, source, created_at",
      )
      .in("post_id", postIds);

    for (const row of assets ?? []) {
      const asset: SocialAsset = {
        id: row.id,
        post_id: row.post_id,
        kind: row.kind as SocialAsset["kind"],
        mime_type: row.mime_type,
        storage_path: row.storage_path,
        file_name: row.file_name,
        file_size: row.file_size,
        width: row.width,
        height: row.height,
        source: row.source as SocialAsset["source"],
        created_at: row.created_at,
      };
      const list = assetsByPost[row.post_id] ?? [];
      list.push(asset);
      assetsByPost[row.post_id] = list;
    }

    for (const postId of Object.keys(assetsByPost)) {
      assetsByPost[postId] = await attachSignedUrls(admin, assetsByPost[postId]);
    }
  }

  const posts = await attachLatestQueue(
    admin,
    (postsRes.data ?? []).map((row) => {
      const post = mapPost(row as Record<string, unknown>);
      post.assets = assetsByPost[post.id] ?? [];
      return post;
    }),
  );

  const costs = (costsRes.data ?? []).map((c) => ({
    ...c,
    cost_usd: Number(c.cost_usd),
    units: c.units != null ? Number(c.units) : null,
  }));

  return {
    settings,
    posts,
    inbox: (inboxRes.data ?? []) as SocialInboxItem[],
    runs: runsRes.data ?? [],
    costs,
    monthlyCostUsd: costs.reduce((s, c) => s + c.cost_usd, 0),
    agentId,
  };
}

export async function getOrCreatePostForDate(
  date: string,
  options?: { immediate?: boolean },
): Promise<{ ok: true; post: SocialPost } | { ok: false; error: string }> {
  try {
    return await getOrCreatePostForDateUnsafe(date, options);
  } catch (err) {
    console.error("[social-media] getOrCreatePostForDate failed", err);
    return { ok: false, error: "לא הצלחנו לפתוח את היום. נסו שוב." };
  }
}

async function getOrCreatePostForDateUnsafe(
  date: string,
  options?: { immediate?: boolean },
): Promise<{ ok: true; post: SocialPost } | { ok: false; error: string }> {
  const profile = await requireProfile();
  const admin = createAdminClient();
  const settings = await loadSettings(admin);
  const [y, m] = date.split("-").map(Number);
  let holiday: Awaited<ReturnType<typeof getHolidayForDate>> = null;
  try {
    holiday = await Promise.race([
      getHolidayForDate(y, m, date),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
    ]);
  } catch (err) {
    console.error("[social-media] holiday lookup skipped", err);
  }
  const range = monthRangeIso(y, m);

  const { data: existing } = await admin
    .from("social_posts")
    .select(POST_COLS)
    .gte("scheduled_at", range.start)
    .lte("scheduled_at", range.end);

  const approvedStatuses = new Set(["scheduled", "publishing", "published"]);
  const match = (existing ?? []).find((p) => {
    if (isoToJerusalemDate(String(p.scheduled_at)) !== date) return false;
    if (options?.immediate && approvedStatuses.has(String(p.status))) {
      return false;
    }
    return true;
  });

  if (match) {
    const post = mapPost(match as Record<string, unknown>);
    const { data: assets } = await admin
      .from("social_assets")
      .select(
        "id, post_id, kind, mime_type, storage_path, file_name, file_size, width, height, source, created_at",
      )
      .eq("post_id", post.id);
    post.assets = await attachSignedUrls(
      admin,
      (assets ?? []).map((a) => ({
        id: a.id,
        post_id: a.post_id,
        kind: a.kind as SocialAsset["kind"],
        mime_type: a.mime_type,
        storage_path: a.storage_path,
        file_name: a.file_name,
        file_size: a.file_size,
        width: a.width,
        height: a.height,
        source: a.source as SocialAsset["source"],
        created_at: a.created_at,
      })),
    );
    const [withQueue] = await attachLatestQueue(admin, [post]);
    return { ok: true, post: withQueue };
  }

  const aiSuggestion = finalizeCaption({
    body: buildAiCaptionSuggestion({
      date,
      holiday,
      brand: settings.brand,
      ctas: settings.ctas,
    }),
    phone: settings.phone,
    phoneSecondary: settings.phone_secondary,
    address: settings.address,
    includeHashtags: false,
  });

  const scheduledAt = options?.immediate
    ? new Date().toISOString()
    : jerusalemDateTimeToIso(date, settings.default_publish_time);

  const { data, error } = await admin
    .from("social_posts")
    .insert({
      scheduled_at: scheduledAt,
      status: "draft",
      caption: "",
      ai_suggestion: aiSuggestion,
      holiday_key: holiday?.key ?? null,
      platforms: settings.platforms,
      formats: ["feed"],
      include_image_text: true,
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select(POST_COLS)
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "יצירת פוסט נכשלה" };
  }

  revalidatePath(REVALIDATE);
  return { ok: true, post: { ...mapPost(data as Record<string, unknown>), assets: [] } };
}

export async function updateSocialPost(input: {
  postId: string;
  caption?: string;
  captionLocked?: boolean;
  userNotes?: string;
  formats?: SocialFormat[];
  platforms?: SocialPlatform[];
  publishTime?: string;
  publishDate?: string;
  includeImageText?: boolean;
  imageRevisionNotes?: string;
  aiSuggestion?: string;
  status?: "draft" | "pending_review";
}): Promise<SocialMutationResult> {
  const profile = await requireProfile();
  const admin = createAdminClient();

  const { data: current } = await admin
    .from("social_posts")
    .select("status, caption_locked, scheduled_at")
    .eq("id", input.postId)
    .single();

  if (!current) return { ok: false, error: "פוסט לא נמצא" };
  if (["scheduled", "publishing", "published"].includes(current.status)) {
    return { ok: false, error: "פוסט מאושר — החזירו לטיוטה לפני עריכה" };
  }

  const settings = await loadSettings(admin);
  const patch: Record<string, unknown> = { updated_by: profile.id };

  if (input.publishDate && input.publishTime) {
    patch.scheduled_at = jerusalemDateTimeToIso(
      input.publishDate,
      input.publishTime,
    );
  } else if (input.publishTime) {
    const date = isoToJerusalemDate(String(current.scheduled_at));
    patch.scheduled_at = jerusalemDateTimeToIso(date, input.publishTime);
  }

  if (input.formats) patch.formats = input.formats;
  if (input.platforms) patch.platforms = input.platforms;
  if (input.includeImageText != null) patch.include_image_text = input.includeImageText;
  if (input.userNotes != null) patch.user_notes = input.userNotes;
  if (input.imageRevisionNotes != null) {
    patch.image_revision_notes = input.imageRevisionNotes;
  }
  if (input.aiSuggestion != null) patch.ai_suggestion = input.aiSuggestion;
  if (input.status) patch.status = input.status;

  if (input.caption != null && !current.caption_locked) {
    const check = checkForbiddenPhrases(input.caption, settings.forbidden_phrases);
    if (!check.ok) {
      return { ok: false, error: forbiddenErrorMessage(check.matches) };
    }
    patch.caption = input.caption;
  }

  if (input.captionLocked != null) {
    patch.caption_locked = input.captionLocked;
    if (input.captionLocked && input.caption != null) {
      patch.ai_suggestion = null;
    }
  }

  const { error } = await admin
    .from("social_posts")
    .update(patch)
    .eq("id", input.postId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(REVALIDATE);
  return { ok: true, id: input.postId };
}

export async function refreshAiSuggestion(
  postId: string,
  input?: { idea?: string; source?: "auto" | "idea"; includeHashtags?: boolean },
): Promise<SocialMutationResult & { suggestion?: string }> {
  await requireProfile();
  const admin = createAdminClient();
  const settings = await loadSettings(admin);

  const { data: post } = await admin
    .from("social_posts")
    .select("scheduled_at, caption_locked, user_notes, holiday_key, status")
    .eq("id", postId)
    .single();

  if (!post) return { ok: false, error: "פוסט לא נמצא" };
  if (post.caption_locked) {
    return { ok: false, error: "הטקסט נעול — AI לא משנה תוכן משתמש" };
  }
  if (["scheduled", "publishing", "published"].includes(post.status)) {
    return { ok: false, error: "פוסט מאושר — לא ניתן לרענן המלצה" };
  }

  const source = input?.source ?? "auto";
  const idea = (input?.idea ?? "").trim();
  if (source === "idea" && !idea) {
    return { ok: false, error: "כתבו קודם את הרעיון לשדה «הרעיון שלי»" };
  }

  const date = isoToJerusalemDate(post.scheduled_at);
  const [y, m] = date.split("-").map(Number);
  const holiday = await getHolidayForDate(y, m, date);

  const suggestion = await composeSocialCaption({
    date,
    source,
    idea: source === "idea" ? idea : null,
    holiday: source === "auto" ? holiday : null,
    brand: settings.brand,
    ctas: settings.ctas,
    toneGuidelines: settings.tone_guidelines,
    forbiddenPhrases: settings.forbidden_phrases,
    phone: settings.phone,
    phoneSecondary: settings.phone_secondary,
    address: settings.address,
    includeHashtags: Boolean(input?.includeHashtags),
  });

  const check = checkForbiddenPhrases(suggestion, settings.forbidden_phrases);
  if (!check.ok) {
    return { ok: false, error: forbiddenErrorMessage(check.matches) };
  }

  const patch: Record<string, unknown> = { ai_suggestion: suggestion };
  if (source === "idea") patch.user_notes = idea;

  const { error } = await admin
    .from("social_posts")
    .update(patch)
    .eq("id", postId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(REVALIDATE);
  return { ok: true, id: postId, suggestion };
}

export async function approveSocialPost(
  postId: string,
  options?: { immediate?: boolean },
): Promise<SocialMutationResult> {
  const profile = await requireProfile();
  const admin = createAdminClient();
  const settings = await loadSettings(admin);

  const { data: post } = await admin
    .from("social_posts")
    .select(POST_COLS)
    .eq("id", postId)
    .single();

  if (!post) return { ok: false, error: "פוסט לא נמצא" };

  const caption =
    post.caption?.trim() ||
    post.ai_suggestion?.trim() ||
    "";

  if (!caption) {
    return { ok: false, error: "נדרש טקסט לפוסט לפני אישור" };
  }

  const check = checkForbiddenPhrases(caption, settings.forbidden_phrases);
  if (!check.ok) {
    return { ok: false, error: forbiddenErrorMessage(check.matches) };
  }

  if (!post.formats?.length) {
    return { ok: false, error: "בחרו לפחות פורמט אחד (פיד / סטורי)" };
  }

  const now = new Date().toISOString();
  // Immediate: due immediately (UTC now). Scheduled: keep Jerusalem wall-clock instant.
  const scheduledAt = options?.immediate ? now : post.scheduled_at;

  const { error: updErr } = await admin
    .from("social_posts")
    .update({
      status: "scheduled",
      caption,
      scheduled_at: scheduledAt,
      approved_at: now,
      approved_by: profile.id,
      updated_by: profile.id,
    })
    .eq("id", postId);

  if (updErr) return { ok: false, error: updErr.message };

  await admin
    .from("social_publish_queue")
    .update({ status: "cancelled" })
    .eq("post_id", postId)
    .in("status", ["pending", "claimed"]);

  const { error: qErr } = await admin.from("social_publish_queue").insert({
    post_id: postId,
    status: "pending",
    scheduled_for: scheduledAt,
    trigger: options?.immediate ? "immediate" : "scheduled",
  });

  if (qErr) return { ok: false, error: qErr.message };

  revalidatePath(REVALIDATE);
  return { ok: true, id: postId };
}

export async function revertSocialPostToDraft(
  postId: string,
): Promise<SocialMutationResult> {
  await requireProfile();
  const admin = createAdminClient();

  const { error } = await admin
    .from("social_posts")
    .update({
      status: "draft",
      approved_at: null,
      approved_by: null,
    })
    .eq("id", postId);

  if (error) return { ok: false, error: error.message };

  await admin
    .from("social_publish_queue")
    .update({ status: "cancelled" })
    .eq("post_id", postId)
    .in("status", ["pending", "claimed"]);

  revalidatePath(REVALIDATE);
  return { ok: true, id: postId };
}

export async function deleteSocialPost(
  postId: string,
): Promise<SocialMutationResult> {
  await requireProfile();
  const admin = createAdminClient();

  const { data: post } = await admin
    .from("social_posts")
    .select("id, status")
    .eq("id", postId)
    .maybeSingle();

  if (!post) return { ok: false, error: "פוסט לא נמצא" };

  if (["scheduled", "publishing", "published"].includes(post.status)) {
    return {
      ok: false,
      error: "פוסט מאושר/פורסם — החזירו לטיוטה לפני מחיקה",
    };
  }

  const { data: assets } = await admin
    .from("social_assets")
    .select("storage_path")
    .eq("post_id", postId);

  const paths = (assets ?? [])
    .map((a) => a.storage_path)
    .filter((p): p is string => Boolean(p));

  if (paths.length > 0) {
    await admin.storage.from(SOCIAL_STORAGE_BUCKET).remove(paths);
  }

  await admin
    .from("social_publish_queue")
    .update({ status: "cancelled" })
    .eq("post_id", postId)
    .in("status", ["pending", "claimed"]);

  const { error } = await admin.from("social_posts").delete().eq("id", postId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(REVALIDATE);
  return { ok: true, id: postId };
}

export async function uploadSocialMedia(
  formData: FormData,
): Promise<SocialMutationResult> {
  const profile = await requireProfile();
  const admin = createAdminClient();

  const postId = String(formData.get("postId") ?? "");
  const kind = String(formData.get("kind") ?? "original") as SocialAsset["kind"];
  const file = formData.get("file");

  if (!postId || !(file instanceof File)) {
    return { ok: false, error: "קובץ או פוסט חסרים" };
  }

  const { data: post } = await admin
    .from("social_posts")
    .select("status, media_mode")
    .eq("id", postId)
    .single();

  if (!post) return { ok: false, error: "פוסט לא נמצא" };
  if (["scheduled", "publishing", "published"].includes(post.status)) {
    return { ok: false, error: "פוסט מאושר — החזירו לטיוטה לפני העלאה" };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `${postId}/${kind}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await admin.storage
    .from(SOCIAL_STORAGE_BUCKET)
    .upload(path, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (upErr) return { ok: false, error: upErr.message };

  if (kind === "original" || kind === "reference") {
    await admin.from("social_assets").delete().eq("post_id", postId).eq("kind", kind);
  }

  const { error: insErr } = await admin.from("social_assets").insert({
    post_id: postId,
    kind,
    mime_type: file.type || null,
    storage_path: path,
    file_name: file.name,
    file_size: file.size,
    source: "upload",
  });

  if (insErr) return { ok: false, error: insErr.message };

  if (kind === "original") {
    await admin
      .from("social_posts")
      .update({
        media_mode: "user_upload",
        updated_by: profile.id,
      })
      .eq("id", postId);
  }

  revalidatePath(REVALIDATE);
  return { ok: true, id: postId };
}

export async function generateSocialPostImage(
  postId: string,
): Promise<SocialMutationResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "נדרשת התחברות" };
  const admin = createAdminClient();
  const settings = await loadSettings(admin);
  const agentId = await getAgentId(admin);

  const { data: post } = await admin
    .from("social_posts")
    .select(POST_COLS)
    .eq("id", postId)
    .single();

  if (!post) return { ok: false, error: "פוסט לא נמצא" };
  if (post.media_mode === "user_upload") {
    return { ok: false, error: "הועלה קובץ משתמש — AI לא משנה מדיה" };
  }
  if (["scheduled", "publishing", "published"].includes(post.status)) {
    return { ok: false, error: "פוסט מאושר — החזירו לטיוטה" };
  }

  const caption =
    post.caption?.trim() ||
    post.ai_suggestion?.trim() ||
    "";

  const plan = await planSocialImage({
    caption,
    userNotes: post.user_notes,
    includeImageText: post.include_image_text,
    revisionNotes: post.image_revision_notes,
    seed: String(post.scheduled_at ?? post.id),
  });

  const prompt = buildImagePrompt({
    caption,
    includeImageText: post.include_image_text,
    revisionNotes: post.image_revision_notes,
    brand: settings.brand,
    phone: settings.phone,
    seed: String(post.scheduled_at ?? post.id),
    plan,
  });

  let runId: string | null = null;
  if (agentId) {
    const { data: run } = await admin
      .from("agent_runs")
      .insert({
        agent_id: agentId,
        trigger: "ui_image_gen",
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    runId = run?.id ?? null;
  }

  try {
    const { data: refAssets } = await admin
      .from("social_assets")
      .select("storage_path")
      .eq("post_id", postId)
      .eq("kind", "reference")
      .limit(1);

    let referenceBuffer: Buffer | null = null;
    if (refAssets?.[0]?.storage_path) {
      const { data: refFile } = await admin.storage
        .from(SOCIAL_STORAGE_BUCKET)
        .download(refAssets[0].storage_path);
      if (refFile) {
        referenceBuffer = Buffer.from(await refFile.arrayBuffer());
      }
    }

    const requestedFormats = (Array.isArray(post.formats) ? post.formats : [])
      .filter((f): f is "feed" | "story" => f === "feed" || f === "story");
    const formats = requestedFormats.length ? requestedFormats : (["feed"] as const);

    const images = await generateSocialImages({
      prompt,
      referenceBuffer,
      formats: [...formats],
    });

    const kinds = (["feed", "story"] as const).filter((kind) => images[kind]);
    if (kinds.length === 0) {
      throw new Error("OpenAI לא החזיר תמונות");
    }

    for (const kind of kinds) {
      const img = images[kind];
      if (!img) continue;
      const storagePath = `${postId}/${kind}-ai-${Date.now()}.png`;
      await admin.storage.from(SOCIAL_STORAGE_BUCKET).upload(storagePath, img.buffer, {
        contentType: img.mimeType,
        upsert: true,
      });
      await admin.from("social_assets").delete().eq("post_id", postId).eq("kind", kind);
      await admin.from("social_assets").insert({
        post_id: postId,
        kind,
        mime_type: img.mimeType,
        storage_path: storagePath,
        file_name: `${kind}.png`,
        file_size: img.buffer.length,
        width: img.width,
        height: img.height,
        source: "ai",
      });
    }

    await admin
      .from("social_posts")
      .update({
        media_mode: "ai_generated",
        image_prompt: prompt,
        updated_by: profile.id,
      })
      .eq("id", postId);

    if (agentId && runId) {
      await admin.from("agent_costs").insert({
        run_id: runId,
        agent_id: agentId,
        service: "openai_images",
        units: kinds.length,
        unit_type: "images",
        cost_usd: OPENAI_IMAGE_ESTIMATED_COST_USD * kinds.length,
      });
      await admin
        .from("agent_runs")
        .update({
          status: "success",
          finished_at: new Date().toISOString(),
          cost_usd: OPENAI_IMAGE_ESTIMATED_COST_USD * kinds.length,
          items_processed: 1,
        })
        .eq("id", runId);
    }
  } catch (err) {
    if (agentId && runId) {
      await admin
        .from("agent_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error_message: err instanceof Error ? err.message : "Image gen failed",
        })
        .eq("id", runId);
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "ג׳נרוט תמונה נכשל",
    };
  }

  revalidatePath(REVALIDATE);
  return { ok: true, id: postId };
}

export async function updateSocialSettings(input: {
  forbiddenPhrases?: string[];
  toneGuidelines?: string;
  visualLanguage?: string;
  phone?: string;
  phoneSecondary?: string;
  email?: string;
  address?: string;
  licenseNumber?: string;
  defaultPublishTime?: string;
  platforms?: SocialPlatform[];
}): Promise<SocialMutationResult> {
  const profile = await requireProfile();
  const admin = createAdminClient();
  const settings = await loadSettings(admin);

  const patch: Record<string, unknown> = { updated_by: profile.id };
  if (input.forbiddenPhrases) patch.forbidden_phrases = input.forbiddenPhrases;
  if (input.toneGuidelines != null) patch.tone_guidelines = input.toneGuidelines;
  if (input.visualLanguage != null) {
    patch.brand = {
      ...settings.brand,
      visualLanguage: input.visualLanguage,
    };
  }
  if (input.phone != null) patch.phone = input.phone || null;
  if (input.phoneSecondary != null) {
    patch.phone_secondary = input.phoneSecondary || null;
  }
  if (input.email != null) patch.email = input.email || null;
  if (input.address != null) patch.address = input.address || null;
  if (input.licenseNumber != null) patch.license_number = input.licenseNumber || null;
  if (input.defaultPublishTime) patch.default_publish_time = input.defaultPublishTime;
  if (input.platforms) patch.platforms = input.platforms;

  const { error } = await admin
    .from("social_settings")
    .update(patch)
    .eq("id", settings.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath(REVALIDATE);
  return { ok: true };
}

export async function updateInboxStatus(
  inboxId: string,
  status: InboxStatus,
): Promise<SocialMutationResult> {
  await requireProfile();
  const admin = createAdminClient();
  const { error } = await admin
    .from("social_inbox")
    .update({ status })
    .eq("id", inboxId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(REVALIDATE);
  return { ok: true, id: inboxId };
}

export async function validateCaptionText(
  text: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireProfile();
  const admin = createAdminClient();
  const settings = await loadSettings(admin);
  const check = checkForbiddenPhrases(text, settings.forbidden_phrases);
  if (!check.ok) return { ok: false, error: forbiddenErrorMessage(check.matches) };
  return { ok: true };
}
