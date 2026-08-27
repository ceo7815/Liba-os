"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Send,
  Share2,
  ThumbsUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PLATFORM_LABELS } from "@/lib/social-media/constants";
import type {
  SocialFormat,
  SocialPlatform,
  SocialSettings,
} from "@/lib/social-media/types";
import { cn } from "@/lib/utils";

type PreviewTab = SocialPlatform;
type FormatTab = SocialFormat;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caption: string;
  platforms: SocialPlatform[];
  formats: SocialFormat[];
  publishTime: string;
  feedImageUrl?: string | null;
  storyImageUrl?: string | null;
  settings: SocialSettings;
  missingContact?: boolean;
};

function BrandAvatar({
  logoPath,
  name,
  size = "md",
}: {
  logoPath: string;
  name: string;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-black/10",
        dim,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoPath} alt={name} className="h-[70%] w-[70%] object-contain" />
    </span>
  );
}

function FacebookFeedPreview({
  caption,
  imageUrl,
  brandName,
  logoPath,
  publishTime,
}: {
  caption: string;
  imageUrl?: string | null;
  brandName: string;
  logoPath: string;
  publishTime: string;
}) {
  return (
    <article
      dir="rtl"
      className="mx-auto w-full max-w-[480px] overflow-hidden rounded-xl border border-[#ccd0d5] bg-white text-[#050505] shadow-sm"
    >
      <header className="flex items-start gap-3 px-3 pb-2 pt-3">
        <BrandAvatar logoPath={logoPath} name={brandName} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold leading-tight">{brandName}</p>
          <p className="mt-0.5 text-[12px] text-[#65676b]">
            {publishTime ? `היום בשעה ${publishTime}` : "פרסום מיידי"} · 🌐
          </p>
        </div>
        <MoreHorizontal className="mt-1 h-5 w-5 text-[#65676b]" />
      </header>

      {caption.trim() ? (
        <p className="whitespace-pre-wrap px-3 pb-3 text-[15px] leading-[1.45] [overflow-wrap:anywhere]">
          {caption}
        </p>
      ) : (
        <p className="px-3 pb-3 text-[15px] text-[#65676b]">אין טקסט עדיין</p>
      )}

      <div className="border-y border-[#ccd0d5] bg-[#f0f2f5]">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="תצוגת פיד פייסבוק"
            className="aspect-square w-full object-cover"
          />
        ) : (
          <div className="flex aspect-square items-center justify-center text-sm text-[#65676b]">
            אין מדיה לפיד
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-3 py-2.5 text-[13px] text-[#65676b]">
        <span className="inline-flex items-center gap-1">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#1877f2] text-[9px] text-white">
            👍
          </span>
          לייקים
        </span>
        <span>תגובות · שיתופים</span>
      </div>

      <div className="grid grid-cols-3 border-t border-[#ccd0d5] px-1 py-1 text-[13px] font-semibold text-[#65676b]">
        <button
          type="button"
          className="inline-flex items-center justify-center gap-1.5 rounded-md py-2 hover:bg-[#f0f2f5]"
        >
          <ThumbsUp className="h-4 w-4" /> לייק
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-1.5 rounded-md py-2 hover:bg-[#f0f2f5]"
        >
          <MessageCircle className="h-4 w-4" /> תגובה
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-1.5 rounded-md py-2 hover:bg-[#f0f2f5]"
        >
          <Share2 className="h-4 w-4" /> שיתוף
        </button>
      </div>
    </article>
  );
}

function InstagramFeedPreview({
  caption,
  imageUrl,
  brandName,
  logoPath,
}: {
  caption: string;
  imageUrl?: string | null;
  brandName: string;
  logoPath: string;
}) {
  return (
    <article
      dir="ltr"
      className="mx-auto w-full max-w-[420px] overflow-hidden rounded-xl border border-[#dbdbdb] bg-white text-[#262626] shadow-sm"
    >
      <header className="flex items-center gap-3 px-3 py-2.5">
        <span className="rounded-full bg-gradient-to-tr from-[#f58529] via-[#dd2a7b] to-[#8134af] p-[2px]">
          <span className="block rounded-full bg-white p-[2px]">
            <BrandAvatar logoPath={logoPath} name={brandName} size="sm" />
          </span>
        </span>
        <div className="min-w-0 flex-1 text-start">
          <p className="truncate text-sm font-semibold">{brandName}</p>
        </div>
        <MoreHorizontal className="h-5 w-5" />
      </header>

      <div className="bg-[#fafafa]">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="תצוגת פיד אינסטגרם"
            className="aspect-square w-full object-cover"
          />
        ) : (
          <div className="flex aspect-square items-center justify-center text-sm text-[#8e8e8e]">
            אין מדיה לפיד
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-4">
          <Heart className="h-6 w-6" />
          <MessageCircle className="h-6 w-6" />
          <Send className="h-6 w-6" />
        </div>
        <Bookmark className="h-6 w-6" />
      </div>

      <div dir="rtl" className="space-y-1.5 px-3 pb-4 text-sm">
        <p className="font-semibold">{brandName}</p>
        {caption.trim() ? (
          <p className="whitespace-pre-wrap leading-[1.45] [overflow-wrap:anywhere]">
            {caption}
          </p>
        ) : (
          <p className="text-[#8e8e8e]">אין טקסט עדיין</p>
        )}
      </div>
    </article>
  );
}

function StoryPreview({
  platform,
  imageUrl,
  brandName,
  logoPath,
}: {
  platform: PreviewTab;
  imageUrl?: string | null;
  brandName: string;
  logoPath: string;
}) {
  const isIg = platform === "instagram";
  return (
    <div
      dir="ltr"
      className={cn(
        "relative mx-auto aspect-[9/16] w-full max-w-[320px] overflow-hidden rounded-[1.75rem] border shadow-xl",
        isIg ? "border-zinc-800 bg-black" : "border-[#1877f2]/30 bg-[#18191a]",
      )}
    >
      <div className="absolute inset-x-3 top-3 z-20 flex gap-1">
        <span className="h-0.5 flex-1 rounded-full bg-white/90" />
        <span className="h-0.5 flex-1 rounded-full bg-white/35" />
      </div>

      <div className="absolute inset-x-3 top-6 z-20 flex items-center gap-2">
        <BrandAvatar logoPath={logoPath} name={brandName} size="sm" />
        <p className="truncate text-sm font-semibold text-white drop-shadow">
          {brandName}
        </p>
        <span className="text-xs text-white/70">עכשיו</span>
      </div>

      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt="תצוגת סטורי"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/60">
          אין מדיה לסטורי
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 to-transparent px-4 pb-5 pt-16">
        <div className="flex items-center gap-2 rounded-full border border-white/30 bg-black/20 px-3 py-2 text-sm text-white/80">
          שליחת הודעה…
        </div>
      </div>
    </div>
  );
}

export function PlatformPreviewDialog({
  open,
  onOpenChange,
  caption,
  platforms,
  formats,
  publishTime,
  feedImageUrl,
  storyImageUrl,
  settings,
  missingContact = false,
}: Props) {
  const availablePlatforms = useMemo(() => {
    const ordered: SocialPlatform[] = ["facebook_page", "instagram"];
    return ordered.filter((p) => platforms.includes(p));
  }, [platforms]);

  const availableFormats = useMemo(() => {
    const ordered: SocialFormat[] = ["feed", "story"];
    return ordered.filter((f) => formats.includes(f));
  }, [formats]);

  const [platformTab, setPlatformTab] = useState<PreviewTab>(
    availablePlatforms[0] ?? "facebook_page",
  );
  const [formatTab, setFormatTab] = useState<FormatTab>(
    availableFormats[0] ?? "feed",
  );

  useEffect(() => {
    if (!open) return;
    setPlatformTab(availablePlatforms[0] ?? "facebook_page");
    setFormatTab(availableFormats[0] ?? "feed");
    // Reset only when dialog opens or selection set changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, platforms.join("|"), formats.join("|")]);

  const brandName = settings.brand.name || "ליבה";
  const logoPath = settings.brand.logoPath || "/brand/liba-logo.png";

  // Keep tabs in sync when selection changes
  const safePlatform =
    availablePlatforms.includes(platformTab)
      ? platformTab
      : (availablePlatforms[0] ?? "facebook_page");
  const safeFormat =
    availableFormats.includes(formatTab)
      ? formatTab
      : (availableFormats[0] ?? "feed");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "z-[60] flex max-h-[94vh] w-[min(96vw,56rem)] max-w-[56rem] flex-col gap-0 overflow-hidden rounded-2xl p-0 shadow-2xl",
        )}
      >
        <DialogHeader className="shrink-0 space-y-3 border-b border-black/[0.06] px-5 py-4 pe-12 text-start sm:px-6">
          <DialogTitle className="text-lg">תצוגה מקדימה במסך מלא</DialogTitle>
          {missingContact && (
            <p className="text-[12px] text-amber-700">
              טלפון/כתובת חסרים — מלאו ושמרו בטאב «הגדרות» שני טלפונים וכתובת כדי שיופיעו בסוף הכיתוב (📞 📞 📍).
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {availablePlatforms.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlatformTab(p)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                  safePlatform === p
                    ? p === "instagram"
                      ? "bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white"
                      : "bg-[#1877f2] text-white"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {PLATFORM_LABELS[p]}
              </button>
            ))}
          </div>
          {availableFormats.length > 1 && (
            <div className="inline-flex rounded-lg border border-black/[0.08] bg-muted/40 p-0.5">
              {availableFormats.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormatTab(f)}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                    safeFormat === f
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f === "feed" ? "פיד" : "סטורי"}
                </button>
              ))}
            </div>
          )}
        </DialogHeader>

        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8",
            safeFormat === "story" ? "bg-zinc-950" : "bg-[#f0f2f5]",
          )}
        >
          {availablePlatforms.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              לא נבחרו פלטפורמות לתצוגה
            </p>
          ) : safeFormat === "story" ? (
            <StoryPreview
              platform={safePlatform}
              imageUrl={storyImageUrl}
              brandName={brandName}
              logoPath={logoPath}
            />
          ) : safePlatform === "instagram" ? (
            <InstagramFeedPreview
              caption={caption}
              imageUrl={feedImageUrl}
              brandName={brandName}
              logoPath={logoPath}
            />
          ) : (
            <FacebookFeedPreview
              caption={caption}
              imageUrl={feedImageUrl}
              brandName={brandName}
              logoPath={logoPath}
              publishTime={publishTime}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
