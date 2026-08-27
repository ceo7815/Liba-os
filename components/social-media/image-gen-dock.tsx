"use client";

import { Loader2, Maximize2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImageGenJob } from "@/components/social-media/use-image-gen-jobs";

export type DockedPostSheet = {
  date: string;
  mode: "scheduled" | "immediate";
  postId: string | null;
};

type DockItem = {
  key: string;
  date: string;
  mode: "scheduled" | "immediate";
  postId: string | null;
  job?: ImageGenJob;
};

function dateLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("he-IL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Jerusalem",
  });
}

function statusLabel(item: DockItem) {
  if (item.mode === "immediate" && !item.job) return "פרסום מיידי · ממוזער";
  if (!item.job) return "טיוטה ממוזערת";
  if (item.job.status === "queued") return "בתור לג׳נרוט";
  if (item.job.status === "running") return "יוצרים תמונה";
  if (item.job.status === "success") return "התמונה מוכנה";
  return item.job.error || "ג׳נרוט נכשל";
}

export function ImageGenDock({
  jobs,
  docked,
  openDate,
  openMode,
  sheetOpen,
  onRestore,
  onDismissJob,
  onDismissDocked,
}: {
  jobs: ImageGenJob[];
  docked: DockedPostSheet[];
  openDate: string | null;
  openMode: "scheduled" | "immediate";
  sheetOpen: boolean;
  onRestore: (item: { date: string; mode: "scheduled" | "immediate" }) => void;
  onDismissJob: (postId: string) => void;
  onDismissDocked: (item: DockedPostSheet) => void;
}) {
  const items: DockItem[] = [];
  const seen = new Set<string>();

  function skipOpen(date: string, mode: "scheduled" | "immediate") {
    return sheetOpen && openDate === date && openMode === mode;
  }

  for (const job of jobs) {
    if (skipOpen(job.date, job.mode)) continue;
    const key = `job:${job.postId}`;
    seen.add(`${job.mode}:${job.date}`);
    items.push({
      key,
      date: job.date,
      mode: job.mode,
      postId: job.postId,
      job,
    });
  }

  for (const sheet of docked) {
    if (skipOpen(sheet.date, sheet.mode)) continue;
    const stamp = `${sheet.mode}:${sheet.date}`;
    if (seen.has(stamp)) continue;
    seen.add(stamp);
    items.push({
      key: `sheet:${stamp}`,
      date: sheet.date,
      mode: sheet.mode,
      postId: sheet.postId,
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex max-w-[min(96vw,42rem)] flex-wrap items-stretch justify-center gap-2">
        {items.map((item) => {
          const busy =
            item.job?.status === "queued" || item.job?.status === "running";
          const failed = item.job?.status === "error";
          const done = item.job?.status === "success";
          return (
            <div
              key={item.key}
              className={cn(
                "flex min-w-[220px] items-center gap-2 rounded-2xl border bg-background/95 px-3 py-2 shadow-xl backdrop-blur",
                failed
                  ? "border-red-200"
                  : done
                    ? "border-emerald-200"
                    : "border-black/[0.08]",
              )}
            >
              <button
                type="button"
                onClick={() => onRestore({ date: item.date, mode: item.mode })}
                className="flex min-w-0 flex-1 items-center gap-2 text-start"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-highlight-foreground" />
                ) : (
                  <Maximize2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {item.mode === "immediate"
                      ? "פרסום מיידי"
                      : dateLabel(item.date)}
                  </span>
                  <span
                    className={cn(
                      "block truncate text-[11px]",
                      failed
                        ? "text-red-700"
                        : done
                          ? "text-emerald-700"
                          : "text-muted-foreground",
                    )}
                  >
                    {statusLabel(item)}
                  </span>
                </span>
              </button>
              {!busy && (
                <button
                  type="button"
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="סגור חלונית"
                  onClick={() => {
                    if (item.job) onDismissJob(item.job.postId);
                    else onDismissDocked(item);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
