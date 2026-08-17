"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import {
  HardDrive,
  Mic,
  Sparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AgentApiKeyPanel } from "@/components/agents/api-key-panel";
import { AgentGuidelinesPanel } from "@/components/agents/agent-guidelines-panel";
import { CallQaReport } from "@/components/agents/call-qa-report";
import { DeleteCallButton } from "@/components/agents/delete-call-button";
import { DownloadReportPdfButton } from "@/components/agents/download-report-pdf-button";
import {
  getCallReportDetail,
  listAgentApiKeys,
  type AgentKeyMeta,
} from "@/app/actions/agents";

export type AgentDashboardData = {
  dbAgent: {
    id: string;
    slug: string;
    name: string;
    status: string;
    hermes_profile: string;
    model: string | null;
    schedule_cron: string | null;
    last_run_at: string | null;
    last_run_status: string | null;
    hermes_status: string | null;
    hermes_last_seen_at: string | null;
  } | null;
  tools: Array<{
    id: string;
    tool_name: string;
    tool_type: string;
    status: string;
    last_checked_at: string | null;
  }>;
  runs: Array<{
    id: string;
    trigger: string;
    started_at: string;
    finished_at: string | null;
    status: string;
    items_processed: number;
    items_failed: number;
    cost_usd: number | string;
    input_tokens: number;
    output_tokens: number;
  }>;
  costs: Array<{
    id: string;
    service: string;
    units: number | string | null;
    unit_type: string | null;
    cost_usd: number | string;
    occurred_at: string;
  }>;
  calls: Array<{
    id: string;
    external_id: string | null;
    source: string;
    status: string;
    call_date: string | null;
    duration_sec: number | null;
    audio_path: string | null;
    metadata: Record<string, unknown> | null;
    transcript: {
      full_text: string | null;
      segments: unknown;
      provider: string | null;
      language: string | null;
    } | null;
    analysis: {
      overall_score: number | string | null;
      summary: string | null;
      recommendations: string[] | null;
      rubric_scores: unknown;
      findings: unknown;
      model: string | null;
    } | null;
  }>;
  monthlyCostUsd: number;
  keys: AgentKeyMeta[];
  isAdmin: boolean;
  activeQueueStatus: string | null;
  agentSlug: string;
};

const TABS = [
  { id: "overview", label: "סקירה" },
  { id: "tools", label: "חיבורים וכלים" },
  { id: "runs", label: "היסטוריית הרצות" },
  { id: "costs", label: "עלויות" },
  { id: "results", label: "תוצאות" },
  { id: "guidelines", label: "הנחיות לסוכן" },
  { id: "keys", label: "מפתחות API", adminOnly: true },
] as const;

type TabId = (typeof TABS)[number]["id"];

function money(v: number | string | null | undefined) {
  const n = Number(v ?? 0);
  return `$${n.toFixed(4)}`;
}

function formatDuration(sec: number | null | undefined) {
  if (sec == null || !Number.isFinite(Number(sec))) return "—";
  const total = Math.max(0, Math.round(Number(sec)));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

function callStatusLabel(status: string) {
  const map: Record<string, string> = {
    pending: "ממתין",
    claimed: "נמשך",
    processing: "בעיבוד",
    done: "הושלם",
    failed: "נכשל",
    skipped: "דולג",
  };
  return map[status] ?? status;
}

function metaStr(
  meta: Record<string, unknown> | null | undefined,
  ...keys: string[]
) {
  if (!meta) return "";
  for (const key of keys) {
    const v = meta[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function looksLikeStatusTitle(value: string) {
  const first = value.trim().split(/[\s·•|,/-]+/)[0] ?? "";
  return /^(תקין|חלקי|כשל|לשיפור|קריטי)$/.test(first);
}

function looksLikeFakeName(value: string) {
  return looksLikeStatusTitle(value) || /^(הקבוע|לקוח|סוכן|נציג|unknown|null)$/i.test(value.trim());
}

type JsonMap = { [key: string]: unknown };

function personFromAnalysis(call: AgentDashboardData["calls"][number], ...keys: string[]) {
  const scores = call.analysis?.rubric_scores;
  if (!scores || typeof scores !== "object" || Array.isArray(scores)) return "";
  const rec = scores as JsonMap;
  for (const key of keys) {
    const v = rec[key];
    if (typeof v === "string" && v.trim() && !looksLikeFakeName(v)) return v.trim();
  }
  const ident = rec.identification;
  if (ident && typeof ident === "object" && !Array.isArray(ident)) {
    const id = ident as JsonMap;
    for (const key of keys) {
      const v = id[key];
      if (typeof v === "string" && v.trim() && !looksLikeFakeName(v)) return v.trim();
    }
  }
  return "";
}

function callCustomerName(call: AgentDashboardData["calls"][number]) {
  const name = metaStr(call.metadata, "customer_name");
  if (name && !looksLikeFakeName(name)) return name;
  return personFromAnalysis(call, "customer_name");
}

function callAgentName(call: AgentDashboardData["calls"][number]) {
  const name = metaStr(call.metadata, "agent_name", "rep_name");
  if (name && !looksLikeFakeName(name)) return name;
  return personFromAnalysis(call, "agent_name", "rep_name");
}

function callTitle(call: AgentDashboardData["calls"][number]) {
  const customer = callCustomerName(call);
  const dateIso = callDateIso(call);
  let dateLabel = "";
  if (dateIso) {
    const d = new Date(dateIso);
    if (!Number.isNaN(d.getTime())) {
      dateLabel = d.toLocaleString("he-IL", {
        timeZone: "Asia/Jerusalem",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  }
  if (customer) return dateLabel ? `${customer} · ${dateLabel}` : customer;
  const display = metaStr(call.metadata, "display_name");
  if (display && !looksLikeStatusTitle(display) && !display.startsWith("http")) {
    return display;
  }
  return dateLabel ? `לקוח לא זוהה · ${dateLabel}` : "לקוח לא זוהה";
}

function callDateIso(call: AgentDashboardData["calls"][number]) {
  if (call.call_date) return call.call_date;
  const nested = call.metadata?.call_date;
  return typeof nested === "string" && nested.trim() ? nested.trim() : null;
}

function callDurationSec(call: AgentDashboardData["calls"][number]) {
  if (call.duration_sec != null && Number.isFinite(Number(call.duration_sec))) {
    return Number(call.duration_sec);
  }
  const nested = call.metadata?.duration_sec;
  if (typeof nested === "number" && Number.isFinite(nested)) return nested;
  if (typeof nested === "string" && nested.trim() && Number.isFinite(Number(nested))) {
    return Number(nested);
  }
  return null;
}

function callDriveUrl(call: AgentDashboardData["calls"][number]) {
  const meta = call.metadata ?? {};
  if (typeof meta.drive_url === "string" && meta.drive_url.startsWith("http")) {
    return meta.drive_url;
  }
  if (call.audio_path && call.audio_path.startsWith("http")) {
    return call.audio_path;
  }
  return null;
}

function sourceLabel(source: string) {
  const map: Record<string, string> = {
    drive: "גוגל דרייב",
    "google-drive": "גוגל דרייב",
  };
  return map[source] ?? source;
}

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
}

function toolDisplayName(name: string) {
  const map: Record<string, string> = {
    "google-drive": "גוגל דרייב",
    "openai-stt": "תמלול קולי",
    "openai-gpt-5.4-mini": "מודל שפה · GPT 5.4 מיני",
    "openai-gpt": "מודל שפה",
  };
  if (map[name]) return map[name];
  if (name.startsWith("openai-gpt-")) {
    const model = name.replace(/^openai-gpt-/, "").replace(/-/g, " ");
    return `מודל שפה · GPT ${model}`;
  }
  if (name.startsWith("openai-gpt")) return "מודל שפה";
  if (name.includes("drive")) return "גוגל דרייב";
  if (name.includes("stt") || name.includes("whisper")) return "תמלול קולי";
  if (name.includes("llm") || name.includes("gpt")) return "מודל שפה";
  return name.replace(/[-_]/g, " ");
}

function toolDetailLine(name: string, type: string) {
  if (name === "google-drive" || name.includes("drive")) {
    return "מקור הקלטות מתיקייה משותפת בגוגל דרייב";
  }
  if (name === "openai-stt" || type === "stt" || name.includes("stt")) {
    return "המרת הקלטת השיחה לטקסט לתמלול מלא";
  }
  if (name === "openai-gpt-5.4-mini") {
    return "ניתוח לפי צ׳ק־ליסט הבקרה · מודל בשימוש: GPT 5.4 מיני";
  }
  if (name.startsWith("openai-gpt-")) {
    const model = name.replace(/^openai-gpt-/, "").replace(/-/g, " ");
    return `ניתוח לפי צ׳ק־ליסט הבקרה · מודל בשימוש: GPT ${model}`;
  }
  if (type === "llm") {
    return "מודל שפה לניתוח השיחה והמלצות";
  }
  if (type === "source") {
    return "מקור נתונים לסוכן";
  }
  return toolTypeLabel(type);
}

function toolTypeLabel(type: string) {
  const map: Record<string, string> = {
    source: "מקור נתונים",
    llm: "מודל שפה",
    stt: "תמלול דיבור",
    storage: "אחסון",
    api: "ממשק חיצוני",
  };
  return map[type] ?? type;
}

function toolStatusLabel(status: string) {
  const map: Record<string, string> = {
    connected: "מחובר",
    degraded: "מוגבל",
    error: "שגיאה",
    disconnected: "מנותק",
  };
  return map[status] ?? status;
}

function toolIcon(name: string, type: string): LucideIcon {
  if (name.includes("drive") || type === "source") return HardDrive;
  if (name.includes("stt") || type === "stt") return Mic;
  if (name.includes("gpt") || type === "llm") return Sparkles;
  return Wrench;
}

function toolStatusTone(status: string) {
  switch (status) {
    case "connected":
      return "bg-highlight/40 text-foreground";
    case "degraded":
      return "bg-amber-100 text-amber-950";
    case "error":
      return "bg-red-100 text-red-900";
    default:
      return "bg-background text-muted-foreground";
  }
}

function runStatusLabel(status: string | null | undefined) {
  if (!status) return "—";
  const map: Record<string, string> = {
    queued: "בתור",
    claimed: "נמשך",
    running: "רץ",
    success: "הצליח",
    failed: "נכשל",
    partial: "חלקי",
    cancelled: "בוטל",
  };
  return map[status] ?? status;
}

function triggerLabel(trigger: string) {
  const map: Record<string, string> = {
    manual: "ידני",
    cron: "תזמון אוטומטי",
    webhook: "וובהוק",
    "e2e-manual": "בדיקה ידנית",
  };
  return map[trigger] ?? trigger;
}

function runStatusTone(status: string) {
  switch (status) {
    case "success":
      return "bg-highlight/40 text-foreground";
    case "running":
    case "claimed":
    case "queued":
      return "bg-amber-100 text-amber-950";
    case "failed":
      return "bg-red-100 text-red-900";
    case "partial":
      return "bg-amber-50 text-amber-900";
    default:
      return "bg-background text-muted-foreground";
  }
}

function serviceLabel(service: string) {
  const map: Record<string, string> = {
    stt: "תמלול קולי",
    llm: "מודל שפה",
    transcription: "תמלול קולי",
    openai: "אופן־איי",
    drive: "גוגל דרייב",
    "google-drive": "גוגל דרייב",
  };
  return map[service] ?? service;
}

function serviceHint(service: string) {
  const map: Record<string, string> = {
    stt: "המרת הקלטה לטקסט",
    llm: "ניתוח השיחה לפי צ׳ק־ליסט הבקרה",
    transcription: "המרת הקלטה לטקסט",
    drive: "מקור קבצים מגוגל דרייב",
    "google-drive": "מקור קבצים מגוגל דרייב",
  };
  return map[service] ?? "שירות חיצוני שדווח על ידי הסוכן";
}

function unitTypeLabel(unitType: string | null | undefined) {
  if (!unitType) return "";
  const map: Record<string, string> = {
    tokens: "טוקנים",
    token: "טוקנים",
    minutes: "דקות",
    minute: "דקות",
    seconds: "שניות",
    second: "שניות",
    requests: "בקשות",
    request: "בקשות",
  };
  return map[unitType] ?? unitType;
}

function formatUnits(
  units: number | string | null | undefined,
  unitType: string | null | undefined,
) {
  if (units == null || units === "") return "—";
  const n = Number(units);
  const formatted = Number.isFinite(n)
    ? n.toLocaleString("he-IL", { maximumFractionDigits: 3 })
    : String(units);
  const typeHe = unitTypeLabel(unitType);
  return typeHe ? `${formatted} ${typeHe}` : formatted;
}

function Field({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
      {hint ? (
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function AgentDashboard({
  agentName,
  data,
}: {
  agentName: string;
  data: AgentDashboardData;
}) {
  const visibleTabs = TABS.filter((t) => !("adminOnly" in t && t.adminOnly) || data.isAdmin);
  const [tab, setTab] = useState<TabId>("overview");
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [calls, setCalls] = useState(data.calls);
  const [keys, setKeys] = useState(data.keys);
  const [keysLoaded, setKeysLoaded] = useState(data.keys.length > 0);
  const [detailPending, startDetailTransition] = useTransition();

  useEffect(() => {
    setCalls(data.calls);
  }, [data.calls]);

  const costsByService = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of data.costs) {
      map.set(row.service, (map.get(row.service) ?? 0) + Number(row.cost_usd));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [data.costs]);

  const selectedCall = calls.find((c) => c.id === selectedCallId) ?? null;
  const isAgentLive = data.dbAgent?.status === "active";
  const hermesOnline = data.dbAgent?.hermes_status === "online";
  const runBusy =
    data.activeQueueStatus === "running" ||
    data.activeQueueStatus === "claimed" ||
    data.activeQueueStatus === "queued" ||
    data.dbAgent?.last_run_status === "running" ||
    data.dbAgent?.last_run_status === "claimed" ||
    data.dbAgent?.last_run_status === "queued";
  const runIsAnimating =
    data.activeQueueStatus === "running" ||
    data.dbAgent?.last_run_status === "running";
  const modelFromTools =
    data.tools.find((t) => t.tool_type === "llm")?.tool_name ??
    data.dbAgent?.model ??
    null;

  function selectCall(callId: string) {
    setSelectedCallId(callId);
    const existing = calls.find((c) => c.id === callId);
    const needsDetail =
      existing &&
      (existing.analysis == null ||
        existing.analysis.findings == null ||
        existing.transcript == null);

    if (!needsDetail) return;

    startDetailTransition(async () => {
      const result = await getCallReportDetail(callId);
      if (result.error || !result.detail) {
        if (result.error) toast.error(result.error);
        return;
      }
      setCalls((prev) =>
        prev.map((c) =>
          c.id === callId
            ? {
                ...c,
                analysis: result.detail!.analysis ?? c.analysis,
                transcript: result.detail!.transcript,
              }
            : c,
        ),
      );
    });
  }

  function openTab(next: TabId) {
    setTab(next);
    if (next === "keys" && data.isAdmin && !keysLoaded) {
      startDetailTransition(async () => {
        const result = await listAgentApiKeys(data.agentSlug);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        setKeys(result.keys);
        setKeysLoaded(true);
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 border-b border-black/[0.08] pb-px">
        {visibleTabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => openTab(item.id)}
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

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="סטטוס סוכן"
              value={
                data.dbAgent?.status === "active"
                  ? "פעיל"
                  : data.dbAgent?.status === "paused"
                    ? "מושהה"
                    : data.dbAgent?.status === "error"
                      ? "שגיאה"
                      : data.dbAgent?.status === "archived"
                        ? "בארכיון"
                        : (data.dbAgent?.status ?? "—")
              }
              live={isAgentLive}
            />
            <Metric
              label="סטטוס מערכת הסוכנים"
              value={
                hermesOnline
                  ? "מחובר"
                  : data.dbAgent?.hermes_status === "offline"
                    ? "מנותק"
                    : "—"
              }
              hint={fmtDate(data.dbAgent?.hermes_last_seen_at)}
              live={hermesOnline}
            />
            <Metric
              label="הרצה אחרונה"
              value={runStatusLabel(
                data.activeQueueStatus ?? data.dbAgent?.last_run_status,
              )}
              hint={fmtDate(data.dbAgent?.last_run_at)}
              running={runIsAnimating}
              queued={runBusy && !runIsAnimating}
            />
            <Metric label="עלות החודש" value={money(data.monthlyCostUsd)} />
          </div>
          <div className="app-surface p-5">
            <h3 className="text-sm font-semibold">{agentName} — פרטי חיבור</h3>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">פרופיל הסוכן</dt>
                <dd className="mt-0.5 font-medium">
                  {data.dbAgent?.hermes_profile === "call-qa"
                    ? "בקרת שיחות"
                    : (data.dbAgent?.hermes_profile ?? "—")}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">מודל</dt>
                <dd className="mt-0.5 font-medium">
                  {modelFromTools
                    ? toolDisplayName(modelFromTools)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">תזמון אוטומטי</dt>
                <dd className="mt-0.5 font-medium">
                  {data.dbAgent?.schedule_cron ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">נקודת דיווח</dt>
                <dd className="mt-0.5 font-medium">ממשק הסוכנים</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {tab === "tools" && (
        <div>
          {data.tools.length === 0 ? (
            <div className="app-surface px-5 py-12 text-center text-sm text-muted-foreground">
              אין חיבורים מדווחים עדיין
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {data.tools.map((tool, index) => {
                const Icon = toolIcon(tool.tool_name, tool.tool_type);
                return (
                  <article
                    key={tool.id}
                    className="agent-tool-cube group app-surface p-5"
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-background transition-transform duration-300 group-hover:scale-110 group-hover:bg-highlight/35">
                        <Icon className="h-5 w-5 text-black/65 transition-colors group-hover:text-foreground" />
                      </span>
                      <span
                        className={cn(
                          "rounded-md px-2 py-0.5 text-[11px] font-medium",
                          toolStatusTone(tool.status),
                        )}
                      >
                        {toolStatusLabel(tool.status)}
                      </span>
                    </div>
                    <h3 className="mt-4 text-sm font-semibold text-foreground">
                      {toolDisplayName(tool.tool_name)}
                    </h3>
                    <p className="mt-1 text-xs font-medium text-foreground/80">
                      {toolTypeLabel(tool.tool_type)}
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {toolDetailLine(tool.tool_name, tool.tool_type)}
                    </p>
                    <div className="mt-4 border-t border-black/[0.06] pt-3">
                      <p className="text-[11px] text-muted-foreground">
                        בדיקה אחרונה
                      </p>
                      <p className="mt-0.5 text-xs font-medium tabular-nums text-foreground">
                        {fmtDate(tool.last_checked_at)}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "runs" && (
        <div>
          {data.runs.length === 0 ? (
            <div className="app-surface px-5 py-12 text-center text-sm text-muted-foreground">
              אין הרצות עדיין
            </div>
          ) : (
            <div className="space-y-3">
              {data.runs.map((run, index) => {
                const isRunning = run.status === "running";
                const isLive =
                  run.status === "running" ||
                  run.status === "queued" ||
                  run.status === "claimed";
                return (
                  <article
                    key={run.id}
                    className="agent-tool-cube group app-surface p-5"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-medium text-muted-foreground">
                          הרצה
                        </p>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {triggerLabel(run.trigger)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          סוג הפעלה של הסוכן
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isLive ? (
                          <span
                            className={cn(
                              "status-live-dot",
                              isRunning ? "status-live-dot--amber" : "",
                            )}
                            aria-hidden
                          />
                        ) : run.status === "success" ? (
                          <span className="status-live-dot" aria-hidden />
                        ) : null}
                        <span
                          className={cn(
                            "rounded-md px-2.5 py-1 text-[11px] font-medium",
                            runStatusTone(run.status),
                          )}
                        >
                          {runStatusLabel(run.status)}
                        </span>
                      </div>
                    </div>

                    {isRunning ? (
                      <div className="status-run-track mt-4" aria-hidden>
                        <span className="status-run-bar" />
                      </div>
                    ) : null}

                    <div className="mt-4 grid gap-4 border-t border-black/[0.06] pt-4 sm:grid-cols-2 lg:grid-cols-3">
                      <Field
                        label="התחלה"
                        value={fmtDate(run.started_at)}
                        hint="מתי ההרצה התחילה"
                      />
                      <Field
                        label="סיום"
                        value={fmtDate(run.finished_at)}
                        hint="מתי ההרצה הסתיימה"
                      />
                      <Field
                        label="סטטוס"
                        value={runStatusLabel(run.status)}
                        hint="תוצאת ההרצה"
                      />
                      <Field
                        label="פריטים שעובדו"
                        value={`${run.items_processed}`}
                        hint={`נכשלו: ${run.items_failed}`}
                      />
                      <Field
                        label="טוקנים"
                        value={`${run.input_tokens} / ${run.output_tokens}`}
                        hint="קלט / פלט"
                      />
                      <Field
                        label="עלות"
                        value={money(run.cost_usd)}
                        hint="עלות כוללת להרצה זו"
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "costs" && (
        <div className="space-y-4">
          <div>
            <h3 className="mb-3 text-sm font-semibold">פילוח לפי שירות</h3>
            {costsByService.length === 0 ? (
              <div className="app-surface px-5 py-10 text-center text-sm text-muted-foreground">
                אין עלויות עדיין
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {costsByService.map(([service, total], index) => (
                  <article
                    key={service}
                    className="agent-tool-cube group app-surface p-5"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-medium text-muted-foreground">
                          שירות
                        </p>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {serviceLabel(service)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {serviceHint(service)}
                        </p>
                      </div>
                      <span className="rounded-md bg-highlight/35 px-2.5 py-1 text-[11px] font-medium">
                        סיכום
                      </span>
                    </div>
                    <div className="mt-4 border-t border-black/[0.06] pt-3">
                      <p className="text-[11px] text-muted-foreground">
                        עלות מצטברת החודש
                      </p>
                      <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                        {money(total)}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold">פירוט חיובים</h3>
            {data.costs.length === 0 ? (
              <div className="app-surface px-5 py-10 text-center text-sm text-muted-foreground">
                אין רשומות עלות
              </div>
            ) : (
              <div className="space-y-3">
                {data.costs.map((c, index) => (
                  <article
                    key={c.id}
                    className="agent-tool-cube group app-surface p-5"
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-medium text-muted-foreground">
                          שירות
                        </p>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {serviceLabel(c.service)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {serviceHint(c.service)}
                        </p>
                      </div>
                      <div className="text-end">
                        <p className="text-[11px] font-medium text-muted-foreground">
                          עלות
                        </p>
                        <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                          {money(c.cost_usd)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 border-t border-black/[0.06] pt-4 sm:grid-cols-3">
                      <Field
                        label="זמן החיוב"
                        value={fmtDate(c.occurred_at)}
                        hint="מתי נרשמה העלות"
                      />
                      <Field
                        label="כמות שימוש"
                        value={formatUnits(c.units, c.unit_type)}
                        hint={
                          unitTypeLabel(c.unit_type)
                            ? `יחידת מדידה: ${unitTypeLabel(c.unit_type)}`
                            : "יחידות כפי שדווחו מהסוכן"
                        }
                      />
                      <Field
                        label="עלות בשורות"
                        value={money(c.cost_usd)}
                        hint="סכום לחיוב זה"
                      />
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "results" && (
        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-3">
            {calls.length === 0 ? (
              <div className="app-surface px-5 py-12 text-center text-sm text-muted-foreground">
                אין שיחות עדיין
              </div>
            ) : (
              calls.map((call, index) => (
                <button
                  key={call.id}
                  type="button"
                  onClick={() => selectCall(call.id)}
                  className={cn(
                    "agent-tool-cube group app-surface w-full p-4 text-start transition-[transform,box-shadow,background-color] duration-300",
                    selectedCallId === call.id
                      ? "border-highlight/70 bg-highlight/10"
                      : "hover:bg-background/60",
                  )}
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {callTitle(call)}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {sourceLabel(call.source)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-background px-2 py-0.5 text-[11px] font-medium">
                      {callStatusLabel(call.status)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-black/[0.06] pt-3 text-[11px]">
                    <div>
                      <p className="text-muted-foreground">תאריך</p>
                      <p className="mt-0.5 font-medium text-foreground">
                        {fmtDate(callDateIso(call))}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">משך</p>
                      <p className="mt-0.5 font-medium tabular-nums text-foreground">
                        {formatDuration(callDurationSec(call))}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">ציון</p>
                      <p className="mt-0.5 font-medium tabular-nums text-foreground">
                        {call.analysis?.overall_score != null
                          ? `${call.analysis.overall_score}/100`
                          : "—"}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="app-surface max-h-[75vh] overflow-y-auto p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="text-sm font-semibold">דוח בקרת שיחה</h3>
              {selectedCall ? (
                <div className="flex flex-wrap items-center gap-2">
                  <DownloadReportPdfButton
                    customerName={
                      callCustomerName(selectedCall) || "לא זוהה בשם בשיחה"
                    }
                    agentName={callAgentName(selectedCall) || "לא זוהה"}
                    title={callTitle(selectedCall)}
                    callDate={fmtDate(callDateIso(selectedCall))}
                    duration={formatDuration(callDurationSec(selectedCall))}
                    source={sourceLabel(selectedCall.source)}
                    status={callStatusLabel(selectedCall.status)}
                    fileName={
                      metaStr(selectedCall.metadata, "file_name", "name") ||
                      undefined
                    }
                    driveUrl={callDriveUrl(selectedCall)}
                    analysis={selectedCall.analysis}
                  />
                  {data.isAdmin ? (
                    <DeleteCallButton
                      slug={data.dbAgent?.slug ?? "call-control"}
                      callId={selectedCall.id}
                      callTitle={callTitle(selectedCall)}
                      onDeleted={() => setSelectedCallId(null)}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
            {!selectedCall ? (
              <p className="mt-3 text-sm text-muted-foreground">
                בחרו שיחה מהרשימה
              </p>
            ) : detailPending &&
              selectedCall.analysis?.findings == null &&
              selectedCall.transcript == null ? (
              <p className="mt-3 text-sm text-muted-foreground">טוען דוח…</p>
            ) : (
              <>
                <div className="mt-3 space-y-3 rounded-xl bg-background px-3 py-3 text-sm">
                  <div>
                    <p className="text-[11px] text-muted-foreground">שם לקוח</p>
                    <p className="mt-0.5 font-semibold">
                      {callCustomerName(selectedCall) || "לא זוהה בשם בשיחה"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">שם נציג</p>
                    <p className="mt-0.5 font-medium">
                      {callAgentName(selectedCall) || "לא זוהה"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">כותרת</p>
                    <p className="mt-0.5 font-semibold">{callTitle(selectedCall)}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] text-muted-foreground">תאריך שיחה</p>
                      <p className="mt-0.5 font-medium">
                        {fmtDate(callDateIso(selectedCall))}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">משך</p>
                      <p className="mt-0.5 font-medium tabular-nums">
                        {formatDuration(callDurationSec(selectedCall))}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">מקור</p>
                      <p className="mt-0.5 font-medium">
                        {sourceLabel(selectedCall.source)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">סטטוס</p>
                      <p className="mt-0.5 font-medium">
                        {callStatusLabel(selectedCall.status)}
                      </p>
                    </div>
                    {metaStr(selectedCall.metadata, "file_name", "name") ? (
                      <div className="sm:col-span-2">
                        <p className="text-[11px] text-muted-foreground">שם קובץ</p>
                        <p className="mt-0.5 break-all font-medium">
                          {metaStr(selectedCall.metadata, "file_name", "name")}
                        </p>
                      </div>
                    ) : null}
                  </div>
                  {callDriveUrl(selectedCall) ? (
                    <a
                      href={callDriveUrl(selectedCall)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-md bg-highlight/40 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-highlight/55"
                    >
                      פתח הקלטה בגוגל דרייב
                    </a>
                  ) : null}
                </div>
                <CallQaReport
                  analysis={selectedCall.analysis}
                  transcript={selectedCall.transcript}
                />
              </>
            )}
          </div>
        </div>
      )}

      {tab === "guidelines" && <AgentGuidelinesPanel />}

      {tab === "keys" && data.isAdmin && (
        <div className="app-surface p-5">
          {keysLoaded ? (
            <AgentApiKeyPanel
              slug={data.dbAgent?.slug ?? "call-control"}
              initialKeys={keys}
            />
          ) : (
            <p className="text-sm text-muted-foreground">טוען מפתחות…</p>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  live = false,
  running = false,
  queued = false,
}: {
  label: string;
  value: string;
  hint?: string;
  live?: boolean;
  running?: boolean;
  queued?: boolean;
}) {
  return (
    <div className="agent-metric-cube app-surface group p-4 transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(17,17,17,0.08)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        {live ? (
          <span className="status-live-dot" aria-hidden title="פעיל" />
        ) : null}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <p className="text-xl font-semibold tabular-nums text-foreground">{value}</p>
      </div>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
      {running ? (
        <div className="status-run-track mt-3" aria-hidden>
          <span className="status-run-bar" />
        </div>
      ) : null}
      {queued && !running ? (
        <div className="status-queue-track mt-3" aria-hidden>
          <span className="status-queue-bar" />
        </div>
      ) : null}
    </div>
  );
}

function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="py-10 text-center text-muted-foreground">
        {text}
      </TableCell>
    </TableRow>
  );
}
