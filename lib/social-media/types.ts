export const SOCIAL_POST_STATUSES = [
  "draft",
  "pending_review",
  "scheduled",
  "publishing",
  "published",
  "failed",
  "skipped",
] as const;

export type SocialPostStatus = (typeof SOCIAL_POST_STATUSES)[number];

export const SOCIAL_PLATFORMS = ["facebook_page", "instagram"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const SOCIAL_FORMATS = ["feed", "story"] as const;
export type SocialFormat = (typeof SOCIAL_FORMATS)[number];

export const SOCIAL_ASSET_KINDS = [
  "feed",
  "story",
  "feed_tall",
  "original",
  "reference",
] as const;

export type SocialAssetKind = (typeof SOCIAL_ASSET_KINDS)[number];

export const SOCIAL_MEDIA_MODES = ["none", "user_upload", "ai_generated"] as const;
export type SocialMediaMode = (typeof SOCIAL_MEDIA_MODES)[number];

export const INBOX_STATUSES = ["new", "read", "handled"] as const;
export type InboxStatus = (typeof INBOX_STATUSES)[number];

export type SocialBrand = {
  name: string;
  altName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  logoPath?: string;
  website?: string;
  /** Visual design language (photography/layout). Separate from the logo file. */
  visualLanguage?: string;
};

export type SocialCta = { label: string; url: string };

export type SocialSettings = {
  id: string;
  brand: SocialBrand;
  tone_guidelines: string;
  forbidden_phrases: string[];
  default_publish_time: string;
  platforms: SocialPlatform[];
  phone: string | null;
  phone_secondary: string | null;
  email: string | null;
  address: string | null;
  license_number: string | null;
  ctas: SocialCta[];
  updated_at: string;
};

export type SocialAsset = {
  id: string;
  post_id: string;
  kind: SocialAssetKind;
  mime_type: string | null;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  width: number | null;
  height: number | null;
  source: "upload" | "ai";
  created_at: string;
  signed_url?: string | null;
};

export type SocialPost = {
  id: string;
  scheduled_at: string;
  status: SocialPostStatus;
  caption: string;
  caption_locked: boolean;
  media_mode: SocialMediaMode;
  platforms: SocialPlatform[];
  formats: SocialFormat[];
  include_image_text: boolean;
  holiday_key: string | null;
  ai_suggestion: string | null;
  user_notes: string | null;
  image_prompt: string | null;
  image_revision_notes: string | null;
  approved_at: string | null;
  approved_by: string | null;
  published_at: string | null;
  meta_ids: Record<string, unknown> | null;
  analytics: Record<string, unknown>;
  error: string | null;
  created_at: string;
  updated_at: string;
  assets?: SocialAsset[];
  /** Latest publish-queue row, if any. */
  queue_trigger?: "scheduled" | "immediate" | null;
  queue_status?: string | null;
  queue_error?: string | null;
};

export type SocialInboxItem = {
  id: string;
  platform: SocialPlatform;
  external_id: string;
  post_id: string | null;
  author_name: string | null;
  author_handle: string | null;
  body: string;
  received_at: string;
  status: InboxStatus;
};

export type SocialPostAnalytics = {
  post_id: string;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  link_clicks: number;
  story_views: number;
  new_followers: number;
  recorded_at: string;
};

export type HolidayDay = {
  date: string;
  key: string;
  label: string;
  topicHint: string;
};

export type ForbiddenCheckResult =
  | { ok: true }
  | { ok: false; matches: string[] };

export type SocialMutationResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export type SocialDashboardPayload = {
  settings: SocialSettings;
  posts: SocialPost[];
  inbox: SocialInboxItem[];
  runs: Array<{
    id: string;
    trigger: string;
    started_at: string;
    finished_at: string | null;
    status: string;
    items_processed: number | null;
    items_failed: number | null;
    cost_usd: number | null;
  }>;
  costs: Array<{
    id: string;
    service: string;
    units: number | null;
    unit_type: string | null;
    cost_usd: number;
    occurred_at: string;
  }>;
  monthlyCostUsd: number;
  agentId: string | null;
};
