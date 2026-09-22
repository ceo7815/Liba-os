"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Headphones, KeyRound, PhoneOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getCallControlCard,
  getCallControlManagement,
  listCallControlCalls,
  type CallControlManagement,
} from "@/app/actions/call-control";
import type { CallReportDetail } from "@/app/actions/agents";
import { AgentApiKeyPanel } from "@/components/agents/api-key-panel";
import type { AgentKeyMeta } from "@/app/actions/agents";
import {
  AgentOpsPanel,
  ChecklistReference,
  ConnectionChips,
} from "@/components/call-control/agent-ops-panel";
import { CallCard } from "@/components/call-control/call-card";
import { FilterChip, StatusPill } from "@/components/call-control/visual";
import {
  formatCallClock,
  formatDuration,
  formatScore,
  type CallControlRow,
  type ProcessingStatus,
} from "@/lib/call-control/view";
import { cn } from "@/lib/utils";

type WorkspaceTab = "calls" | "checklist" | "keys";

type Props = {
  initialRows: CallControlRow[];
  initialCallId?: string | null;
  initialTab?: string | null;
  isAdmin: boolean;
  keys: AgentKeyMeta[];
  initialManagement: CallControlManagement;
};

const STATUS_FILTERS: Array<{ id: "all" | ProcessingStatus; label: string }> = [
  { id: "all", label: "הכל" },
  { id: "waiting", label: "ממתינה" },
  { id: "processing", label: "בעיבוד" },
  { id: "ready", label: "מוכנה" },
  { id: "failed", label: "נכשלה" },
];

function runnerLabel(status: string | null) {
  if (status === "online") return "ראנר מחובר";
  if (status === "offline") return "ראנר לא מחובר";
  return "ממתין ל-heartbeat";
}

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

function parseTab(raw: string | null | undefined, isAdmin: boolean): WorkspaceTab {
  if (raw === "checklist") return "checklist";
  if (raw === "keys" && isAdmin) return "keys";
  return "calls";
}

export function CallControlScreen({
  initialRows,
  initialCallId,
  initialTab,
  isAdmin,
  keys,
  initialManagement,
}: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [status, setStatus] = useState<"all" | ProcessingStatus>("all");
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [tab, setTab] = useState<WorkspaceTab>(() =>
    parseTab(initialTab, isAdmin),
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    initialCallId ?? null,
  );
  const [detail, setDetail] = useState<CallReportDetail | null>(null);
  const [selectedRow, setSelectedRow] = useState<CallControlRow | null>(
    () => initialRows.find((r) => r.id === initialCallId) ?? null,
  );
  const [detailError, setDetailError] = useState<string | null>(null);
  const [management, setManagement] = useState(initialManagement);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (status !== "all" && row.processingStatus !== status) return false;
      if (criticalOnly && !row.hasCritical) return false;
      if (dateFrom && (!row.callDate || row.callDate.slice(0, 10) < dateFrom)) {
        return false;
      }
      if (dateTo && (!row.callDate || row.callDate.slice(0, 10) > dateTo)) {
        return false;
      }
      return true;
    });
  }, [rows, status, criticalOnly, dateFrom, dateTo]);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  useEffect(() => {
    setManagement(initialManagement);
  }, [initialManagement]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setSelectedRow(null);
      return;
    }
    let cancelled = false;
    startTransition(async () => {
      const result = await getCallControlCard(selectedId);
      if (cancelled) return;
      setDetailError(result.error);
      setDetail(result.detail);
      setSelectedRow(result.row);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void listCallControlCalls().then((result) => {
        if (result.error) return;
        void getCallControlManagement().then((ops) => {
          if (!ops.error) setManagement(ops.data);
        });
        setRows((prev) => {
          const next = result.rows;
          if (selectedId) {
            const before = prev.find((r) => r.id === selectedId);
            const after = next.find((r) => r.id === selectedId);
            if (
              after &&
              (before?.processingStatus !== after.processingStatus ||
                before?.overallScore !== after.overallScore)
            ) {
              void getCallControlCard(selectedId).then((card) => {
                setDetailError(card.error);
                setDetail(card.detail);
                setSelectedRow(card.row);
              });
            }
          }
          return next;
        });
      });
    }, 8000);
    return () => window.clearInterval(timer);
  }, [selectedId]);

  function writeUrl(next: { tab?: WorkspaceTab; call?: string | null }) {
    const params = new URLSearchParams();
    const nextTab = next.tab ?? tab;
    const nextCall = next.call === undefined ? selectedId : next.call;
    if (nextTab !== "calls") params.set("tab", nextTab);
    if (nextCall) params.set("call", nextCall);
    const q = params.toString();
    router.replace(q ? `/agents/call-control?${q}` : "/agents/call-control", {
      scroll: false,
    });
  }

  function openTab(next: WorkspaceTab) {
    setTab(next);
    if (next !== "calls") setSelectedId(null);
    writeUrl({ tab: next, call: next === "calls" ? null : null });
  }

  function openCall(id: string) {
    setTab("calls");
    setSelectedId(id);
    writeUrl({ tab: "calls", call: id });
  }

  function closeCall() {
    setSelectedId(null);
    setDetail(null);
    setSelectedRow(null);
    writeUrl({ tab: "calls", call: null });
  }

  const runnerOnline = management.hermesStatus === "online";
  const tabs: Array<{ id: WorkspaceTab; label: string; hidden?: boolean }> = [
    { id: "calls", label: "שיחות" },
    { id: "checklist", label: "צ׳ק־ליסט" },
    { id: "keys", label: "מפתחות", hidden: !isAdmin },
  ];

  return (
    <section className="mx-auto w-full max-w-[88rem] space-y-5 sm:space-y-6" dir="rtl">
      <header className="dash-enter px-0.5 sm:px-0">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground sm:text-xs">
          בקרה רגולטורית · שיחות שיקוף · סופיה · Voicenter
        </p>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-2xl bg-highlight/35 sm:size-10">
                <Headphones className="size-4 sm:size-5" />
              </span>
              <h1 className="text-[1.45rem] font-semibold leading-tight tracking-tight sm:text-3xl sm:leading-none">
                בקרת שיחות
              </h1>
            </div>
            <p className="mt-2 hidden max-w-2xl text-sm leading-relaxed text-muted-foreground sm:block">
              כל השיחות כאן הן שיקוף. הבקרה בודקת שהשיקוף מתבצע ברמה הגבוהה
              ביותר — לפי צ׳ק־ליסט 11.14.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold",
                  runnerOnline
                    ? "bg-emerald-50 text-emerald-800"
                    : management.hermesStatus === "offline"
                      ? "bg-red-50 text-red-800"
                      : "bg-amber-50 text-amber-900",
                )}
              >
                <span
                  className={cn(
                    runnerOnline
                      ? "status-live-dot"
                      : management.hermesStatus === "offline"
                        ? "size-2 rounded-full bg-red-500"
                        : "status-live-dot status-live-dot--amber",
                  )}
                  aria-hidden
                />
                {runnerLabel(management.hermesStatus)}
              </span>
              <span className="text-[11px] text-muted-foreground">
                נראה {formatSeen(management.hermesLastSeenAt)}
              </span>
            </div>
            <ConnectionChips tools={management.tools} />
          </div>
        </div>
      </header>

      <div className="dash-enter flex gap-1 border-b border-black/[0.08]" style={{ animationDelay: "30ms" }}>
        {tabs
          .filter((t) => !t.hidden)
          .map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => openTab(item.id)}
              className={cn(
                "relative px-4 py-3 text-sm font-semibold transition-colors",
                tab === item.id
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.id === "keys" ? (
                <span className="inline-flex items-center gap-1.5">
                  <KeyRound className="size-3.5" />
                  {item.label}
                </span>
              ) : (
                item.label
              )}
              {tab === item.id ? (
                <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-highlight" />
              ) : null}
            </button>
          ))}
      </div>

      {tab === "calls" ? (
        <div className="space-y-4">
          <AgentOpsPanel
            hermesStatus={management.hermesStatus}
            hermesLastSeenAt={management.hermesLastSeenAt}
            tools={management.tools}
            rows={rows}
          />

          <div className="app-surface overflow-hidden">
            <div className="flex flex-wrap items-end gap-3 border-b border-black/[0.06] px-4 py-3 sm:px-5">
              <div className="flex flex-wrap gap-1.5">
                {STATUS_FILTERS.map((opt) => (
                  <FilterChip
                    key={opt.id}
                    active={status === opt.id}
                    onClick={() => setStatus(opt.id)}
                  >
                    {opt.label}
                  </FilterChip>
                ))}
                <FilterChip
                  active={criticalOnly}
                  onClick={() => setCriticalOnly((v) => !v)}
                >
                  קריטי
                </FilterChip>
              </div>
              <label className="text-[11px] font-medium text-muted-foreground">
                מתאריך
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="mt-1 block h-9 w-full rounded-xl border border-black/[0.08] bg-background px-3 text-sm sm:w-36"
                />
              </label>
              <label className="text-[11px] font-medium text-muted-foreground">
                עד
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="mt-1 block h-9 w-full rounded-xl border border-black/[0.08] bg-background px-3 text-sm sm:w-36"
                />
              </label>
              <p className="ms-auto pb-1 text-xs text-muted-foreground">
                {filtered.length} שיחות
                {filtered.length !== rows.length ? ` מתוך ${rows.length}` : ""}
              </p>
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                <PhoneOff className="size-6 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  {rows.length === 0
                    ? "אין עדיין שיחות שיקוף מ-Voicenter."
                    : "אין שיחות לפי הסינון הנוכחי."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[52rem] text-right text-sm">
                  <thead className="text-[11px] text-muted-foreground">
                    <tr className="border-b border-black/[0.06]">
                      <th className="px-4 py-3 font-medium">תאריך</th>
                      <th className="px-4 py-3 font-medium">לקוח</th>
                      <th className="px-4 py-3 font-medium">נציג</th>
                      <th className="px-4 py-3 font-medium">משך</th>
                      <th className="px-4 py-3 font-medium">סטטוס</th>
                      <th className="px-4 py-3 font-medium">ציון</th>
                      <th className="px-4 py-3 font-medium">קריטי</th>
                      <th className="px-4 py-3 font-medium">CallID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => (
                      <tr
                        key={row.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openCall(row.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openCall(row.id);
                          }
                        }}
                        className={cn(
                          "cursor-pointer border-b border-black/[0.04] last:border-0 hover:bg-highlight/20",
                          selectedId === row.id && "bg-highlight/30",
                        )}
                      >
                        <td className="whitespace-nowrap px-4 py-3.5">
                          {formatCallClock(row.callDate)}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-medium">
                            {row.customerName ?? "לקוח לא זוהה"}
                          </span>
                          {row.isDemo ? (
                            <span className="ms-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                              דמה
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3.5">{row.agentName}</td>
                        <td className="px-4 py-3.5 tabular-nums">
                          {formatDuration(row.durationSec)}
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusPill status={row.processingStatus} />
                        </td>
                        <td className="px-4 py-3.5 tabular-nums font-semibold">
                          {formatScore(row.overallScore)}
                        </td>
                        <td className="px-4 py-3.5">
                          {row.hasCritical ? (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-800">
                              כן
                            </span>
                          ) : (
                            <span className="text-muted-foreground">לא</span>
                          )}
                        </td>
                        <td
                          className="px-4 py-3.5 font-mono text-xs text-muted-foreground"
                          dir="ltr"
                        >
                          {row.voicenterCallId ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <Dialog
        open={Boolean(selectedId)}
        onOpenChange={(open) => {
          if (!open) closeCall();
        }}
      >
        <DialogContent
          dir="rtl"
          className="fixed inset-x-2 top-[max(0.5rem,env(safe-area-inset-top))] bottom-[max(0.5rem,env(safe-area-inset-bottom))] flex h-auto max-h-none w-auto max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-[1.25rem] border-black/[0.08] bg-white p-0 shadow-[0_24px_80px_-24px_rgba(17,17,17,0.45)] data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0 data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0 sm:inset-auto sm:bottom-auto sm:left-[50%] sm:right-auto sm:top-[50%] sm:h-[min(94dvh,calc(100dvh-1.5rem))] sm:max-h-[min(94dvh,calc(100dvh-1.5rem))] sm:w-[min(96vw,80rem)] sm:max-w-[80rem] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-[1.5rem] sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%] sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%]"
        >
          <DialogTitle className="sr-only">
            {selectedRow?.customerName ?? "כרטיס שיחה"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            פירוט שיחת שיקוף, ציון, צ׳ק־ליסט ותמלול
          </DialogDescription>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [&_article>header]:pe-14">
            {pending && !selectedRow ? (
              <div className="px-6 py-16 text-center text-sm text-muted-foreground">
                טוען כרטיס…
              </div>
            ) : detailError ? (
              <div className="px-6 py-16 text-center text-sm text-red-700">
                {detailError}
              </div>
            ) : selectedRow ? (
              <CallCard key={selectedRow.id} row={selectedRow} detail={detail} />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {tab === "checklist" ? <ChecklistReference /> : null}

      {tab === "keys" && isAdmin ? (
        <div className="app-surface px-5 py-6 sm:px-7">
          <AgentApiKeyPanel slug="call-control" initialKeys={keys} />
        </div>
      ) : null}
    </section>
  );
}
