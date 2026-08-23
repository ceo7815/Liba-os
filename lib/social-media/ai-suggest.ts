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

export function buildImagePrompt(input: {
  caption: string;
  includeImageText: boolean;
  revisionNotes?: string | null;
  brand?: SocialBrand;
  phone?: string | null;
}): string {
  const settingsVisual = input.brand?.visualLanguage?.trim();
  const textNote = input.includeImageText
    ? "If adding type: one short Hebrew headline only, clean Rubik-like sans, high contrast on light ground."
    : "No headline on the image. Optional tiny phone only.";
  const phoneNote = input.phone
    ? `Contact overlay if any: phone ${input.phone} small, same corner family as the logo. No email.`
    : "No phone or email on the image.";

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
    `Story/theme from approved copy (mood only, do not illustrate metaphors as 3D icons): ${input.caption.slice(0, 280)}`,
    input.revisionNotes?.trim()
      ? `User revision: ${input.revisionNotes.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
