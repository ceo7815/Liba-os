import {
  isAnalysisIncomplete,
  mergeCallIdentification,
  parseCallQaFindings,
  resolveRubricScores,
} from "@/lib/agents/call-qa-checklist";
import { buildOpsRows, scoreFromOpsRows } from "@/lib/call-control/ops-checklist";

export const CALL_KINDS = ["reflection", "regulation", "unclassified"] as const;
export type CallKind = (typeof CALL_KINDS)[number];

export const PROCESSING_STATUSES = [
  "waiting",
  "processing",
  "ready",
  "failed",
] as const;
export type ProcessingStatus = (typeof PROCESSING_STATUSES)[number];

export const CALL_KIND_LABELS: Record<CallKind, string> = {
  reflection: "שיקוף",
  regulation: "רגולציה",
  unclassified: "לא מסווג",
};

export const PROCESSING_LABELS: Record<ProcessingStatus, string> = {
  waiting: "ממתינה",
  processing: "בעיבוד",
  ready: "מוכנה",
  failed: "נכשלה",
};

export const REGULATION_SECTION_IDS = new Set([
  "4",
  "5",
  "7",
  "12",
  "13",
  "19",
]);

const SOPHIA_RE = /סופיה/;

export type CallControlRow = {
  id: string;
  externalId: string | null;
  voicenterCallId: string | null;
  source: string;
  callDate: string | null;
  durationSec: number | null;
  customerName: string | null;
  agentName: string;
  callKind: CallKind;
  callTypeLabel: string;
  processingStatus: ProcessingStatus;
  rawStatus: string;
  overallScore: number | null;
  hasCritical: boolean;
  analysisIncomplete: boolean;
  incompleteInsurers: string[];
  audioPath: string | null;
  isDemo: boolean;
};

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return {};
}

function softStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t || null;
}

export function classifyCallKind(raw: string | null | undefined): CallKind {
  const t = (raw ?? "").trim();
  if (/שיקוף/.test(t)) return "reflection";
  if (/רגולצ/.test(t)) return "regulation";
  return "unclassified";
}

export function mapProcessingStatus(status: string): ProcessingStatus {
  switch (status) {
    case "processing":
    case "claimed":
      return "processing";
    case "done":
      return "ready";
    case "failed":
      return "failed";
    default:
      return "waiting";
  }
}

export function isSophiaAgent(name: string | null | undefined): boolean {
  const t = (name ?? "").trim();
  if (!t) return true;
  return SOPHIA_RE.test(t);
}

export function formatCallClock(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatDuration(sec: number | null): string {
  if (sec == null || !Number.isFinite(sec)) return "—";
  const total = Math.max(0, Math.round(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatScore(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return String(Math.round(value));
}

export function toCallControlRow(input: {
  id: string;
  external_id: string | null;
  source: string;
  status: string;
  call_date: string | null;
  duration_sec: number | null;
  audio_path: string | null;
  metadata: unknown;
  overall_score?: number | string | null;
  findings?: unknown;
  rubric_scores?: unknown;
}): CallControlRow {
  const meta = asRecord(input.metadata);
  const findings = parseCallQaFindings(input.findings);
  const ident = mergeCallIdentification(input.rubric_scores, findings);
  const customer =
    ident.customer_name ||
    softStr(meta.customer_name) ||
    softStr(meta.display_name);
  const agent =
    ident.rep_name || softStr(meta.agent_name) || "סופיה";
  const typeRaw = ident.call_type || softStr(meta.call_type);
  const kind = classifyCallKind(typeRaw);
  const stored = resolveRubricScores(input.rubric_scores, input.overall_score);
  const composed = scoreFromOpsRows(buildOpsRows(input.findings));
  const scores = {
    total: composed.relevantCount > 0 ? composed.total : stored.total,
    compliance: composed.compliance ?? stored.compliance,
    professionalism: composed.professionalism ?? stored.professionalism,
    service_quality: composed.service_quality ?? stored.service_quality,
  };
  const critical = findings?.critical_events ?? [];
  const voicenterCallId =
    softStr(meta.voicenter_call_id) ||
    (input.source === "voicenter" ? softStr(input.external_id) : null) ||
    softStr(input.external_id);
  const fileName = softStr(meta.file_name) ?? "";
  const isDemo =
    (voicenterCallId ?? "").startsWith("VC-DEV") ||
    fileName.startsWith("dev-") ||
    fileName.includes("dummy") ||
    fileName.includes("demo");

  return {
    id: input.id,
    externalId: softStr(input.external_id),
    voicenterCallId,
    source: input.source,
    callDate: input.call_date,
    durationSec: input.duration_sec,
    customerName: customer,
    agentName: agent,
    callKind: kind,
    callTypeLabel: typeRaw || CALL_KIND_LABELS[kind],
    processingStatus: mapProcessingStatus(input.status),
    rawStatus: input.status,
    overallScore: scores.total,
    hasCritical: critical.length > 0,
    analysisIncomplete: isAnalysisIncomplete(findings),
    incompleteInsurers: findings?.incomplete_insurers ?? [],
    audioPath: softStr(input.audio_path),
    isDemo,
  };
}

export function isRegulationItem(sectionId: string, itemId?: string): boolean {
  if (REGULATION_SECTION_IDS.has(sectionId)) return true;
  const prefix = itemId?.split(".")[0];
  return Boolean(prefix && REGULATION_SECTION_IDS.has(prefix));
}
