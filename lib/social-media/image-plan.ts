/**
 * First-generate art direction: understand the post, then paint a complete
 * Hebrew slogan — not a word-sliced leftover of the caption.
 */

const CHAT_URL = "https://api.openai.com/v1/chat/completions";
const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL?.trim() || "gpt-4o-mini";
const PLAN_TIMEOUT_MS = 20_000;

export type SocialImagePlan = {
  meaning: string;
  scene: string;
  headline: string;
  subline: string;
  ctaChip: string;
  textAlign: "right" | "center";
};

const HANGING = new Set([
  "את",
  "של",
  "על",
  "עם",
  "לא",
  "אם",
  "כי",
  "או",
  "גם",
  "רק",
  "כל",
  "זה",
  "לפני",
  "אחרי",
  "בלי",
  "בין",
  "עד",
  "אל",
  "ה",
  "ו",
  "ש",
]);

function stripDecor(text: string): string {
  return text
    .replace(/[💛📌👉❤️🏡💼✨✅📞📍•]/g, " ")
    .replace(/המידע כללי[^\n]*/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/#\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordsOf(text: string): string[] {
  return stripDecor(text)
    .split(/\s+/)
    .filter(Boolean);
}

function completePhrase(words: string[], maxWords: number): string {
  let cut = words.slice(0, maxWords);
  while (cut.length > 2 && HANGING.has(cut[cut.length - 1] ?? "")) {
    cut = cut.slice(0, -1);
  }
  return cut.join(" ");
}

function captionLines(caption: string): string[] {
  return caption
    .split(/\n+/)
    .map((line) => stripDecor(line.replace(/^[💛📌👉•\-\s]+/, "")))
    .filter((line) => line.length > 1);
}

/** Deterministic fallback when the planner is unavailable. */
export function overlayCopyFromCaption(caption: string): {
  headline: string;
  subline: string;
} {
  const lines = captionLines(caption);
  const hookWords = wordsOf(lines[0] ?? "");
  const headline =
    hookWords.length <= 6
      ? hookWords.join(" ")
      : completePhrase(hookWords, 6);
  const rest = wordsOf(lines.slice(1).join(" "));
  const subline = rest.length ? completePhrase(rest, 5) : "";
  return {
    headline: headline || "סדר בתיק. שקט בלב",
    subline,
  };
}

function overlayAlignment(seed: string): "right" | "center" {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n += seed.charCodeAt(i);
  return n % 2 === 0 ? "right" : "center";
}

function sceneFromCaption(caption: string, meaning: string): string {
  const idea = meaning || stripDecor(caption).slice(0, 180);
  return [
    "Calm Israeli documentary photograph that makes this post readable without reading the caption.",
    `The idea to illustrate: ${idea}.`,
    "Real people in Israel, natural daylight, cream / warm interior or quiet outdoor shade.",
    "Specific activity that matches the topic (reviewing papers, a kitchen conversation, a parent with a child, a calm meeting) — not a generic smiling stock family, not icons, not a 3D logo.",
  ].join(" ");
}

export function fallbackImagePlan(input: {
  caption: string;
  seed?: string | null;
}): SocialImagePlan {
  const overlay = overlayCopyFromCaption(input.caption);
  const meaning = captionLines(input.caption)[0] || overlay.headline;
  return {
    meaning,
    scene: sceneFromCaption(input.caption, meaning),
    headline: overlay.headline.replace(/[.]+$/, "").trim(),
    subline: overlay.subline,
    ctaChip: "",
    textAlign: overlayAlignment(input.seed || input.caption || overlay.headline),
  };
}

function sanitizePlan(
  raw: Partial<SocialImagePlan> | null,
  fallback: SocialImagePlan,
): SocialImagePlan {
  const clean = (value: unknown, maxWords: number, maxChars: number) => {
    if (typeof value !== "string") return "";
    const phrase = completePhrase(wordsOf(value), maxWords);
    return phrase.length > maxChars ? completePhrase(wordsOf(phrase), Math.max(2, maxWords - 1)) : phrase;
  };

  const headline = clean(raw?.headline, 6, 42) || fallback.headline;
  const subline = clean(raw?.subline, 6, 42);
  const ctaChip = clean(raw?.ctaChip, 4, 28);
  const meaning =
    typeof raw?.meaning === "string" && raw.meaning.trim()
      ? stripDecor(raw.meaning).slice(0, 220)
      : fallback.meaning;
  const scene =
    typeof raw?.scene === "string" && raw.scene.trim().length > 40
      ? raw.scene.trim().slice(0, 700)
      : fallback.scene;
  const textAlign = raw?.textAlign === "center" ? "center" : "right";

  return { meaning, scene, headline, subline, ctaChip, textAlign };
}

function extractJson(text: string): Partial<SocialImagePlan> | null {
  const fenced = text.match(/\{[\s\S]*\}/);
  if (!fenced) return null;
  try {
    return JSON.parse(fenced[0]) as Partial<SocialImagePlan>;
  } catch {
    return null;
  }
}

async function requestPlan(userBlock: string): Promise<Partial<SocialImagePlan> | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PLAN_TIMEOUT_MS);
  try {
    const res = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        temperature: 0.4,
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "אתה ארט-דיירקטור של ליבה ביטוח ופיננסים לרשתות חברתיות ישראליות.",
              "התמונה הראשונה חייבת כבר להבין את הפוסט — בלי שלושה ניסיונות.",
              "החזר JSON בלבד עם השדות: meaning, scene, headline, subline, ctaChip, textAlign.",
              "meaning: משפט עברי אחד — מה הפוסט אומר באמת (לא ציטוט מלא).",
              "scene: 2–4 משפטים באנגלית לצילום דוקומנטרי ישראלי שממחיש את meaning. מי, איפה, מה הם עושים. אור יום, בית/משרד בהיר. בלי אייקונים ובלי לוגו תלת-ממד.",
              "headline: סיסמה עברית שלמה, 2–6 מילים. מחשבה גמורה. בלי אימוג'י, בלי לחתוך מילה, בלי שלוש נקודות באמצע רעיון.",
              "subline: שורת תמיכה שלמה, 0–6 מילים, או מחרוזת ריקה. חייבת להמשיך את הכותרת בהיגיון.",
              "ctaChip: 2–4 מילים כמו «שיחת היכרות» או ריק. לא טלפון.",
              "textAlign: right או center.",
              "אל תעתיק את כל הכיתוב לתמונה. אל תתחיל משפט שאי אפשר לסיים. קהל ישראלי, גופן Rubik, עיצוב פיד נקי.",
            ].join("\n"),
          },
          { role: "user", content: userBlock },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) return null;
    return extractJson(content);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function planSocialImage(input: {
  caption: string;
  userNotes?: string | null;
  includeImageText: boolean;
  revisionNotes?: string | null;
  seed?: string | null;
}): Promise<SocialImagePlan> {
  const fallback = fallbackImagePlan({
    caption: input.caption,
    seed: input.seed,
  });

  const userBlock = [
    `כיתוב הפוסט:\n${input.caption.trim() || "אין כיתוב — נושא כללי: סדר בתיק ביטוחי, שקיפות."}`,
    input.userNotes?.trim() ? `הערות יוצר:\n${input.userNotes.trim()}` : "",
    input.includeImageText
      ? "יש לצייר כותרת + שורת משנה על התמונה."
      : "בלי טקסט על התמונה — רק סצנה שמצלמת את הרעיון.",
    input.revisionNotes?.trim()
      ? `תיקון מהמשתמש לג׳נרוט:\n${input.revisionNotes.trim()}`
      : "זה הג׳נרוט הראשון. קלוע מהפעם הראשונה.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const raw = await requestPlan(userBlock);
  return sanitizePlan(raw, fallback);
}
