"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  daysInMonth,
  firstWeekdayOffset,
  HEBREW_WEEKDAYS,
} from "@/lib/social-media/holidays";
import { STATUS_BADGE_CLASS, STATUS_DOT_CLASS, STATUS_LABELS } from "@/lib/social-media/constants";
import { isoToJerusalemTime } from "@/lib/social-media/scheduling";
import type {
  HolidayDay,
  SocialPost,
  SocialPostStatus,
} from "@/lib/social-media/types";
import { Button } from "@/components/ui/button";

type Props = {
  agentName: string;
  year: number;
  month: number;
  monthLabel: string;
  today: string;
  holidays: Map<string, HolidayDay>;
  postsByDate: Map<string, SocialPost[]>;
  onPrev: () => void;
  onNext: () => void;
  onSelectDay: (date: string) => void;
};

/** Compact Hebrew status for calendar cells */
const CELL_STATUS_LABELS: Record<SocialPostStatus, string> = {
  draft: "טיוטה",
  pending_review: "ממתין",
  scheduled: "אושרה",
  publishing: "בפרסום",
  published: "פורסמה",
  failed: "נכשלה",
  skipped: "דולג",
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function SocialCalendar({
  year,
  month,
  monthLabel,
  today,
  holidays,
  postsByDate,
  onPrev,
  onNext,
  onSelectDay,
}: Props) {
  const totalDays = daysInMonth(year, month);
  const offset = firstWeekdayOffset(year, month);
  const cells: Array<{ date: string; day: number } | null> = [];

  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) {
    cells.push({ date: `${year}-${pad(month)}-${pad(d)}`, day: d });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{monthLabel}</h2>
          <p className="text-xs text-muted-foreground">
            Asia/Jerusalem · לחיצה על יום לעריכת תוכן
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon" onClick={onPrev}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={onNext}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="app-surface overflow-hidden p-3 sm:p-4">
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
          {HEBREW_WEEKDAYS.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((cell, idx) => {
            if (!cell) {
              return <div key={`empty-${idx}`} className="min-h-[6.5rem]" />;
            }

            const holiday = holidays.get(cell.date);
            const posts = postsByDate.get(cell.date) ?? [];
            const isToday = cell.date === today;
            const primary = posts[0];

            return (
              <button
                key={cell.date}
                type="button"
                onClick={() => onSelectDay(cell.date)}
                className={cn(
                  "min-h-[6.5rem] rounded-lg border border-transparent p-2 text-right transition-colors hover:border-black/10 hover:bg-background/80",
                  isToday && "border-highlight/60 bg-highlight/10",
                  primary && "border-black/[0.06] bg-background/60",
                )}
              >
                <div className="flex items-start justify-between gap-1">
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      isToday && "text-[#C41E3A]",
                    )}
                  >
                    {cell.day}
                  </span>
                  {primary && (
                    <span
                      className={cn(
                        "mt-0.5 h-2 w-2 shrink-0 rounded-full",
                        STATUS_DOT_CLASS[primary.status],
                      )}
                      title={STATUS_LABELS[primary.status]}
                    />
                  )}
                </div>

                {holiday && (
                  <p className="mt-1 line-clamp-1 text-[10px] leading-snug text-[#C41E3A]">
                    {holiday.label}
                  </p>
                )}

                {posts.length > 0 ? (
                  <div className="mt-1.5 space-y-1">
                    {posts.slice(0, 2).map((p) => (
                      <div
                        key={p.id}
                        className={cn(
                          "rounded-md px-1.5 py-1 text-start",
                          STATUS_BADGE_CLASS[p.status],
                        )}
                      >
                        <p className="text-[11px] font-semibold leading-tight">
                          {CELL_STATUS_LABELS[p.status]}
                        </p>
                        <p className="mt-0.5 text-[10px] tabular-nums opacity-80">
                          {isoToJerusalemTime(p.scheduled_at)}
                        </p>
                      </div>
                    ))}
                    {posts.length > 2 && (
                      <p className="text-[10px] text-muted-foreground">
                        +{posts.length - 2} נוספים
                      </p>
                    )}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {Object.entries(STATUS_LABELS).map(([status, label]) => (
          <span key={status} className="inline-flex items-center gap-1.5">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                STATUS_DOT_CLASS[status as keyof typeof STATUS_DOT_CLASS],
              )}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
