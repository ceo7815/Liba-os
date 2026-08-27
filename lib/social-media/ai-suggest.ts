import type { HolidayDay, SocialBrand, SocialCta } from "@/lib/social-media/types";
import {
  IMAGE_PROMPT_TYPE_EN,
  IMAGE_PROMPT_VISUAL_EN,
  LIBA_LOGO_SPEC,
} from "@/lib/social-media/brand-visual";
import {
  fallbackImagePlan,
  overlayCopyFromCaption,
  type SocialImagePlan,
} from "@/lib/social-media/image-plan";

export { overlayCopyFromCaption };

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
  seed?: string | null;
  plan?: SocialImagePlan | null;
}): string {
  const settingsVisual = input.brand?.visualLanguage?.trim();
  const plan =
    input.plan ??
    fallbackImagePlan({
      caption: input.caption,
      seed: input.seed,
    });
  const alignRule =
    plan.textAlign === "right"
      ? "Hebrew RTL, right-aligned (start-aligned) block in the upper-right third. Ragged left. Never left-align like English."
      : "Hebrew RTL, centered block in the upper third. Still RTL letter order. Never left-align like English.";
  const textNote = input.includeImageText
    ? [
        "ON-IMAGE TYPE — designed Israeli social creative, first generate must already look finished.",
        IMAGE_PROMPT_TYPE_EN,
        alignRule,
        `HEADLINE TO PAINT EXACTLY (quote, character for character): «${plan.headline}»`,
        plan.subline
          ? `SUBLINE TO PAINT EXACTLY: «${plan.subline}»`
          : "No subline.",
        plan.ctaChip
          ? `Optional coral-red CTA chip, 2–4 words exactly: «${plan.ctaChip}»`
          : "No extra CTA chip unless a tiny phone is requested below.",
        "Do not paint any other Hebrew from the caption. No paragraphs, no bullets, no disclaimer, no hashtags, no 📌 body.",
      ].join("\n")
    : "No headline and no paragraph on the image. Photography only. Optional tiny phone.";
  const phoneNote = input.phone
    ? `Contact overlay if any: phone ${input.phone} small, same corner family as the logo. No email.`
    : "No phone or email on the image.";

  return [
    "Create a finished Israeli social photograph for Liba (ליבה ביטוח ופיננסים). This is the first generate — it must already match the post. Do not produce a generic stock family.",
    "Keep LOGO rules and DESIGN LANGUAGE rules separate. Do not merge them.",
    IMAGE_PROMPT_VISUAL_EN,
    settingsVisual
      ? `Brand settings visual language (Hebrew, editable in OS — photography only, not the logo):\n${settingsVisual}`
      : "",
    `LOGO FILE: ${LIBA_LOGO_SPEC.file}`,
    `LOGO RULES: ${LIBA_LOGO_SPEC.mark} ${LIBA_LOGO_SPEC.placement} ${LIBA_LOGO_SPEC.never}`,
    "The attached PNG is the only allowed logo source. Reproduce that exact 2D mark small in a corner. Do not redesign it. Do not place a 3D shield in the scene.",
    `POST MEANING (illustrate this with photography — never paint this paragraph as text):\n${plan.meaning}`,
    `PHOTO SCENE (mandatory — this is what the camera sees):\n${plan.scene}`,
    textNote,
    phoneNote,
    input.revisionNotes?.trim()
      ? `User revision: ${input.revisionNotes.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
