"use client";

import {
  TOOL_STATUS_LABELS,
  mergeExpectedTools,
  type DisplayTool,
  type ReportedTool,
} from "@/lib/call-control/management";
import { PROCESSING_LABELS, type CallControlRow } from "@/lib/call-control/view";
import { cn } from "@/lib/utils";

function formatSeen(iso: string | null): string {
  if (!iso) return "עדיין לא דווח";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "עדיין לא דווח";
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function toolTone(status: DisplayTool["status"]) {
  switch (status) {
    case "connected":
      return "bg-emerald-50 text-emerald-900";
    case "degraded":
      return "bg-amber-100 text-amber-950";
    case "error":
      return "bg-red-100 text-red-900";
    default:
      return "bg-black/[0.05] text-muted-foreground";
  }
}

function toolDot(status: DisplayTool["status"]) {
  switch (status) {
    case "connected":
      return "status-live-dot";
    case "degraded":
      return "status-live-dot status-live-dot--amber";
    case "error":
      return "size-1.5 rounded-full bg-red-500";
    default:
      return "size-1.5 rounded-full bg-black/25";
  }
}

export function ConnectionChips({ tools }: { tools: ReportedTool[] }) {
  const displayTools = mergeExpectedTools(tools);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {displayTools.map((tool) => (
        <span
          key={tool.key}
          title={`${tool.detail} · עדכון ${formatSeen(tool.lastCheckedAt)}`}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
            toolTone(tool.status),
          )}
        >
          <span className={toolDot(tool.status)} aria-hidden />
          {tool.label}
          <span className="font-medium opacity-70">
            {TOOL_STATUS_LABELS[tool.status]}
          </span>
        </span>
      ))}
    </div>
  );
}

export function AgentOpsPanel({
  rows,
}: {
  hermesStatus: string | null;
  hermesLastSeenAt: string | null;
  tools: ReportedTool[];
  rows: CallControlRow[];
}) {
  const counts = {
    ready: rows.filter((r) => r.processingStatus === "ready").length,
    processing: rows.filter((r) => r.processingStatus === "processing").length,
    waiting: rows.filter((r) => r.processingStatus === "waiting").length,
    failed: rows.filter((r) => r.processingStatus === "failed").length,
  };
  const critical = rows.filter((r) => r.hasCritical).length;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
      {(
        [
          ["ready", counts.ready],
          ["processing", counts.processing],
          ["waiting", counts.waiting],
          ["failed", counts.failed],
        ] as const
      ).map(([key, n]) => (
        <div
          key={key}
          className="rounded-[1.15rem] border border-black/[0.06] bg-white px-4 py-3.5 shadow-[0_1px_0_rgba(17,17,17,0.03)]"
        >
          <p className="text-[11px] font-medium text-muted-foreground">
            {PROCESSING_LABELS[key]}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
            {n}
          </p>
        </div>
      ))}
      <div className="rounded-[1.15rem] border border-black/[0.06] bg-white px-4 py-3.5 shadow-[0_1px_0_rgba(17,17,17,0.03)]">
        <p className="text-[11px] font-medium text-muted-foreground">קריטי</p>
        <p
          className={cn(
            "mt-1 text-2xl font-semibold tabular-nums tracking-tight",
            critical > 0 && "text-red-700",
          )}
        >
          {critical}
        </p>
      </div>
    </div>
  );
}

export { ChecklistSettings as ChecklistReference } from "@/components/call-control/checklist-settings";
