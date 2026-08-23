import { checkForbiddenPhrases } from "@/lib/social-media/forbidden";
import { buildAiCaptionSuggestion } from "@/lib/social-media/ai-suggest";
import { finalizeCaption } from "@/lib/social-media/caption-format";
import type { HolidayDay, SocialBrand, SocialCta } from "@/lib/social-media/types";

const CHAT_URL = "https://api.openai.com/v1/chat/completions";
const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL?.trim() || "gpt-4o-mini";

type ComposeInput = {
  date: string;
  idea?: string | null;
  source: "auto" | "idea";
  holiday?: HolidayDay | null;
  brand?: SocialBrand;
  ctas?: SocialCta[];
  toneGuidelines?: string;
  forbiddenPhrases?: string[];
  phone?: string | null;
  phoneSecondary?: string | null;
  address?: string | null;
  includeHashtags?: boolean;
};

function getApiKey(): string | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  return key || null;
}

function systemPrompt(input: ComposeInput): string {
  const forbidden = (input.forbiddenPhrases ?? []).filter(Boolean).join(" · ");
  const ctas = (input.ctas ?? [])
    .map((c) => c.label)
    .filter(Boolean)
    .join(" / ");
  const brand = input.brand?.name ?? "ליבה ביטוח ופיננסים";
  const tone =
    input.toneGuidelines?.trim() ||
    "בדיקה לפני מוצר. שקיפות. שפה פשוטה. לא דוחפים פוליסה.";

  return [
    `אתה קופירייטר בכיר של ${brand} לפייסבוק עמוד + אינסטגרם (אותו כיתוב לשניהם).`,
    `טון: ${tone}`,
    "אל תמציא מחירים, אחוזי כיסוי, או הבטחות.",
    forbidden ? `אסור להשתמש בביטויים האלה: ${forbidden}` : "",
    "מבנה חובה — קומפקטי, לא מרווח מדי:",
    "1) שורת הוק לבד, עד ~90 תווים, אימוג'י אחד בסוף השורה.",
    "2) שורה ריקה אחת בלבד אחרי ההוק — לא שתיים ולא שלוש.",
    "3) 2–4 משפטי גוף, כל משפט בשורה נפרדת, ירידת שורה אחת ביניהם בלי שורה ריקה. אימוג'י תפקודי בסוף השורה (💛 📌 ✅) — סה״כ 3–5.",
    "4) שורה ריקה אחת, ואז CTA שמתחיל ב-👉 מתוך: " +
      (ctas || "שיחת היכרות קצרה, בלי לחץ."),
    "5) מיד אחרי ה-CTA, בלי רווח גדול: המידע כללי ואינו המלצה פרטנית.",
    "אסור: פסקה אחת ארוכה, שורות ריקות כפולות, היי כולם, האשטגים, טלפון, כתובת, אימוג'י מוגזם, אנגלית.",
    "החזר רק את טקסט הפוסט עם ירידות שורה אמיתיות.",
  ]
    .filter(Boolean)
    .join("\n");
}

function userPrompt(input: ComposeInput): string {
  if (input.source === "idea" && input.idea?.trim()) {
    return `נסח מחדש פוסט שיווקי מהרעיון הבא — אל תעתיק מילה במילה, תנסח במבנה המרווח:\n${input.idea.trim()}`;
  }
  if (input.holiday) {
    return `הצע פוסט ליום ${input.holiday.label}. רמז נושא: ${input.holiday.topicHint}`;
  }
  return `הצע פוסט כללי לתאריך ${input.date}. נושא: סדר בתיק ביטוחי, שקיפות, בדיקה לפני החלטה.`;
}

async function composeWithOpenAi(input: ComposeInput): Promise<string> {
  const key = getApiKey();
  if (!key) {
    throw new Error("missing-key");
  }

  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
      temperature: 0.75,
      max_tokens: 700,
      messages: [
        { role: "system", content: systemPrompt(input) },
        { role: "user", content: userPrompt(input) },
      ],
    }),
  });

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(json.error?.message ?? `OpenAI text error (${res.status})`);
  }

  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenAI לא החזיר טקסט");
  return text;
}

export async function composeSocialCaption(input: ComposeInput): Promise<string> {
  const stub = buildAiCaptionSuggestion({
    date: input.date,
    holiday: input.source === "auto" ? input.holiday : null,
    brand: input.brand,
    ctas: input.ctas,
    userNotes: input.source === "idea" ? input.idea : null,
  });

  let body = stub;
  try {
    const drafted = await composeWithOpenAi(input);
    const check = checkForbiddenPhrases(drafted, input.forbiddenPhrases ?? []);
    if (check.ok) body = drafted;
  } catch {
    /* stub */
  }

  return finalizeCaption({
    body,
    phone: input.phone,
    phoneSecondary: input.phoneSecondary,
    address: input.address,
    includeHashtags: Boolean(input.includeHashtags),
  });
}
