/** Sofia's Voicenter extension. CDR webhooks for other extensions are acknowledged and dropped. */
export const SOFIA_EXTENSION = "LvMpqlBj";
export const SOFIA_USER_ID = "211361";

export type CdrRecord = Record<string, unknown>;

export type ParsedCdr = {
  callId: string;
  sofia: boolean;
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

export function parseCdrBody(raw: unknown): CdrRecord | null {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (Array.isArray(value)) value = value[0];
  return asRecord(value);
}

export function isSofiaCall(cdr: CdrRecord): boolean {
  const extensionFields = [
    field(cdr, ["extenUser", "ExtenUser"]),
    field(cdr, ["targetextension", "targetExtension", "TargetExtension"]),
    field(cdr, ["callerextension", "callerExtension", "CallerExtension"]),
    field(cdr, ["target", "Target"]),
    field(cdr, ["caller", "Caller"]),
  ];
  if (extensionFields.some((value) => value === SOFIA_EXTENSION)) return true;
  const userId = field(cdr, [
    "representative_code",
    "representativeCode",
    "UserId",
    "userId",
  ]);
  return userId === SOFIA_USER_ID;
}

function callIdOf(cdr: CdrRecord): string | null {
  return field(cdr, [
    "ivruniqueid",
    "ivrUniqueId",
    "IVRUniqueID",
    "IvrUniqueId",
    "callId",
    "CallID",
    "call_id",
  ]);
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
  const callId = callIdOf(cdr);
  if (!callId) return null;
  const ai = aiOf(cdr);
  const transcript = transcriptOf(ai);
  return {
    callId,
    sofia: isSofiaCall(cdr),
    callDate: callDateOf(cdr),
    durationSec: durationOf(cdr),
    recordUrl: recordUrlOf(cdr),
    callerPhone: field(cdr, ["callerPhone", "caller", "Caller", "caller_phone"]),
    representativeName: field(cdr, [
      "representative_name",
      "representativeName",
      "targetextension_name",
      "callerextension_name",
    ]),
    direction: field(cdr, ["direction", "Direction"]),
    callType: field(cdr, ["type", "Type"]),
    dialStatus: field(cdr, ["status", "Status"]),
    fullText: transcript.fullText,
    segments: transcript.segments,
    aiSummary: summaryOf(ai),
  };
}
