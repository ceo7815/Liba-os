export type ToolHealth = "connected" | "degraded" | "error" | "disconnected";

export type ReportedTool = {
  tool_name: string;
  tool_type: string;
  status: string;
  last_checked_at: string | null;
};

export type ExpectedTool = {
  key: string;
  label: string;
  detail: string;
  aliases: string[];
};

/** What managers expect to see. Runner reports via os.report_tool_status. */
export const EXPECTED_CALL_TOOLS: ExpectedTool[] = [
  {
    key: "voicenter",
    label: "Voicenter",
    detail: "שיחות סופיה, תמלול מוכן, CallID",
    aliases: ["voicenter", "voicenter-api", "voicenter-cdr", "voicenter-transcript"],
  },
  {
    key: "openai",
    label: "OpenAI",
    detail: "ניתוח מול צ׳ק־ליסט ליבה בלבד",
    aliases: [
      "openai",
      "openai-gpt",
      "openai-gpt-5.4-mini",
      "openai-llm",
      "openai-stt",
    ],
  },
];

export type DisplayTool = {
  key: string;
  label: string;
  detail: string;
  status: ToolHealth | "awaiting";
  lastCheckedAt: string | null;
};

function asHealth(status: string): ToolHealth | "awaiting" {
  if (
    status === "connected" ||
    status === "degraded" ||
    status === "error" ||
    status === "disconnected"
  ) {
    return status;
  }
  return "awaiting";
}

const OBSOLETE_TOOLS = new Set([
  "google-drive",
  "google drive",
  "os-upload",
  "os upload",
  "drive",
]);

function normToolName(name: string) {
  return name.toLowerCase().replace(/[\s_]+/g, "-");
}

export function mergeExpectedTools(reported: ReportedTool[]): DisplayTool[] {
  const live = reported.filter(
    (row) => !OBSOLETE_TOOLS.has(normToolName(row.tool_name)),
  );
  const used = new Set<string>();
  const expected = EXPECTED_CALL_TOOLS.map((def) => {
    const aliases = def.aliases.map(normToolName);
    const match = live.find((row) => aliases.includes(normToolName(row.tool_name)));
    if (match) used.add(normToolName(match.tool_name));
    const family = live.filter(
      (row) =>
        normToolName(row.tool_name) === def.key ||
        normToolName(row.tool_name).startsWith(`${def.key}-`),
    );
    for (const row of family) used.add(normToolName(row.tool_name));
    return {
      key: def.key,
      label: def.label,
      detail: def.detail,
      status: match ? asHealth(match.status) : "awaiting",
      lastCheckedAt: match?.last_checked_at ?? family[0]?.last_checked_at ?? null,
    };
  });

  const extras = live
    .filter((row) => !used.has(normToolName(row.tool_name)))
    .map((row) => ({
      key: row.tool_name,
      label: row.tool_name.replace(/[-_]/g, " "),
      detail: row.tool_type,
      status: asHealth(row.status),
      lastCheckedAt: row.last_checked_at,
    }));

  return [...expected, ...extras];
}

export const TOOL_STATUS_LABELS: Record<DisplayTool["status"], string> = {
  connected: "מחובר",
  degraded: "מוגבל",
  error: "שגיאה",
  disconnected: "מנותק",
  awaiting: "ממתין לחיבור",
};

export const BUCKET_LABELS = {
  compliance: "עמידה רגולטורית",
  professionalism: "מקצועיות",
  quality: "איכות שיחה",
} as const;
