import { DEFAULT_VISUAL_LANGUAGE } from "@/lib/social-media/brand-visual";
import type { SocialPost, SocialPostStatus } from "@/lib/social-media/types";

export const JERUSALEM_TZ = "Asia/Jerusalem";
export const DEFAULT_PUBLISH_TIME = "10:00";
export const SOCIAL_STORAGE_BUCKET = "social-media";

export const STATUS_LABELS: Record<SocialPostStatus, string> = {
  draft: "טיוטה",
  pending_review: "ממתין לאישור",
  scheduled: "מאושר / מתוזמן",
  publishing: "מפרסם",
  published: "פורסם",
  failed: "נכשל",
  skipped: "דולג",
};

export const CELL_STATUS_LABELS: Record<SocialPostStatus, string> = {
  draft: "טיוטה",
  pending_review: "ממתין",
  scheduled: "אושרה",
  publishing: "מפרסם",
  published: "פורסמה",
  failed: "נכשלה",
  skipped: "דולג",
};

export const STATUS_DOT_CLASS: Record<SocialPostStatus, string> = {
  draft: "bg-amber-500",
  pending_review: "bg-orange-500",
  scheduled: "bg-emerald-600",
  publishing: "bg-sky-500",
  published: "bg-blue-600",
  failed: "bg-red-600",
  skipped: "bg-zinc-400",
};

/** Calendar cell chip colors — distinct per status */
export const STATUS_BADGE_CLASS: Record<SocialPostStatus, string> = {
  draft: "bg-amber-100 text-amber-900 ring-1 ring-amber-200/80",
  pending_review: "bg-orange-100 text-orange-900 ring-1 ring-orange-200/80",
  scheduled: "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/80",
  publishing: "bg-sky-100 text-sky-900 ring-1 ring-sky-200/80",
  published: "bg-blue-100 text-blue-900 ring-1 ring-blue-200/80",
  failed: "bg-red-100 text-red-900 ring-1 ring-red-200/80",
  skipped: "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200/80",
};

export function isImmediatePost(post: Pick<SocialPost, "queue_trigger">) {
  return post.queue_trigger === "immediate";
}

export function postShowsScheduleClock(post: Pick<SocialPost, "queue_trigger">) {
  return post.queue_trigger !== "immediate";
}

export function postStatusLabel(post: SocialPost): string {
  if (post.status === "published") return STATUS_LABELS.published;
  if (isImmediatePost(post)) {
    if (post.status === "publishing" || post.queue_status === "claimed") {
      return "מפרסם";
    }
    if (post.status === "failed" || post.queue_status === "failed") {
      return STATUS_LABELS.failed;
    }
    if (post.status === "scheduled" || post.queue_status === "pending") {
      return "בתור לפרסום מיידי";
    }
  }
  return STATUS_LABELS[post.status];
}

export function postCellStatusLabel(post: SocialPost): string {
  if (post.status === "published") return CELL_STATUS_LABELS.published;
  if (isImmediatePost(post)) {
    if (post.status === "publishing" || post.queue_status === "claimed") {
      return "מפרסם";
    }
    if (post.status === "failed" || post.queue_status === "failed") {
      return CELL_STATUS_LABELS.failed;
    }
    if (post.status === "scheduled" || post.queue_status === "pending") {
      return "בתור מיידי";
    }
  }
  return CELL_STATUS_LABELS[post.status];
}

export function postBadgeClass(post: SocialPost): string {
  if (
    isImmediatePost(post) &&
    (post.status === "scheduled" || post.status === "publishing")
  ) {
    return STATUS_BADGE_CLASS.publishing;
  }
  return STATUS_BADGE_CLASS[post.status];
}

export function postDotClass(post: SocialPost): string {
  if (isImmediatePost(post) && post.status === "scheduled") {
    return STATUS_DOT_CLASS.publishing;
  }
  return STATUS_DOT_CLASS[post.status];
}

export const PLATFORM_LABELS = {
  facebook_page: "פייסבוק (עמוד)",
  instagram: "אינסטגרם",
} as const;

export const FORMAT_LABELS = {
  feed: "פיד",
  story: "סטורי",
} as const;

export const FORMAT_DIMENSIONS = {
  feed: { width: 1080, height: 1080, label: "1080×1080" },
  feed_tall: { width: 1080, height: 1350, label: "1080×1350" },
  story: { width: 1080, height: 1920, label: "1080×1920" },
} as const;

export const DEFAULT_FORBIDDEN = [
  "הכי זול",
  "מכוסה במאה אחוז",
  "מאושר לכולם",
  "ייעוץ אישי",
  "הבטחה מוחלטת",
  "ללא סיכון",
];

export const DEFAULT_BRAND = {
  name: "ליבה ביטוח ופיננסים",
  altName: "ליבה ביטוח ופנסיוני",
  /** Coral-red accent from liba-fs.co.il — not Liba OS yellow */
  primaryColor: "#C41E3A",
  /** Navy / charcoal from public brand site */
  secondaryColor: "#1B2A4A",
  logoPath: "/brand/liba-logo.png",
  website: "https://liba-fs.co.il",
  visualLanguage: DEFAULT_VISUAL_LANGUAGE,
};

export const DEFAULT_CTAS = [
  { label: "שיחת היכרות", url: "https://liba-fs.co.il/contact" },
  {
    label: "סורק הביטוח האישי",
    url: "https://liba-fs.co.il/tools/insurance-scan",
  },
];
