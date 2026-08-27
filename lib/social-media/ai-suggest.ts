import type { HolidayDay, SocialBrand, SocialCta } from "@/lib/social-media/types";
import {
  IMAGE_PROMPT_VISUAL_EN,
  LIBA_LOGO_SPEC,
} from "@/lib/social-media/brand-visual";

const OPENERS = [
  "שאלתם את עצמכם לאחרונה",
  "לפני שמחליפים פוליסה",
  "רוב האנשים מגלים את זה רק אחרי",
  "בדיקה קצרה בתיק יכולה לחסוך",
  "לא כל כיסוי הוא מה שנראה על הנייר",
];

const INSIGHTS = [
  "כפילויות ופערים בתיק הם נפוצים יותר ממה שחושבים.",
  "שקיפות לפני החלטה חוסכת הפתעות בהמשך.",
  "קודם להבין — אחר כך להמליץ.",
  "מוצר מתאים הוא כזה שמבינים אותו, לא רק שמחתימים עליו.",
  "סדר בתיק ביטוחי זה לא מותרות — זה שליטה.",
];

const CTAS = [
  "רוצים לבדוק? שיחת היכרות קצרה.",
  "סורק הביטוח האישי — בדיקה מהירה בקישור.",
  "יש שאלה? דברו איתנו — בלי לחץ.",
];

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function seedFromDate(date: string): number {
  return date.split("-").reduce((acc, p) => acc + Number(p), 0);
}

export function buildAiCaptionSuggestion(input: {
  date: string;
  holiday?: HolidayDay | null;
  brand?: SocialBrand;
  ctas?: SocialCta[];
  userNotes?: string | null;
}): string {
  const brandName = input.brand?.name ?? "ליבה";
  const cta = input.ctas?.[0]?.label
    ? `${input.ctas[0].label} — בלי לחץ.`
    : pick(CTAS, seedFromDate(input.date));

  if (input.userNotes?.trim()) {
    const idea = input.userNotes.trim();
    return `💛 ${idea.replace(/\s+/g, " ")}\n\n📌 ${pick(INSIGHTS, seedFromDate(input.date))}\n\n👉 ${cta}\nהמידע כללי ואינו המלצה פרטנית.`;
  }

  if (input.holiday) {
    return `💛 ${input.holiday.topicHint}\n\n📌 ${pick(INSIGHTS, seedFromDate(input.holiday.key))}\n\n👉 ${cta}\nהמידע כללי ואינו המלצה פרטנית.`;
  }

  const opener = pick(OPENERS, seedFromDate(input.date));
  const insight = pick(INSIGHTS, seedFromDate(input.date) + 3);

  return `💛 ${opener}?\n\n📌 ${insight}\n${brandName}: בדיקה לפני מוצר. שפה פשוטה, בלי דחיפות.\n\n👉 ${cta}\nהמידע כללי ואינו המלצה פרטנית.`;
}

function overlayWords(text: string): string[] {
  return text
    .replace(/[💛📌👉❤️🏡💼✨]/g, " ")
    .replace(/המידע כללי[^\n]*/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Headline + few words for the canvas — never the full social caption. */
export function overlayCopyFromCaption(caption: string): {
  headline: string;
  subline: string;
} {
  const lines = caption
    .split(/\n+/)
    .map((line) => line.replace(/^[💛📌👉•\-\s]+/, "").trim())
    .filter((line) => line.length > 1 && !line.startsWith("http"));
  const headline = overlayWords(lines[0] ?? "").slice(0, 8).join(" ");
  const subline = overlayWords(lines.slice(1).join(" ")).slice(0, 5).join(" ");
  return {
    headline: headline || "סדר בתיק. שקט בלב.",
    subline,
  };
}

function overlayAlignment(seed: string): "right" | "center" {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n += seed.charCodeAt(i);
  return n % 2 === 0 ? "right" : "center";
}

export function buildImagePrompt(input: {
  caption: string;
  includeImageText: boolean;
  revisionNotes?: string | null;
  brand?: SocialBrand;
  phone?: string | null;
  seed?: string | null;
}): string {
  const settingsVisual = input.brand?.visualLanguage?.trim();
  const overlay = overlayCopyFromCaption(input.caption);
  const align = overlayAlignment(input.seed || input.caption || overlay.headline);
  const alignRule =
    align === "right"
      ? "Hebrew RTL, right-aligned (start-aligned) block in the upper-right third. Ragged left. Never left-align like English."
      : "Hebrew RTL, centered block in the upper third. Still RTL letter order. Never left-align like English.";
  const textNote = input.includeImageText
    ? [
        "ON-IMAGE TYPE — sparse. Israeli RTL audience.",
        "Paint ONLY this copy, nothing else from the caption:",
        `Headline (max 8 words): ${overlay.headline}`,
        overlay.subline ? `Subline (max 5 words): ${overlay.subline}` : "No subline.",
        alignRule,
        "Hard limit: headline + optional subline + existing red CTA chip (2–4 words) + tiny phone. No paragraphs, no bullets, no 📌 body, no disclaimer, no full caption burned into the photo.",
        "Large type filling the frame with the photo. No empty border around the composition. Rubik-like Hebrew. High contrast.",
      ].join("\n")
    : "No headline and no paragraph on the image. Photography only. Optional tiny phone.";
  const phoneNote = input.phone
    ? `Contact overlay if any: phone ${input.phone} small, same corner family as the logo. No email.`
    : "No phone or email on the image.";
  const theme = overlayWords(input.caption).slice(0, 12).join(" ");

  return [
    "Create a social feed photograph for Israeli insurance brand Liba (ליבה ביטוח ופיננסים).",
    "Keep LOGO rules and DESIGN LANGUAGE rules separate. Do not merge them.",
    IMAGE_PROMPT_VISUAL_EN,
    settingsVisual
      ? `Brand settings visual language (Hebrew, editable in OS — photography only, not the logo):\n${settingsVisual}`
      : "",
    `LOGO FILE: ${LIBA_LOGO_SPEC.file}`,
    `LOGO RULES: ${LIBA_LOGO_SPEC.mark} ${LIBA_LOGO_SPEC.placement} ${LIBA_LOGO_SPEC.never}`,
    "The attached PNG is the only allowed logo source. Reproduce that exact 2D mark small in a corner. Do not redesign it. Do not place a 3D shield in the scene.",
    textNote,
    phoneNote,
    `Photography mood keywords only (do not paint this as text): ${theme}`,
    input.revisionNotes?.trim()
      ? `User revision: ${input.revisionNotes.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
