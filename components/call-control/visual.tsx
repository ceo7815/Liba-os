import type { ReactNode } from "react";
import type { ChecklistStatus } from "@/lib/agents/call-qa-checklist";
import {
  CALL_KIND_LABELS,
  PROCESSING_LABELS,
  formatScore,
  type CallKind,
  type ProcessingStatus,
} from "@/lib/call-control/view";
import { cn } from "@/lib/utils";

export function scoreTone(value: number | null): "good" | "mid" | "bad" | "empty" {
  if (value == null || !Number.isFinite(value)) return "empty";
  if (value >= 80) return "good";
  if (value >= 60) return "mid";
  return "bad";
}

export function scoreColor(value: number | null) {
  switch (scoreTone(value)) {
    case "good":
      return "text-emerald-800";
    case "mid":
      return "text-amber-800";
    case "bad":
      return "text-red-800";
    default:
      return "text-muted-foreground";
  }
}

export function scoreTrack(value: number | null) {
  switch (scoreTone(value)) {
    case "good":
      return "bg-emerald-500";
    case "mid":
      return "bg-amber-500";
    case "bad":
      return "bg-red-500";
    default:
      return "bg-black/15";
  }
}

export function statusClass(status: ProcessingStatus) {
  switch (status) {
    case "ready":
      return "bg-emerald-50 text-emerald-900";
    case "processing":
      return "bg-amber-50 text-amber-950";
    case "failed":
      return "bg-red-50 text-red-800";
    case "not_analyzed":
      return "bg-black/[0.05] text-muted-foreground";
    default:
      return "bg-black/[0.05] text-muted-foreground";
  }
}

export function kindClass(kind: CallKind) {
  switch (kind) {
    case "reflection":
      return "bg-highlight/40 text-foreground";
    case "regulation":
      return "bg-foreground text-white";
    default:
      return "bg-black/[0.05] text-muted-foreground";
  }
}

export function checklistTone(status: ChecklistStatus) {
  switch (status) {
    case "done":
      return "bg-emerald-50 text-emerald-900";
    case "partial":
      return "bg-amber-100 text-amber-950";
    case "not_done":
      return "bg-red-100 text-red-900";
    case "not_relevant":
      return "bg-background text-muted-foreground";
    case "unverifiable":
      return "bg-background text-muted-foreground ring-1 ring-black/10";
  }
}

export function StatusPill({ status }: { status: ProcessingStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        statusClass(status),
      )}
    >
      {status === "processing" ? (
        <span className="status-live-dot status-live-dot--amber" aria-hidden />
      ) : status === "ready" ? (
        <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
      ) : status === "failed" ? (
        <span className="size-1.5 rounded-full bg-red-500" aria-hidden />
      ) : (
        <span className="size-1.5 rounded-full bg-black/25" aria-hidden />
      )}
      {PROCESSING_LABELS[status]}
    </span>
  );
}

export function KindPill({ kind }: { kind: CallKind }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
        kindClass(kind),
      )}
    >
      {CALL_KIND_LABELS[kind]}
    </span>
  );
}

export function ScoreRing({
  value,
  size = 44,
}: {
  value: number | null;
  size?: number;
}) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  const r = 16;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const stroke =
    scoreTone(value) === "good"
      ? "#059669"
      : scoreTone(value) === "mid"
        ? "#d97706"
        : scoreTone(value) === "bad"
          ? "#dc2626"
          : "rgba(17,17,17,0.12)";

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 40 40" className="-rotate-90" width={size} height={size}>
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke="rgba(17,17,17,0.08)"
          strokeWidth="4"
        />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={value == null ? c : offset}
        />
      </svg>
      <span
        className={cn(
          "absolute text-[11px] font-semibold tabular-nums",
          scoreColor(value),
        )}
      >
        {formatScore(value)}
      </span>
    </span>
  );
}

export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors active:scale-95",
        active
          ? "bg-black text-white"
          : "bg-muted/70 text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
