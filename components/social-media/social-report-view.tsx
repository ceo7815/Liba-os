"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { createSocialReportLink } from "@/app/actions/social-report";
import type { SocialReportData, SocialReportPost } from "@/lib/social-media/report-load";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function rangeLabel(from: string, to: string) {
  const fmt = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString("he-IL", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Jerusalem",
    });
  return from === to ? fmt(from) : `${fmt(from)} – ${fmt(to)}`;
}

function MediaFrame({
  label,
  url,
  planned,
  story,
}: {
  label: string;
  url: string | null;
  planned: boolean;
  story?: boolean;
}) {
  return (
    <figure className="min-w-0">
      <figcaption className="mb-1.5 text-[11px] font-semibold tracking-wide text-[#1B2A4A]">
        {label}
      </figcaption>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={label}
          className={cn(
            "w-full rounded-xl border border-black/[0.08] bg-white object-cover shadow-sm",
            story ? "aspect-[9/16] max-h-[28rem] object-contain bg-[#111]" : "aspect-square",
          )}
        />
      ) : (
        <div
          className={cn(
            "flex items-center justify-center rounded-xl border border-dashed border-black/15 bg-white/70 px-3 text-center text-xs text-muted-foreground",
            story ? "aspect-[9/16] max-h-[28rem]" : "aspect-square",
          )}
        >
          {planned ? "אין תמונה" : "לא מתוכנן"}
        </div>
      )}
    </figure>
  );
}

function PostCard({ post }: { post: SocialReportPost }) {
  const showFb = post.platforms.includes("facebook_page");
  const showIg = post.platforms.includes("instagram");
  const showStory = post.formats.includes("story");

  return (
    <article className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-sm">
      <header className="border-b border-black/[0.06] bg-[#F7F4EE] px-4 py-3">
        <p className="text-sm font-bold text-[#1B2A4A]">{post.dateLabel}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          שעת פרסום {post.time} · {post.statusLabel}
        </p>
      </header>
      <div className="space-y-4 p-4">
        <div>
          <p className="mb-1 text-[11px] font-semibold text-[#1B2A4A]">התוכן</p>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#1B2A4A] [overflow-wrap:anywhere]">
            {post.caption || "אין טקסט"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MediaFrame label="פייסבוק — פיד" url={showFb ? post.feedUrl : null} planned={showFb} />
          <MediaFrame label="אינסטגרם — פיד" url={showIg ? post.feedUrl : null} planned={showIg} />
          <div className="col-span-2 mx-auto w-full max-w-[220px]">
            <MediaFrame
              label="אינסטגרם — סטורי"
              url={showStory ? post.storyUrl : null}
              planned={showStory}
              story
            />
          </div>
        </div>
      </div>
    </article>
  );
}

export function SocialReportView({
  data,
  shareMode = "none",
  backHref,
}: {
  data: SocialReportData;
  shareMode?: "none" | "create-link" | "current-url";
  backHref?: string;
}) {
  const [copied, setCopied] = useState(false);
  const title = useMemo(
    () => rangeLabel(data.from, data.to),
    [data.from, data.to],
  );

  async function resolveShareUrl() {
    if (shareMode === "current-url") {
      return window.location.href;
    }
    const res = await createSocialReportLink(data.from, data.to);
    if (!res.ok) {
      toast.error(res.error);
      return null;
    }
    return res.url;
  }

  async function copyLink() {
    const url = await resolveShareUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("הקישור הועתק — אפשר לשלוח בואטסאפ");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.message(url);
    }
  }

  async function nativeShare() {
    const url = await resolveShareUrl();
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `דוח תזמון — ${data.brandName}`,
          text: `תזמון פוסטים ${title}`,
          url,
        });
        return;
      } catch {
        /* cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("הקישור הועתק");
    } catch {
      toast.message(url);
    }
  }

  const shareButtons = shareMode !== "none" ? (
    <div className="flex flex-wrap justify-center gap-2">
      <Button
        type="button"
        size="sm"
        className="bg-[#1B2A4A] text-white hover:bg-[#1B2A4A]/90"
        onClick={() => void copyLink()}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        העתק קישור פתוח
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => void nativeShare()}>
        <Share2 className="h-4 w-4" />
        שליחה
      </Button>
    </div>
  ) : null;

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-28 pt-6">
      {backHref ? (
        <div className="mb-4">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowRight className="h-4 w-4" />
            חזרה ליומן
          </Link>
        </div>
      ) : null}

      <header className="mb-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/liba-logo.png"
          alt={data.brandName}
          className="mx-auto h-12 w-auto"
        />
        <h1 className="mt-3 text-xl font-bold text-[#1B2A4A]">דוח תזמון רשתות</h1>
        <p className="mt-1 text-sm text-muted-foreground">{data.brandName}</p>
        <p className="mt-1 text-sm font-medium text-[#1B2A4A]">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {data.posts.length} פוסטים · שעון ישראל
        </p>
        {shareButtons ? (
          <div className={shareMode === "current-url" ? "mt-4 hidden sm:block" : "mt-4"}>
            {shareButtons}
          </div>
        ) : null}
      </header>

      {data.posts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-black/15 bg-white p-8 text-center text-sm text-muted-foreground">
          אין פוסטים בטווח הזה
        </p>
      ) : (
        <div className="space-y-5">
          {data.posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}

      {shareMode === "current-url" ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.08] bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
          {shareButtons}
        </div>
      ) : null}
    </div>
  );
}
