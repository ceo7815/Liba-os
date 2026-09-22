import {
  CALL_QA_CHECKLIST_CATALOG,
  SCORE_WEIGHTS,
  isChecklistStatus,
  parseCallQaFindings,
  type ChecklistItemResult,
  type ChecklistStatus,
  type CallQaFindings,
} from "@/lib/agents/call-qa-checklist";

export type ScoreBucket = "compliance" | "professionalism" | "quality";

export type OpsChecklistItem = {
  id: string;
  title: string;
  prompt: string;
  bucket: ScoreBucket;
  critical?: boolean;
  /** AI checklist item ids this row is built from */
  sourceIds: string[];
};

/** טופס 11.14 — בקרת שיקוף / רגולציה / תפעול מכירה */
export const OPS_CHECKLIST_11_14: OpsChecklistItem[] = [
  {
    id: "identity",
    title: "הזדהות",
    prompt: "הנציג הציג שם ותפקיד בסוכנות ליבה.",
    bucket: "compliance",
    sourceIds: ["4.1", "4.2"],
  },
  {
    id: "purpose",
    title: "מטרת השיחה",
    prompt: "הובהר אם זו מכירה, שיקוף, רגולציה או המשך.",
    bucket: "compliance",
    sourceIds: ["4.3", "4.4"],
  },
  {
    id: "consent",
    title: "אישור להמשך",
    prompt: "התקבלה הסכמת הלקוח להמשך השיחה.",
    bucket: "compliance",
    sourceIds: ["4.5"],
  },
  {
    id: "har",
    title: "הר הביטוח",
    prompt: "הסכמה מפורשת וביצוע בדיקה באתר הר הביטוח.",
    bucket: "compliance",
    sourceIds: ["5.1", "5.2", "5.3", "5.6"],
  },
  {
    id: "insured",
    title: "פרטי המבוטח",
    prompt: "נלקחו פרטי זיהוי נדרשים (שם, ת.ז., תאריך לידה, קופ״ח).",
    bucket: "compliance",
    sourceIds: ["5.3", "6.2"],
  },
  {
    id: "needs",
    title: "בירור צרכים",
    prompt: "בוצע בירור צרכים אמיתי — לא מעבר ישיר להצעה.",
    bucket: "professionalism",
    sourceIds: ["6.1", "6.4", "6.6"],
  },
  {
    id: "existing",
    title: "כיסויים קיימים",
    prompt: "זוהו והוסברו ביטוחים וסכומים קיימים.",
    bucket: "professionalism",
    sourceIds: ["6.3", "5.7", "5.8", "7.1"],
  },
  {
    id: "switch_reason",
    title: "סיבת מעבר / החלפה",
    prompt: "אם יש פוליסה דומה — הוסבר הקיים, הושווה, ונשאלה כוונת ביטול.",
    bucket: "compliance",
    sourceIds: ["7.1", "7.2", "7.3"],
  },
  {
    id: "offer",
    title: "הצעת כיסויים",
    prompt: "הוסבר כל כיסוי שנמכר — מה מקבלים, סכום, פיצוי/שיפוי.",
    bucket: "professionalism",
    sourceIds: ["8.1", "8.2", "8.3", "8.10"],
  },
  {
    id: "insurers",
    title: "הצהרת חברות",
    prompt: "גילוי על החברות שעמן עובדת הסוכנות, בלי הטעיה.",
    bucket: "compliance",
    sourceIds: ["4.6", "4.7"],
  },
  {
    id: "start_date",
    title: "תחילת ביטוח",
    prompt: "הוסבר שהכיסוי אינו מיידי וכפוף לאישור החברה.",
    bucket: "compliance",
    sourceIds: ["20.1", "20.2", "20.3"],
  },
  {
    id: "premium",
    title: "עלות הביטוח",
    prompt: "נמסרה פרמיה לכל מוצר ועלות כוללת.",
    bucket: "professionalism",
    sourceIds: ["15.1", "15.2"],
  },
  {
    id: "discount",
    title: "הנחה",
    prompt: "אם ניתנה הנחה — שיעור, תקופה ומה אחריה.",
    bucket: "professionalism",
    sourceIds: ["15.5", "15.6"],
  },
  {
    id: "cancel_change",
    title: "שינוי או ביטול",
    prompt: "הוסברה אפשרות שינוי/ביטול והשלכות.",
    bucket: "compliance",
    sourceIds: ["11.5", "7.4"],
  },
  {
    id: "disclosure",
    title: "גילוי נאות",
    prompt: "נשלח, הוסבר, והלקוח נשאל אם קיבל.",
    bucket: "compliance",
    sourceIds: ["12.1", "12.2", "12.4", "12.5"],
  },
  {
    id: "beneficiaries",
    title: "מוטבים (ריסק)",
    prompt: "בביטוח חיים — למי משולמים תגמולים ומוטבים.",
    bucket: "professionalism",
    sourceIds: ["9.2"],
  },
  {
    id: "health",
    title: "הצהרת בריאות",
    prompt: "סעיף קריטי — שאלות מלאות, כל בגיר בנפרד, בלי תשובה כללית.",
    bucket: "compliance",
    critical: true,
    sourceIds: ["13.1", "13.2", "13.3", "13.4", "13.5"],
  },
  {
    id: "payment",
    title: "אמצעי תשלום",
    prompt: "פרטים, זהות בעל הכרטיס, הסכמה אם המשלם שונה.",
    bucket: "compliance",
    sourceIds: ["16.1", "16.2", "16.3"],
  },
  {
    id: "applicant_consent",
    title: "הסכמת המועמד / אישור עסקה",
    prompt: "נשאלה שאלה מפורשת והתקבלה תשובה ברורה. לא רק מסירת כרטיס.",
    bucket: "compliance",
    sourceIds: ["19.1", "19.2", "19.5"],
  },
  {
    id: "close",
    title: "סיום השיחה",
    prompt: "סיכום, עלות, שאלות ודרך חזרה לסוכנות.",
    bucket: "quality",
    sourceIds: ["21.1", "21.2", "21.3", "21.4", "21.5"],
  },
  {
    id: "quality",
    title: "איכות השיחה",
    prompt: "הקשבה, בהירות, בלי לחץ או מידע מטעה.",
    bucket: "quality",
    sourceIds: ["22.1", "22.5", "22.6", "22.7"],
  },
];

export type OpsRowResult = OpsChecklistItem & {
  status: ChecklistStatus;
  evidence: string | null;
  whatHappened: string | null;
  shouldHave: string | null;
  timestampSec: number | null;
  sources: ChecklistItemResult[];
};

const STATUS_RANK: Record<ChecklistStatus, number> = {
  not_done: 4,
  partial: 3,
  unverifiable: 2,
  done: 1,
  not_relevant: 0,
};

function indexAiItems(findings: CallQaFindings | null): Map<string, ChecklistItemResult> {
  const map = new Map<string, ChecklistItemResult>();
  for (const section of findings?.checklist ?? []) {
    for (const item of section.items ?? []) {
      if (item?.item_id && isChecklistStatus(item.status)) {
        map.set(item.item_id, item);
      }
    }
  }
  return map;
}

function rollupStatus(items: ChecklistItemResult[]): ChecklistStatus {
  if (items.length === 0) return "unverifiable";
  const statuses = items.map((i) => i.status);
  if (statuses.every((s) => s === "not_relevant")) return "not_relevant";
  const scored = statuses.filter((s) => s !== "not_relevant");
  if (scored.length === 0) return "not_relevant";
  if (scored.every((s) => s === "unverifiable")) return "unverifiable";
  const actionable = scored.filter((s) => s !== "unverifiable");
  if (actionable.length === 0) return "unverifiable";
  return actionable.reduce((worst, s) =>
    STATUS_RANK[s] > STATUS_RANK[worst] ? s : worst,
  );
}

export function buildOpsRows(findingsRaw: unknown): OpsRowResult[] {
  const findings = parseCallQaFindings(findingsRaw);
  const ai = indexAiItems(findings);
  return OPS_CHECKLIST_11_14.map((def) => {
    const sources = def.sourceIds
      .map((id) => ai.get(id))
      .filter((x): x is ChecklistItemResult => Boolean(x));
    const evidence =
      sources.map((s) => s.evidence).find((e) => typeof e === "string" && e.trim()) ??
      null;
    const what =
      sources.map((s) => s.what_happened).find((e) => typeof e === "string" && e.trim()) ??
      null;
    const should =
      sources.map((s) => s.should_have).find((e) => typeof e === "string" && e.trim()) ??
      null;
    const ts =
      sources.map((s) => s.timestamp_sec).find((n) => typeof n === "number") ?? null;
    return {
      ...def,
      status: rollupStatus(sources),
      evidence,
      whatHappened: what,
      shouldHave: should,
      timestampSec: ts,
      sources,
    };
  });
}

function itemPoints(status: ChecklistStatus): number | null {
  switch (status) {
    case "done":
      return 1;
    case "partial":
      return 0.5;
    case "not_done":
      return 0;
    default:
      return null;
  }
}

export function scoreFromOpsRows(rows: OpsRowResult[]): {
  total: number | null;
  compliance: number | null;
  professionalism: number | null;
  service_quality: number | null;
  relevantCount: number;
  counts: Record<ChecklistStatus, number>;
} {
  const counts: Record<ChecklistStatus, number> = {
    done: 0,
    partial: 0,
    not_done: 0,
    not_relevant: 0,
    unverifiable: 0,
  };
  for (const row of rows) counts[row.status] += 1;

  const bucketMax: Record<ScoreBucket, number> = {
    compliance: SCORE_WEIGHTS.compliance,
    professionalism: SCORE_WEIGHTS.professionalism,
    quality: SCORE_WEIGHTS.service_quality,
  };

  function bucketScore(bucket: ScoreBucket): number | null {
    const relevant = rows.filter(
      (r) => r.bucket === bucket && itemPoints(r.status) != null,
    );
    if (relevant.length === 0) return null;
    const earned = relevant.reduce((sum, r) => sum + (itemPoints(r.status) ?? 0), 0);
    return Math.round((earned / relevant.length) * bucketMax[bucket]);
  }

  const compliance = bucketScore("compliance");
  const professionalism = bucketScore("professionalism");
  const quality = bucketScore("quality");
  const parts = [compliance, professionalism, quality].filter(
    (n): n is number => n != null,
  );
  const relevantCount = rows.filter((r) => itemPoints(r.status) != null).length;
  const presentMax =
    (compliance != null ? SCORE_WEIGHTS.compliance : 0) +
    (professionalism != null ? SCORE_WEIGHTS.professionalism : 0) +
    (quality != null ? SCORE_WEIGHTS.service_quality : 0);
  const total =
    parts.length === 0 || presentMax === 0
      ? null
      : Math.round((parts.reduce((a, b) => a + b, 0) / presentMax) * SCORE_WEIGHTS.total);

  return {
    total,
    compliance,
    professionalism,
    service_quality: quality,
    relevantCount,
    counts,
  };
}

export function catalogItemCount(): number {
  return CALL_QA_CHECKLIST_CATALOG.reduce((n, s) => n + s.items.length, 0);
}
