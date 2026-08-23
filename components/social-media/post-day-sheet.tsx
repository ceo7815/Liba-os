"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Expand, Loader2, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  approveSocialPost,
  deleteSocialPost,
  getOrCreatePostForDate,
  refreshAiSuggestion,
  revertSocialPostToDraft,
  updateSocialPost,
  uploadSocialMedia,
  validateCaptionText,
} from "@/app/actions/social-media";
import { isoToJerusalemTime } from "@/lib/social-media/scheduling";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlatformPreviewDialog } from "@/components/social-media/platform-preview-dialog";
import {
  FORMAT_LABELS,
  PLATFORM_LABELS,
  STATUS_LABELS,
} from "@/lib/social-media/constants";
import { finalizeCaption } from "@/lib/social-media/caption-format";
import type {
  HolidayDay,
  SocialFormat,
  SocialPlatform,
  SocialPost,
  SocialSettings,
} from "@/lib/social-media/types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string | null;
  holiday: HolidayDay | null;
  settings: SocialSettings;
  existingPosts: SocialPost[];
  onSaved: () => void;
};

export function PostDaySheet({
  open,
  onOpenChange,
  date,
  holiday,
  settings,
  existingPosts,
  onSaved,
}: Props) {
  const [post, setPost] = useState<SocialPost | null>(null);
  const [loading, setLoading] = useState(false);
  const [caption, setCaption] = useState("");
  const [useAiText, setUseAiText] = useState(true);
  const [userNotes, setUserNotes] = useState("");
  const [publishTime, setPublishTime] = useState(settings.default_publish_time);
  const [formats, setFormats] = useState<SocialFormat[]>(["feed"]);
  const [platforms, setPlatforms] = useState<SocialPlatform[]>(settings.platforms);
  const [includeImageText, setIncludeImageText] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [includeHashtags, setIncludeHashtags] = useState(false);
  const [aiEdit, setAiEdit] = useState("");
  const [pending, startTransition] = useTransition();
  const [fullscreenPreview, setFullscreenPreview] = useState(false);
  const hydratedPostId = useRef<string | null>(null);

  const locked = post
    ? ["scheduled", "publishing", "published"].includes(post.status)
    : false;

  const displayCaption = useMemo(() => {
    const raw = post?.caption_locked
      ? post.caption
      : !useAiText && caption.trim()
        ? caption
        : (aiEdit || post?.ai_suggestion || caption);
    if (!raw?.trim()) return "";
    // Always layout through existing caption-format (phone/address/hashtags) — do not invent a new format.
    return finalizeCaption({
      body: raw,
      phone: settings.phone,
      phoneSecondary: settings.phone_secondary,
      address: settings.address,
      includeHashtags,
    });
  }, [
    post,
    useAiText,
    caption,
    aiEdit,
    settings.phone,
    settings.phone_secondary,
    settings.address,
    includeHashtags,
  ]);

  const missingContact =
    !settings.phone?.trim() &&
    !settings.phone_secondary?.trim() &&
    !settings.address?.trim();

  const feedAsset = post?.assets?.find((a) => a.kind === "feed" || a.kind === "original");
  const storyAsset = post?.assets?.find((a) => a.kind === "story");

  useEffect(() => {
    if (!open || !date) {
      hydratedPostId.current = null;
      return;
    }

    const existing = existingPosts[0];
    if (existing) {
      setLoading(false);
      const same = hydratedPostId.current === existing.id;
      hydratedPostId.current = existing.id;
      setPost(existing);
      if (same) return;
      setCaption(existing.caption);
      setAiEdit(existing.ai_suggestion || existing.caption || "");
      setUseAiText(!existing.caption_locked && !existing.caption.trim());
      setUserNotes(existing.user_notes ?? "");
      setPublishTime(isoToJerusalemTime(existing.scheduled_at));
      setFormats(existing.formats.length ? existing.formats : ["feed"]);
      setPlatforms(existing.platforms.length ? existing.platforms : settings.platforms);
      setIncludeImageText(existing.include_image_text);
      setRevisionNotes(existing.image_revision_notes ?? "");
      setIncludeHashtags(/#[\u0590-\u05FFa-zA-Z]/.test(existing.ai_suggestion ?? existing.caption ?? ""));
      return;
    }

    let cancelled = false;
    hydratedPostId.current = null;
    setLoading(true);
    getOrCreatePostForDate(date)
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        hydratedPostId.current = res.post.id;
        setPost(res.post);
        setCaption(res.post.caption);
        setAiEdit(res.post.ai_suggestion || "");
        setUseAiText(true);
        setUserNotes(res.post.user_notes ?? "");
        setPublishTime(isoToJerusalemTime(res.post.scheduled_at));
        setFormats(res.post.formats.length ? res.post.formats : ["feed"]);
        setPlatforms(res.post.platforms.length ? res.post.platforms : settings.platforms);
        setIncludeHashtags(false);
      })
      .catch(() => {
        if (!cancelled) toast.error("לא הצלחנו לטעון את היום. נסו שוב.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, date, existingPosts, settings.platforms]);

  function toggleFormat(fmt: SocialFormat) {
    setFormats((prev) =>
      prev.includes(fmt) ? prev.filter((f) => f !== fmt) : [...prev, fmt],
    );
  }

  function togglePlatform(p: SocialPlatform) {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }

  async function persistDraft(): Promise<boolean> {
    if (!post || !date) return false;

    const laidOut = finalizeCaption({
      body: useAiText ? (aiEdit || post.ai_suggestion || "") : caption,
      phone: settings.phone,
      phoneSecondary: settings.phone_secondary,
      address: settings.address,
      includeHashtags,
    });

    const valid = await validateCaptionText(laidOut);
    if (!valid.ok) {
      toast.error(valid.error);
      return false;
    }

    const res = await updateSocialPost({
      postId: post.id,
      caption: useAiText ? "" : laidOut,
      captionLocked: !useAiText,
      aiSuggestion: laidOut,
      userNotes,
      formats,
      platforms,
      publishDate: date,
      publishTime,
      includeImageText,
      imageRevisionNotes: revisionNotes,
      status: "draft",
    });
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    setPost({ ...post, ai_suggestion: laidOut, caption: useAiText ? "" : laidOut });
    setAiEdit(laidOut);
    if (!useAiText) setCaption(laidOut);
    return true;
  }

  function saveDraft() {
    startTransition(async () => {
      const ok = await persistDraft();
      if (!ok) return;
      toast.success("נשמר כטיוטה");
      onSaved();
    });
  }

  function handleApprove() {
    if (!post) return;
    startTransition(async () => {
      const saved = await persistDraft();
      if (!saved) return;
      const res = await approveSocialPost(post.id);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("אושר ונשמר לתאריך — ממתין לחיבור Meta");
        onSaved();
        onOpenChange(false);
      }
    });
  }

  async function handleRevert() {
    if (!post) return;
    startTransition(async () => {
      const res = await revertSocialPostToDraft(post.id);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("הוחזר לטיוטה");
        onSaved();
      }
    });
  }

  function handleDeleteDraft() {
    if (!post) return;
    if (
      !window.confirm(
        "למחוק את הטיוטה ליום זה? לא ניתן לשחזר אחרי המחיקה.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await deleteSocialPost(post.id);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("הטיוטה נמחקה");
        setPost(null);
        onSaved();
        onOpenChange(false);
      }
    });
  }

  function handleGenerateImage() {
    if (!post) return;
    startTransition(async () => {
      const saved = await persistDraft();
      if (!saved) return;

      const toastId = toast.loading(
        formats.includes("story") && formats.includes("feed")
          ? "יוצרים פיד ואז סטורי — עד כשתי דקות…"
          : "יוצרים תמונה — עד דקה…",
      );

      try {
        const res = await fetch("/api/social-media/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId: post.id }),
        });
        const json = (await res.json().catch(() => null)) as
          | { ok?: boolean; error?: string }
          | null;
        toast.dismiss(toastId);
        if (!res.ok || !json?.ok) {
          toast.error(json?.error ?? "ג׳נרוט תמונה נכשל");
          return;
        }
        toast.success("התמונה נוצרה");
        onSaved();
      } catch {
        toast.dismiss(toastId);
        toast.error(
          "החיבור נקטע באמצע ג׳נרוט. המתינו שיסתיים ונסו שוב — זה לוקח עד דקה.",
        );
      }
    });
  }

  async function handleUpload(kind: "original" | "reference", file: File) {
    if (!post) return;
    const fd = new FormData();
    fd.set("postId", post.id);
    fd.set("kind", kind);
    fd.set("file", file);
    startTransition(async () => {
      const res = await uploadSocialMedia(fd);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(kind === "reference" ? "תמונת בסיס הועלתה" : "קובץ הועלה");
        onSaved();
      }
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "flex max-h-[92vh] w-[min(96vw,72rem)] max-w-[72rem] flex-col gap-0 overflow-hidden rounded-2xl border-black/[0.08] p-0 shadow-2xl",
            "data-[state=open]:zoom-in-100",
          )}
        >
        <DialogHeader className="shrink-0 border-b border-black/[0.06] px-6 py-5 pe-12 text-start sm:px-8">
          <DialogTitle className="text-xl tracking-tight">
            {date
              ? new Date(`${date}T12:00:00`).toLocaleDateString("he-IL", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: "Asia/Jerusalem",
                })
              : "יום"}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2 pt-1">
            <span>
              {holiday
                ? `${holiday.label} · ${holiday.topicHint}`
                : "תכנון תוכן ליום זה"}
            </span>
            {post && (
              <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                {STATUS_LABELS[post.status]}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex flex-1 items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {!loading && post && (
          <>
            <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
              <div className="min-h-0 space-y-5 overflow-y-auto px-6 py-5 sm:px-8">
                <section className="space-y-2 rounded-xl border border-black/[0.06] bg-muted/40 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm font-semibold">המלצת AI</Label>
                    {!locked && !post.caption_locked && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            const res = await refreshAiSuggestion(post.id, {
                              source: "auto",
                              includeHashtags,
                            });
                            if (!res.ok) toast.error(res.error);
                            else {
                              if (res.suggestion) {
                                setPost({
                                  ...post,
                                  ai_suggestion: res.suggestion,
                                });
                                setAiEdit(res.suggestion);
                              }
                              setUseAiText(true);
                              toast.success("המלצה חדשה");
                              onSaved();
                            }
                          })
                        }
                      >
                        <Sparkles className="ml-1 h-3.5 w-3.5" />
                        הצע המלצה אחרת
                      </Button>
                    )}
                  </div>
                  {locked ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">
                      {displayCaption || post.ai_suggestion || "—"}
                    </p>
                  ) : (
                    <>
                      <textarea
                        className="min-h-[180px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm leading-relaxed [overflow-wrap:anywhere]"
                        value={aiEdit}
                        onChange={(e) => {
                          setAiEdit(e.target.value);
                          setUseAiText(true);
                        }}
                        placeholder="המלצת AI — אפשר לשנות מילים כאן…"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        אפשר לערוך כמה מילים כאן. שמירה ואישור לוקחים את הגרסה
                        שעריכתם. «הצע המלצה אחרת» מחליף את כל הטקסט.
                      </p>
                    </>
                  )}
                </section>

                {!locked && (
                  <>
                    <section className="space-y-3">
                      <div className="flex flex-wrap gap-4 text-sm">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={useAiText}
                            onChange={() => setUseAiText(true)}
                          />
                          השתמש בניסוח ה-AI
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={!useAiText}
                            onChange={() => {
                              setUseAiText(false);
                              if (!caption.trim() && aiEdit.trim()) {
                                setCaption(aiEdit);
                              }
                            }}
                          />
                          כתוב בעצמי (AI לא נוגע בטקסט)
                        </label>
                      </div>

                      <label className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={includeHashtags}
                          onChange={(e) => {
                            const on = e.target.checked;
                            setIncludeHashtags(on);
                            const current = useAiText ? aiEdit : caption;
                            if (!current?.trim()) return;
                            const next = finalizeCaption({
                              body: current,
                              phone: settings.phone,
                              phoneSecondary: settings.phone_secondary,
                              address: settings.address,
                              includeHashtags: on,
                            });
                            if (useAiText) {
                              setAiEdit(next);
                              setPost({ ...post, ai_suggestion: next });
                            } else {
                              setCaption(next);
                            }
                          }}
                        />
                        <span>
                          עם האשטגים בסוף הפוסט
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">
                            3–5 תגיות בשורה נפרדת. כבוי = נקי יותר לפייסבוק.
                            שני הטלפונים והכתובת מתווספים תמיד מתחת ל-CTA (מטאב
                            הגדרות).
                          </span>
                        </span>
                      </label>

                      {!useAiText && (
                        <textarea
                          className="min-h-[120px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                          value={caption}
                          onChange={(e) => setCaption(e.target.value)}
                          placeholder="טקסט הפוסט…"
                        />
                      )}

                      <div className="space-y-2 rounded-xl border border-black/[0.06] bg-background p-4">
                        <Label htmlFor="userNotes">הרעיון שלי</Label>
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          לא חייבים את ההמלצה למעלה. כתבו נושא או רעיון — AI ינסח
                          פוסט שיווקי בעברית. אחר כך אפשר לאשר או לערוך.
                        </p>
                        <textarea
                          id="userNotes"
                          className="mt-1 min-h-[88px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                          value={userNotes}
                          onChange={(e) => setUserNotes(e.target.value)}
                          placeholder="למשל: ביטוח דירה אחרי שיפוץ, או למה לבדוק כפל ביטוחים לפני חידוש…"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={pending || !userNotes.trim()}
                          onClick={() =>
                            startTransition(async () => {
                              const res = await refreshAiSuggestion(post.id, {
                                source: "idea",
                                idea: userNotes,
                                includeHashtags,
                              });
                              if (!res.ok) {
                                toast.error(res.error);
                                return;
                              }
                              if (res.suggestion) {
                                setPost({
                                  ...post,
                                  ai_suggestion: res.suggestion,
                                  user_notes: userNotes,
                                });
                                setAiEdit(res.suggestion);
                              }
                              setUseAiText(true);
                              toast.success("נוסח פוסט לפי הרעיון שלכם");
                              onSaved();
                            })
                          }
                        >
                          {pending ? (
                            <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="ml-1 h-3.5 w-3.5" />
                          )}
                          נסח פוסט לפי הרעיון
                        </Button>
                      </div>
                    </section>

                    <section className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="publishTime">שעת פרסום</Label>
                        <Input
                          id="publishTime"
                          type="time"
                          value={publishTime}
                          onChange={(e) => setPublishTime(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>פורמטים</Label>
                        {(["feed", "story"] as SocialFormat[]).map((fmt) => (
                          <label
                            key={fmt}
                            className="flex items-center gap-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={formats.includes(fmt)}
                              onChange={() => toggleFormat(fmt)}
                            />
                            {FORMAT_LABELS[fmt]}
                          </label>
                        ))}
                      </div>
                    </section>

                    <section>
                      <Label>פלטפורמות</Label>
                      <div className="mt-2 flex flex-wrap gap-4">
                        {(
                          ["facebook_page", "instagram"] as SocialPlatform[]
                        ).map((p) => (
                          <label
                            key={p}
                            className="flex items-center gap-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={platforms.includes(p)}
                              onChange={() => togglePlatform(p)}
                            />
                            {PLATFORM_LABELS[p]}
                          </label>
                        ))}
                      </div>
                    </section>

                    <section className="space-y-3 rounded-xl border border-dashed border-black/10 p-4">
                      <h3 className="text-sm font-semibold">מדיה</h3>
                      <div className="flex flex-wrap gap-2">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs transition-colors hover:bg-muted/50">
                          <Upload className="h-3.5 w-3.5" />
                          העלאת תמונה/וידאו
                          <input
                            type="file"
                            accept="image/*,video/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void handleUpload("original", f);
                            }}
                          />
                        </label>
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs transition-colors hover:bg-muted/50">
                          תמונת בסיס (reference)
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void handleUpload("reference", f);
                            }}
                          />
                        </label>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={pending || post.media_mode === "user_upload"}
                          onClick={handleGenerateImage}
                        >
                          {pending ? (
                            <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="ml-1 h-3.5 w-3.5" />
                          )}
                          צור תמונה
                        </Button>
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={includeImageText}
                          onChange={(e) =>
                            setIncludeImageText(e.target.checked)
                          }
                        />
                        עם טקסט על התמונה (ברירת מחדל: בלי)
                      </label>
                      <Input
                        placeholder="תיקון ג׳נרוט: יותר נקי, לוגו קטן יותר…"
                        value={revisionNotes}
                        onChange={(e) => setRevisionNotes(e.target.value)}
                      />
                    </section>
                  </>
                )}
              </div>

              <aside className="flex min-h-0 flex-col border-t border-black/[0.06] bg-muted/30 lg:border-t-0 lg:border-s">
                <div className="flex shrink-0 items-start justify-between gap-2 border-b border-black/[0.06] px-5 py-3">
                  <div>
                    <h3 className="text-sm font-semibold">תצוגה מקדימה</h3>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {platforms.map((p) => PLATFORM_LABELS[p]).join(" · ")} ·{" "}
                      {publishTime}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    onClick={() => setFullscreenPreview(true)}
                  >
                    <Expand className="h-3.5 w-3.5" />
                    מסך מלא
                  </Button>
                </div>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                  <button
                    type="button"
                    onClick={() => setFullscreenPreview(true)}
                    className="w-full rounded-xl border border-black/[0.06] bg-background p-3 text-start transition-colors hover:border-black/15 hover:bg-muted/40"
                  >
                    <p className="mb-2 text-[11px] font-medium text-muted-foreground">
                      לחצו לתצוגה כמו בפייסבוק / אינסטגרם
                    </p>
                    <p className="line-clamp-6 whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">
                      {displayCaption || (
                        <span className="text-muted-foreground">אין טקסט עדיין</span>
                      )}
                    </p>
                    {missingContact && (
                      <p className="mt-2 text-[11px] text-amber-700">
                        טלפון/כתובת יופיעו אחרי מילוי ושמירה בטאב «הגדרות» (שני טלפונים + כתובת).
                      </p>
                    )}
                    {formats.includes("feed") && feedAsset?.signed_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={feedAsset.signed_url}
                        alt="תצוגת פיד"
                        className="mt-3 aspect-square w-full rounded-lg object-cover"
                      />
                    )}
                  </button>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    {formats.includes("feed") && (
                      <div>
                        <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
                          פיד · 1080×1080
                        </p>
                        {feedAsset?.signed_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={feedAsset.signed_url}
                            alt="תצוגת פיד"
                            className="aspect-square w-full rounded-xl border object-cover shadow-sm"
                          />
                        ) : (
                          <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-black/10 bg-background text-xs text-muted-foreground">
                            אין מדיה לפיד
                          </div>
                        )}
                      </div>
                    )}
                    {formats.includes("story") && (
                      <div>
                        <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
                          סטורי · 1080×1920
                        </p>
                        {storyAsset?.signed_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={storyAsset.signed_url}
                            alt="תצוגת סטורי"
                            className="mx-auto aspect-[9/16] max-h-72 w-auto rounded-xl border object-cover shadow-sm"
                          />
                        ) : (
                          <div className="flex aspect-[9/16] max-h-72 items-center justify-center rounded-xl border border-dashed border-black/10 bg-background text-xs text-muted-foreground">
                            אין מדיה לסטורי
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </aside>
            </div>

            <DialogFooter className="shrink-0 flex-row flex-wrap justify-between gap-2 border-t border-black/[0.06] bg-background px-6 py-4 sm:px-8">
              {!locked ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending}
                      onClick={saveDraft}
                    >
                      שמירת טיוטה
                    </Button>
                    <Button
                      type="button"
                      disabled={pending}
                      className="bg-[#C41E3A] text-white hover:bg-[#a01830]"
                      onClick={handleApprove}
                    >
                      אישור ושמירה לתאריך
                    </Button>
                  </div>
                  {(post.status === "draft" ||
                    post.status === "pending_review" ||
                    post.status === "failed" ||
                    post.status === "skipped") && (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={pending}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={handleDeleteDraft}
                    >
                      מחיקת טיוטה
                    </Button>
                  )}
                </>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={handleRevert}
                >
                  החזרה לטיוטה לעריכה
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
      </Dialog>

      <PlatformPreviewDialog
        open={fullscreenPreview}
        onOpenChange={setFullscreenPreview}
        caption={displayCaption}
        platforms={platforms}
        formats={formats}
        publishTime={publishTime}
        feedImageUrl={feedAsset?.signed_url}
        storyImageUrl={storyAsset?.signed_url}
        settings={settings}
        missingContact={missingContact}
      />
    </>
  );
}
