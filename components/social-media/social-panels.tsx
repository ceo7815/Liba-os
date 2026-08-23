"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AgentKeyMeta } from "@/app/actions/agents";
import { AgentApiKeyPanel } from "@/components/agents/api-key-panel";
import {
  updateInboxStatus,
  updateSocialSettings,
} from "@/app/actions/social-media";
import {
  isoToJerusalemDate,
  isoToJerusalemTime,
} from "@/lib/social-media/scheduling";
import type { SocialDashboardPayload } from "@/lib/social-media/types";
import { DEFAULT_VISUAL_LANGUAGE } from "@/lib/social-media/brand-visual";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PLATFORM_LABELS,
  STATUS_DOT_CLASS,
  STATUS_LABELS,
} from "@/lib/social-media/constants";
import type {
  SocialInboxItem,
  SocialPlatform,
  SocialPost,
  SocialSettings,
} from "@/lib/social-media/types";

export function SocialQueuePanel({
  posts,
  onOpenDate,
}: {
  posts: SocialPost[];
  onOpenDate: (date: string) => void;
}) {
  const sorted = [...posts].sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
  );

  if (sorted.length === 0) {
    return (
      <div className="app-surface px-5 py-12 text-center text-sm text-muted-foreground">
        אין פוסטים בחודש זה — לחצו על יום ביומן להתחלה
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sorted.map((post) => {
        const date = isoToJerusalemDate(post.scheduled_at);
        const time = isoToJerusalemTime(post.scheduled_at);
        return (
          <article
            key={post.id}
            className="app-surface flex flex-wrap items-center justify-between gap-3 p-4"
          >
            <div>
              <p className="text-sm font-semibold tabular-nums">
                {date} · {time}
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {post.caption || post.ai_suggestion || "—"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${STATUS_DOT_CLASS[post.status]}`}
              />
              <span className="text-xs">{STATUS_LABELS[post.status]}</span>
              <Button type="button" size="sm" variant="outline" onClick={() => onOpenDate(date)}>
                פתיחה
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function SocialInboxPanel({
  inbox,
  posts,
}: {
  inbox: SocialInboxItem[];
  posts: SocialPost[];
}) {
  const [, startTransition] = useTransition();

  if (inbox.length === 0) {
    return (
      <div className="app-surface px-5 py-12 text-center text-sm text-muted-foreground">
        תיבת הדואר ריקה — הודעות ותגובות יופיעו כשהראנר יתחבר ל-Meta
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {inbox.map((item) => {
        const linked = posts.find((p) => p.id === item.post_id);
        return (
          <article key={item.id} className="app-surface space-y-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{PLATFORM_LABELS[item.platform]}</span>
              <span>{new Date(item.received_at).toLocaleString("he-IL")}</span>
            </div>
            <p className="text-sm font-medium">
              {item.author_name ?? item.author_handle ?? "מחבר"}
            </p>
            <p className="text-sm leading-relaxed">{item.body}</p>
            {linked && (
              <p className="text-[11px] text-muted-foreground">
                פוסט: {linked.caption.slice(0, 60) || linked.ai_suggestion?.slice(0, 60)}
              </p>
            )}
            <div className="flex gap-2">
              {(["new", "read", "handled"] as const).map((st) => (
                <Button
                  key={st}
                  type="button"
                  size="sm"
                  variant={item.status === st ? "default" : "outline"}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await updateInboxStatus(item.id, st);
                      if (!res.ok) toast.error(res.error);
                    })
                  }
                >
                  {st === "new" ? "חדש" : st === "read" ? "נקרא" : "טופל"}
                </Button>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function SocialAnalyticsPanel({ posts }: { posts: SocialPost[] }) {
  const published = posts.filter((p) => p.status === "published");

  return (
    <div className="space-y-4">
      <div className="app-surface p-5">
        <h3 className="text-sm font-semibold">ממתין לחיבור Meta Insights</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          אין נתונים אמיתיים עדיין. כשהראנר יחובר — יישמרו לכל פוסט: חשיפות, הגעות,
          לייקים, תגובות, שמירות, שיתופים, קליקים, צפיות סטורי ומעקב חדש.
        </p>
      </div>

      {published.length === 0 ? (
        <div className="app-surface px-5 py-8 text-center text-sm text-muted-foreground">
          אין פוסטים שפורסמו עדיין
        </div>
      ) : (
        published.map((p) => (
          <article key={p.id} className="app-surface p-4 text-sm">
            <p className="font-medium">{isoToJerusalemDate(p.scheduled_at)}</p>
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {p.caption}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">ממתין לנתונים מ-Meta</p>
          </article>
        ))
      )}
    </div>
  );
}

export function SocialSettingsPanel({ settings }: { settings: SocialSettings }) {
  const router = useRouter();
  const [forbidden, setForbidden] = useState(settings.forbidden_phrases.join("\n"));
  const [phone, setPhone] = useState(settings.phone ?? "");
  const [phoneSecondary, setPhoneSecondary] = useState(
    settings.phone_secondary ?? "",
  );
  const [email, setEmail] = useState(settings.email ?? "");
  const [address, setAddress] = useState(settings.address ?? "");
  const [license, setLicense] = useState(settings.license_number ?? "");
  const [defaultTime, setDefaultTime] = useState(settings.default_publish_time);
  const [tone, setTone] = useState(settings.tone_guidelines);
  const [visualLanguage, setVisualLanguage] = useState(
    settings.brand.visualLanguage ?? DEFAULT_VISUAL_LANGUAGE,
  );
  const [platforms, setPlatforms] = useState<SocialPlatform[]>(settings.platforms);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await updateSocialSettings({
        forbiddenPhrases: forbidden
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        phone,
        phoneSecondary,
        email,
        address,
        licenseNumber: license,
        defaultPublishTime: defaultTime,
        toneGuidelines: tone,
        visualLanguage,
        platforms,
      });
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("הגדרות נשמרו");
        router.refresh();
      }
    });
  }

  return (
    <div className="app-surface space-y-5 p-5">
      <div>
        <h3 className="text-sm font-semibold">מותג — {settings.brand.name}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{settings.brand.website}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-[8rem_1fr] sm:items-start">
        <div className="rounded-xl border border-black/[0.06] bg-white p-3">
          <p className="mb-2 text-[11px] font-medium text-muted-foreground">לוגו</p>
          <Image
            src={settings.brand.logoPath ?? "/brand/liba-logo.png"}
            alt="לוגו ליבה"
            width={128}
            height={64}
            className="h-16 w-auto object-contain"
          />
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          הלוגו הוא הסימן הגרפי בלבד (מגן, ידיים, לב, «ליבה»). הוא לא שפת הצילום.
          הג׳נרוט שולח את קובץ הלוגו כקובץ נפרד, ומניח אותו קטן בפינה — בלי להפוך
          אותו לאובייקט תלת־ממד בסצנה ובלי «לשלב את המגן» כנושא התמונה.
        </p>
      </div>

      <div>
        <Label>שפה עיצובית (צילום ופריסה — לא הלוגו)</Label>
        <p className="mt-1 text-[11px] text-muted-foreground">
          נשמר בהגדרות ונשלח בכל «צור תמונה». אפשר לערוך. צהוב של Liba OS אינו
          צבע המותג הציבורי.
        </p>
        <textarea
          className="mt-1 min-h-[160px] w-full rounded-md border px-3 py-2 text-sm"
          value={visualLanguage}
          onChange={(e) => setVisualLanguage(e.target.value)}
        />
      </div>

      <div>
        <Label>משפטים ומילים אסורים (שורה לכל פריט)</Label>
        <textarea
          className="mt-1 min-h-[120px] w-full rounded-md border px-3 py-2 text-sm"
          value={forbidden}
          onChange={(e) => setForbidden(e.target.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>טלפון 1</Label>
          <Input
            className="mt-1"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="למשל 03-…"
          />
        </div>
        <div>
          <Label>טלפון 2</Label>
          <Input
            className="mt-1"
            value={phoneSecondary}
            onChange={(e) => setPhoneSecondary(e.target.value)}
            placeholder="למשל 050-…"
          />
        </div>
        <div className="sm:col-span-2">
          <Label>מייל</Label>
          <Input className="mt-1" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label>כתובת</Label>
          <Input className="mt-1" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div>
          <Label>מספר רישיון סוכן</Label>
          <Input className="mt-1" value={license} onChange={(e) => setLicense(e.target.value)} />
        </div>
        <div>
          <Label>שעת פרסום ברירת מחדל</Label>
          <Input
            type="time"
            className="mt-1"
            value={defaultTime}
            onChange={(e) => setDefaultTime(e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label>הנחיות טון</Label>
        <textarea
          className="mt-1 min-h-[80px] w-full rounded-md border px-3 py-2 text-sm"
          value={tone}
          onChange={(e) => setTone(e.target.value)}
        />
      </div>

      <div>
        <Label>פלטפורמות פעילות</Label>
        <div className="mt-2 flex gap-4">
          {(["facebook_page", "instagram"] as SocialPlatform[]).map((p) => (
            <label key={p} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={platforms.includes(p)}
                onChange={() =>
                  setPlatforms((prev) =>
                    prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
                  )
                }
              />
              {PLATFORM_LABELS[p]}
            </label>
          ))}
        </div>
      </div>

      <Button type="button" disabled={pending} onClick={save}>
        שמירת הגדרות
      </Button>
    </div>
  );
}

export function SocialRunsPanel({
  runs,
  costs,
  monthlyCostUsd,
  isAdmin = false,
  keys = [],
  hermesStatus = null,
  hermesLastSeenAt = null,
}: {
  runs: SocialDashboardPayload["runs"];
  costs: SocialDashboardPayload["costs"];
  monthlyCostUsd: number;
  isAdmin?: boolean;
  keys?: AgentKeyMeta[];
  hermesStatus?: string | null;
  hermesLastSeenAt?: string | null;
}) {
  return (
    <div className="space-y-4">
      <div className="app-surface p-4">
        <p className="text-xs text-muted-foreground">עלות החודש</p>
        <p className="text-xl font-semibold tabular-nums">${monthlyCostUsd.toFixed(2)}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          ראנר: {hermesStatus === "online" ? "מחובר" : hermesStatus === "offline" ? "לא מחובר" : "ממתין"}
          {hermesLastSeenAt
            ? ` · נראה לאחרונה ${new Date(hermesLastSeenAt).toLocaleString("he-IL")}`
            : ""}
        </p>
      </div>

      {isAdmin ? (
        <AgentApiKeyPanel
          slug="social-media"
          initialKeys={keys}
          defaultLabel="סוכן רשתות חברתיות"
        />
      ) : null}

      <div>
        <h3 className="mb-2 text-sm font-semibold">הרצות אחרונות</h3>
        {runs.length === 0 ? (
          <div className="app-surface px-5 py-8 text-center text-sm text-muted-foreground">
            אין הרצות — ג׳נרוט תמונה ייצור הרצה ועלות
          </div>
        ) : (
          runs.map((run) => (
            <article key={run.id} className="app-surface mb-2 p-4 text-sm">
              <p className="font-medium">{run.trigger}</p>
              <p className="text-xs text-muted-foreground">
                {run.status} · ${Number(run.cost_usd ?? 0).toFixed(2)}
              </p>
            </article>
          ))
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">עלויות</h3>
        {costs.length === 0 ? (
          <p className="text-sm text-muted-foreground">אין רישומי עלות</p>
        ) : (
          costs.map((c) => (
            <article key={c.id} className="app-surface mb-2 flex justify-between p-3 text-sm">
              <span>{c.service}</span>
              <span className="tabular-nums">${c.cost_usd.toFixed(2)}</span>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
