"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  HEBREW_MONTH_NAMES,
  todayJerusalemDateKey,
} from "@/lib/social-media/calendar-ui";
import type { HolidayDay, SocialPost } from "@/lib/social-media/types";
import type { SocialDashboardPayload } from "@/lib/social-media/types";
import type { AgentKeyMeta } from "@/app/actions/agents";
import { SocialCalendar } from "@/components/social-media/social-calendar";
import { PostDaySheet } from "@/components/social-media/post-day-sheet";
import {
  SocialAnalyticsPanel,
  SocialInboxPanel,
  SocialQueuePanel,
  SocialRunsPanel,
  SocialSettingsPanel,
} from "@/components/social-media/social-panels";

const TABS = [
  { id: "calendar", label: "יומן" },
  { id: "queue", label: "תור החודש" },
  { id: "inbox", label: "תיבת תגובות" },
  { id: "analytics", label: "אנליטיקה" },
  { id: "settings", label: "הגדרות" },
  { id: "runs", label: "עלויות / הרצות" },
] as const;

type TabId = (typeof TABS)[number]["id"];

type Props = {
  agentName: string;
  initialYear: number;
  initialMonth: number;
  data: SocialDashboardPayload;
  holidays: HolidayDay[];
  isAdmin?: boolean;
  keys?: AgentKeyMeta[];
  hermesStatus?: string | null;
  hermesLastSeenAt?: string | null;
};

export function SocialMediaDashboard({
  agentName,
  initialYear,
  initialMonth,
  data,
  holidays,
  isAdmin = false,
  keys = [],
  hermesStatus = null,
  hermesLastSeenAt = null,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("calendar");
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"scheduled" | "immediate">(
    "scheduled",
  );
  const [, startTransition] = useTransition();

  useEffect(() => {
    setYear(initialYear);
    setMonth(initialMonth);
  }, [initialYear, initialMonth]);

  const holidayByDate = useMemo(() => {
    const map = new Map<string, HolidayDay>();
    for (const h of holidays) map.set(h.date, h);
    return map;
  }, [holidays]);

  const postsByDate = useMemo(() => {
    const map = new Map<string, SocialPost[]>();
    for (const post of data.posts) {
      const jerusalem = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jerusalem",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(post.scheduled_at));
      const list = map.get(jerusalem) ?? [];
      list.push(post);
      map.set(jerusalem, list);
    }
    return map;
  }, [data.posts]);

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setYear(y);
    setMonth(m);
    startTransition(() => {
      router.push(`/agents/social-media?year=${y}&month=${m}`);
    });
  }

  function openDay(date: string) {
    setSheetMode("scheduled");
    setSelectedDate(date);
    setSheetOpen(true);
  }

  function openImmediate() {
    setSheetMode("immediate");
    setSelectedDate(todayJerusalemDateKey());
    setSheetOpen(true);
  }

  const today = todayJerusalemDateKey();
  const editableStatuses = new Set([
    "draft",
    "pending_review",
    "failed",
    "skipped",
  ]);
  const sheetPosts =
    selectedDate == null
      ? []
      : sheetMode === "immediate"
        ? (postsByDate.get(selectedDate) ?? []).filter((p) =>
            editableStatuses.has(p.status),
          )
        : (postsByDate.get(selectedDate) ?? []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 border-b border-black/[0.08] pb-px">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "relative px-3 py-2 text-sm transition-colors",
              tab === item.id
                ? "font-semibold text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            {tab === item.id && (
              <span className="absolute inset-x-2 -bottom-px h-[3px] rounded-full bg-highlight" />
            )}
          </button>
        ))}
      </div>

      {tab === "calendar" && (
        <SocialCalendar
          agentName={agentName}
          year={year}
          month={month}
          monthLabel={`${HEBREW_MONTH_NAMES[month - 1]} ${year}`}
          today={today}
          holidays={holidayByDate}
          postsByDate={postsByDate}
          onPrev={() => shiftMonth(-1)}
          onNext={() => shiftMonth(1)}
          onSelectDay={openDay}
          onImmediatePublish={openImmediate}
        />
      )}

      {tab === "queue" && (
        <SocialQueuePanel posts={data.posts} onOpenDate={openDay} />
      )}

      {tab === "inbox" && (
        <SocialInboxPanel inbox={data.inbox} posts={data.posts} />
      )}

      {tab === "analytics" && <SocialAnalyticsPanel posts={data.posts} />}

      {tab === "settings" && (
        <SocialSettingsPanel settings={data.settings} />
      )}

      {tab === "runs" && (
        <SocialRunsPanel
          runs={data.runs}
          costs={data.costs}
          monthlyCostUsd={data.monthlyCostUsd}
          isAdmin={isAdmin}
          keys={keys}
          hermesStatus={hermesStatus}
          hermesLastSeenAt={hermesLastSeenAt}
        />
      )}

      <PostDaySheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setSheetMode("scheduled");
        }}
        date={selectedDate}
        holiday={selectedDate ? holidayByDate.get(selectedDate) ?? null : null}
        settings={data.settings}
        existingPosts={sheetPosts}
        mode={sheetMode}
        hermesStatus={hermesStatus}
        onSaved={() => {
          startTransition(() => router.refresh());
        }}
      />
    </div>
  );
}
