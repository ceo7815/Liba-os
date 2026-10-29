/** Sofia's Voicenter extension. CDR webhooks for other extensions are acknowledged and dropped. */
export const SOFIA_EXTENSION = "LvMpqlBj";
export const SOFIA_USER_ID = "211361";

export type CdrRecord = Record<string, unknown>;

/**
 * ring = NEWCALL / callstatus Ringing|Dialing.
 * answer = reason ANSWER / callstatus Talking, before the recording exists.
 * hangup = reason HANGUP, or the end-of-call CDR (terminal DialStatus, or record/aiData).
 * Voicenter Real Time API + CDR Notification System API.
 */
export type CallStage = "ring" | "answer" | "hangup";

export type ParsedCdr = {
  callId: string;
  sofia: boolean;
  stage: CallStage | null;
  callDate: string | null;
  durationSec: number | null;
  recordUrl: string | null;
  callerPhone: string | null;
  representativeName: string | null;
  direction: string | null;
  callType: string | null;
  dialStatus: string | null;
  fullText: string | null;
  segments: unknown[] | null;
  aiSummary: string | null;
};

function asRecord(value: unknown): CdrRecord | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as CdrRecord;
  }
  return null;
}

function text(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function field(record: CdrRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = text(record[key]);
    if (value) return value;
  }
  return null;
}

function parseJsonObject(value: unknown): CdrRecord | null {
  if (typeof value === "string") {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return null;
    }
  }
  return asRecord(value);
}

function parsedBody(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function recordsOf(value: unknown): CdrRecord[] {
  if (Array.isArray(value)) {
    return value.map(asRecord).filter((row): row is CdrRecord => row != null);
  }
  const record = asRecord(value);
  return record ? [record] : [];
}

/** One POST may be a single CDR, a list, or a wrapper around either. */
export function listCdrRecords(raw: unknown): CdrRecord[] {
  const value = parsedBody(raw);
  if (Array.isArray(value)) return recordsOf(value);
  const record = asRecord(value);
  if (!record) return [];
  for (const key of ["cdr", "CDR", "data", "calls", "records", "items"]) {
    const rows = recordsOf(parsedBody(record[key]) ?? record[key]);
    if (rows.some((row) => callIdOf(row))) return rows.filter((row) => callIdOf(row));
  }
  return [record];
}

export function parseCdrBody(raw: unknown): CdrRecord | null {
  return listCdrRecords(raw)[0] ?? null;
}

function isSofiaExtension(value: string | null): boolean {
  return value?.toLowerCase() === SOFIA_EXTENSION.toLowerCase();
}

export function isSofiaCall(cdr: CdrRecord): boolean {
  const extensionFields = [
    field(cdr, ["extenUser", "ExtenUser", "extension", "Extension"]),
    field(cdr, ["targetextension", "targetExtension", "TargetExtension", "Targetextension"]),
    field(cdr, ["callerextension", "callerExtension", "CallerExtension"]),
    field(cdr, ["target", "Target"]),
    field(cdr, ["caller", "Caller"]),
  ];
  if (extensionFields.some(isSofiaExtension)) return true;
  const userId = field(cdr, [
    "representative_code",
    "representativeCode",
    "RepresentativeCode",
    "UserId",
    "userId",
    "userID",
    "UserID",
  ]);
  if (userId === SOFIA_USER_ID) return true;
  const name = field(cdr, [
    "representative_name",
    "representativeName",
    "RepresentativeName",
    "targetextension_name",
    "callerextension_name",
    "UserName",
    "userName",
    "extenName",
  ]);
  return Boolean(name && name.includes("סופיה"));
}

function callIdOf(cdr: CdrRecord): string | null {
  return field(cdr, [
    "ivruniqueid",
    "ivrUniqueId",
    "IVRUniqueID",
    "IvrUniqueId",
    "Ivruniqueid",
    "ivrid",
    "ivrId",
    "IVRID",
    "callId",
    "CallID",
    "call_id",
  ]);
}

/** Real-time socket payloads nest the leg under data.currentCall. CDR posts are flat. */
export function flattenCdr(raw: CdrRecord): CdrRecord {
  const data = asRecord(raw.data) ?? asRecord(raw.Data);
  const current = data
    ? (asRecord(data.currentCall) ?? asRecord(data.CurrentCall))
    : null;
  return {
    ...raw,
    ...(data ?? {}),
    ...(current ?? {}),
    reason: raw.reason ?? data?.reason ?? current?.reason,
    eventName: raw.eventName ?? data?.eventName,
  };
}

const RING_TOKENS = new Set(["ring", "ringing", "dial", "dialing", "newcall", "new_call"]);
const ANSWER_TOKENS = new Set(["answer", "answered", "talking"]);
const HANGUP_TOKENS = new Set(["hangup", "hang-up", "hang_up", "ended", "end"]);
/** CDR Notification `status` / `DialStatus` values sent when the call is finished. */
const TERMINAL_DIAL = new Set([
  "noanswer",
  "no-answer",
  "busy",
  "cancel",
  "abandone",
  "abandoned",
  "te",
  "voend",
  "notcalled",
  "congestion",
  "chanunavail",
  "invalidargs",
  "sswpreauth",
]);

function token(value: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Which push this is. Recording URL and aiData mean the hangup/end CDR even when
 * `status` is ANSWER (that field is the dial result, not the live stage).
 */
export function callStage(cdr: CdrRecord): CallStage | null {
  const record = flattenCdr(cdr);
  const reason = token(field(record, ["reason", "Reason", "event", "Event"]));
  const callStatus = token(field(record, ["callstatus", "CallStatus", "callStatus"]));
  const dialStatus = token(
    field(record, [
      "status",
      "Status",
      "DialStatus",
      "dialStatus",
      "leg1DialStatusName",
      "StatusName",
    ]),
  );
  const hasMedia = Boolean(recordUrlOf(record) || transcriptOf(aiOf(record)).fullText);
  if (hasMedia) return "hangup";
  if (RING_TOKENS.has(reason) || RING_TOKENS.has(callStatus) || RING_TOKENS.has(dialStatus)) {
    return "ring";
  }
  if (HANGUP_TOKENS.has(reason) || HANGUP_TOKENS.has(callStatus) || HANGUP_TOKENS.has(dialStatus)) {
    return "hangup";
  }
  if (ANSWER_TOKENS.has(reason) || ANSWER_TOKENS.has(callStatus)) return "answer";
  if (dialStatus === "answer" || dialStatus === "answered") {
    const duration = durationOf(record);
    if (duration != null && duration > 0) return "hangup";
    return "answer";
  }
  if (TERMINAL_DIAL.has(dialStatus)) return "hangup";
  return null;
}

function recordUrlOf(cdr: CdrRecord): string | null {
  const url = field(cdr, [
    "record",
    "RecordURL",
    "recordUrl",
    "recordurl",
    "RecordUrl",
  ]);
  if (!url || !/^https?:\/\//i.test(url)) return null;
  return url;
}

function epochIso(value: unknown): string | null {
  const raw = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return null;
  const ms = raw > 1e12 ? raw : raw * 1000;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function callDateOf(cdr: CdrRecord): string | null {
  const fromEpoch = epochIso(cdr.time ?? cdr.Time);
  if (fromEpoch) return fromEpoch;
  const raw = field(cdr, ["date", "Date", "call_date", "callDate"]);
  if (!raw) return null;
  const asEpoch = epochIso(raw);
  if (asEpoch && /^\d+$/.test(raw)) return asEpoch;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function durationOf(cdr: CdrRecord): number | null {
  for (const key of ["actualCallDuration", "duration", "Duration"]) {
    const value = cdr[key];
    const n =
      typeof value === "number"
        ? value
        : typeof value === "string" && value.trim()
          ? Number(value)
          : NaN;
    if (Number.isFinite(n) && n >= 0) return Math.round(n);
  }
  return null;
}

function speakerLabel(speaker: string): string {
  if (speaker === "Speaker0") return "נציג";
  if (speaker === "Speaker1") return "לקוח";
  return speaker || "דובר";
}

function transcriptOf(ai: CdrRecord | null): {
  fullText: string | null;
  segments: unknown[] | null;
} {
  if (!ai) return { fullText: null, segments: null };
  const raw = ai.transcript ?? ai.Transcript;
  if (typeof raw === "string" && raw.trim()) {
    return { fullText: raw.trim(), segments: null };
  }
  if (!Array.isArray(raw)) return { fullText: null, segments: null };
  const lines: string[] = [];
  for (const row of raw) {
    const record = asRecord(row);
    if (!record) continue;
    const line = text(record.text);
    if (!line) continue;
    lines.push(`${speakerLabel(text(record.speaker) ?? "")}: ${line}`);
  }
  return {
    fullText: lines.length ? lines.join("\n") : null,
    segments: raw,
  };
}

function aiOf(cdr: CdrRecord): CdrRecord | null {
  return parseJsonObject(cdr.aiData ?? cdr.AIData ?? cdr.ai_data);
}

function summaryOf(ai: CdrRecord | null): string | null {
  const insights = asRecord(ai?.insights);
  return text(insights?.summary);
}

export function parseCdr(cdr: CdrRecord): ParsedCdr | null {
  const record = flattenCdr(cdr);
  const callId = callIdOf(record);
  if (!callId) return null;
  const ai = aiOf(record);
  const transcript = transcriptOf(ai);
  return {
    callId,
    sofia: isSofiaCall(record),
    stage: callStage(record),
    callDate: callDateOf(record),
    durationSec: durationOf(record),
    recordUrl: recordUrlOf(record),
    callerPhone: field(record, ["callerPhone", "caller", "Caller", "caller_phone", "callerphone"]),
    representativeName: field(record, [
      "representative_name",
      "representativeName",
      "RepresentativeName",
      "targetextension_name",
      "callerextension_name",
      "userName",
      "UserName",
    ]),
    direction: field(record, ["direction", "Direction"]),
    callType: field(record, ["type", "Type"]),
    dialStatus: field(record, [
      "status",
      "Status",
      "DialStatus",
      "dialStatus",
      "leg1DialStatusName",
      "StatusName",
      "callstatus",
      "CallStatus",
    ]),
    fullText: transcript.fullText,
    segments: transcript.segments,
    aiSummary: summaryOf(ai),
  };
}
