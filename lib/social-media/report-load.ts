import { createAdminClient } from "@/lib/supabase/admin";
import { SOCIAL_STORAGE_BUCKET, STATUS_LABELS } from "@/lib/social-media/constants";
import { jerusalemDateTimeToIso } from "@/lib/social-media/scheduling";
import type {
  SocialAsset,
  SocialFormat,
  SocialPlatform,
  SocialPost,
  SocialPostStatus,
} from "@/lib/social-media/types";

const POST_COLS =
  "id, scheduled_at, status, caption, caption_locked, media_mode, platforms, formats, include_image_text, holiday_key, ai_suggestion, user_notes, image_prompt, image_revision_notes, approved_at, approved_by, published_at, meta_ids, analytics, error, created_at, updated_at";

export type SocialReportPost = {
  id: string;
  date: string;
  time: string;
  dateLabel: string;
  status: SocialPost["status"];
  statusLabel: string;
  platforms: SocialPlatform[];
  formats: SocialFormat[];
  caption: string;
  feedUrl: string | null;
  storyUrl: string | null;
};

export type SocialReportData = {
  from: string;
  to: string;
  brandName: string;
  posts: SocialReportPost[];
};

function dateLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jerusalem",
  });
}

function displayCaption(row: {
  caption?: string | null;
  caption_locked?: boolean;
  ai_suggestion?: string | null;
}) {
  if (row.caption_locked && row.caption?.trim()) return row.caption.trim();
  return (row.caption?.trim() || row.ai_suggestion?.trim() || "").trim();
}

export async function loadSocialReportData(
  from: string,
  to: string,
): Promise<SocialReportData> {
  const admin = createAdminClient();
  const start = jerusalemDateTimeToIso(from, "00:00");
  const end = jerusalemDateTimeToIso(to, "23:59");

  const { data: rows } = await admin
    .from("social_posts")
    .select(POST_COLS)
    .gte("scheduled_at", start)
    .lte("scheduled_at", end)
    .neq("status", "skipped")
    .order("scheduled_at");

  const { data: settings } = await admin
    .from("social_settings")
    .select("brand")
    .limit(1)
    .maybeSingle();

  const brandName =
    settings && typeof settings.brand === "object" && settings.brand
      ? String((settings.brand as { name?: string }).name ?? "ליבה ביטוח ופיננסים")
      : "ליבה ביטוח ופיננסים";

  const list = rows ?? [];
  const ids = list.map((row) => String(row.id));
  const assetsByPost = new Map<string, SocialAsset[]>();

  if (ids.length > 0) {
    const { data: assets } = await admin
      .from("social_assets")
      .select("id, post_id, kind, mime_type, storage_path, file_name, file_size, width, height, source, created_at")
      .in("post_id", ids);

    const signedRows = await Promise.all(
      (assets ?? []).map(async (row) => {
        const { data: signed } = await admin.storage
          .from(SOCIAL_STORAGE_BUCKET)
          .createSignedUrl(String(row.storage_path), 60 * 60 * 24);
        return { row, url: signed?.signedUrl ?? null };
      }),
    );

    for (const { row, url } of signedRows) {
      const postId = String(row.post_id);
      const asset: SocialAsset = {
        id: String(row.id),
        post_id: postId,
        kind: row.kind as SocialAsset["kind"],
        mime_type: row.mime_type,
        storage_path: String(row.storage_path),
        file_name: String(row.file_name),
        file_size: row.file_size,
        width: row.width,
        height: row.height,
        source: row.source as SocialAsset["source"],
        created_at: String(row.created_at),
        signed_url: url,
      };
      const bucket = assetsByPost.get(postId) ?? [];
      bucket.push(asset);
      assetsByPost.set(postId, bucket);
    }
  }

  const posts: SocialReportPost[] = list.map((row) => {
    const assets = assetsByPost.get(String(row.id)) ?? [];
    const feed =
      assets.find((a) => a.kind === "feed") ??
      assets.find((a) => a.kind === "feed_tall") ??
      assets.find((a) => a.kind === "original");
    const story = assets.find((a) => a.kind === "story");
    const scheduled = String(row.scheduled_at);
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jerusalem",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(scheduled));
    const time = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jerusalem",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(scheduled));

    return {
      id: String(row.id),
      date,
      time,
      dateLabel: dateLabel(date),
      status: row.status as SocialPost["status"],
      statusLabel:
        STATUS_LABELS[row.status as SocialPostStatus] ?? String(row.status),
      platforms: (row.platforms ?? []) as SocialPlatform[],
      formats: (row.formats ?? []) as SocialFormat[],
      caption: displayCaption(row),
      feedUrl: feed?.signed_url ?? null,
      storyUrl: story?.signed_url ?? null,
    };
  });

  return { from, to, brandName, posts };
}
