import {
  emptyReport,
  reportId,
  type PortfolioReport,
  type ReportSide,
} from "@/lib/shemesh/portfolio-report";
import type { PolicyDocument } from "@/lib/shemesh/portfolio-from-documents";

const CHAT_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = process.env.OPENAI_TEXT_MODEL?.trim() || "gpt-4o";
const TIMEOUT_MS = 90_000;

const INSTRUCTIONS = `אתה בונה דוח השוואת תיק ביטוחי בעברית, באותו מבנה של דוח ליבה.
החזר JSON בלבד, בלי מרקדאון.

כללים:
- המצב הקיים נלקח רק מטקסט דפי הפוליסה. המצב החדש נלקח רק מההצעה שהודבקה.
- בלוק אחד לכל אדם ולכל תחום: חיים, בריאות, מחלות קשות או פיצוי סרטן, ופוליסות שנשארות.
- פוליסה שההצעה אומרת שנשארת בלי שינוי כיסוי מופיעה בשני הצדדים. אם לא נתנו מחיר חדש, אותו מחיר בשני הצדדים.
- total הוא העלות החודשית אחרי הנחה, מספר בלבד כמו 1346.19. בלי סימן מטבע.
- lines הוא כיסויים, שורה לכל כיסוי, עם הסכום והמחיר שכתובים במקור.
- note הוא החלטת הביצוע, אם יש. אחרת מחרוזת ריקה.
- אסור להמציא מחיר, סכום ביטוח, הנחה או החרגה שלא כתובים. אם אין מחיר, total ריק.
- existingCaption ו-proposedCaption קצרים, למשל "6 פוליסות ב־3 חברות".
- gains: מה המשפחה מקבלת לצד החיסכון. שורה לכל נקודה.
- checks: מה יורד בסכום, מה לא נכלל בהצעה, ושהמחיר יכול להשתנות. שורה לכל נקודה.
- familyName בפורמט "משפחת ..." לפי ההצעה או הפוליסות.`;

type ModelSide = {
  title?: unknown;
  note?: unknown;
  lines?: unknown;
  total?: unknown;
};

type ModelBlock = {
  title?: unknown;
  existing?: ModelSide;
  proposed?: ModelSide;
};

type ModelReport = {
  familyName?: unknown;
  existingCaption?: unknown;
  proposedCaption?: unknown;
  blocks?: ModelBlock[];
  gains?: unknown;
  checks?: unknown;
};

function text(value: unknown, max = 4000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function money(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return String(Math.round(value * 100) / 100);
  }
  const raw = text(value, 40).replace(/[^\d.]/g, "");
  const amount = Number(raw);
  return raw && Number.isFinite(amount) ? String(Math.round(amount * 100) / 100) : "";
}

function side(value: ModelSide | undefined): ReportSide {
  return {
    title: text(value?.title, 180),
    note: text(value?.note, 500),
    lines: text(value?.lines, 2500),
    costs: [],
    total: money(value?.total),
  };
}

function parseJson(raw: string): ModelReport | null {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as ModelReport;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as ModelReport;
    } catch {
      return null;
    }
  }
}

function toReport(model: ModelReport, manager: string): PortfolioReport | null {
  const familyName = text(model.familyName, 80);
  const blocks = (model.blocks ?? [])
    .map((block) => ({
      id: reportId(),
      title: text(block.title, 120),
      existing: side(block.existing),
      proposed: side(block.proposed),
    }))
    .filter((block) => block.title || block.existing.total || block.proposed.total || block.existing.lines || block.proposed.lines);
  if (!familyName || blocks.length === 0) return null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
  return {
    ...emptyReport(),
    familyName,
    manager: manager || "שי בר-און",
    updatedOn: today,
    existingCaption: text(model.existingCaption, 120),
    proposedCaption: text(model.proposedCaption, 120),
    blocks,
    gains: text(model.gains, 2500),
    checks: text(model.checks, 2500),
  };
}

function sourceText(documents: PolicyDocument[], brief: string): string {
  const policies = documents
    .map((document) => `קובץ: ${document.name}\n${document.text.slice(0, 14_000)}`)
    .join("\n\n---\n\n")
    .slice(0, 80_000);
  return `ההצעה שהודבקה:\n${brief.slice(0, 20_000)}\n\nדפי הפוליסה:\n${policies}`;
}

export async function buildPortfolioWithModel(
  documents: PolicyDocument[],
  brief: string,
  manager: string,
): Promise<{ report: PortfolioReport } | { error: string }> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return { error: "אין מפתח למודל, ולכן הדוח לא נבנה." };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(CHAT_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: INSTRUCTIONS },
          { role: "user", content: sourceText(documents, brief) },
        ],
      }),
    });
    if (response.status === 429) {
      return { error: "לחשבון המודל אין יתרה. צריך להטעין קרדיט ב־OpenAI, ואז לבנות את הדוח שוב." };
    }
    if (!response.ok) return { error: "המודל לא ענה, והדוח לא נבנה." };
    const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const parsed = parseJson(payload.choices?.[0]?.message?.content ?? "");
    const report = parsed ? toReport(parsed, manager) : null;
    return report ? { report } : { error: "המודל לא החזיר דוח שאפשר להציג." };
  } catch {
    return { error: "המודל לא הספיק לבנות את הדוח. נסו שוב." };
  } finally {
    clearTimeout(timer);
  }
}
