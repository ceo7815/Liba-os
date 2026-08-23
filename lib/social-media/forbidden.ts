import type { ForbiddenCheckResult } from "@/lib/social-media/types";

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function countOccurrences(hay: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let from = 0;
  while (from <= hay.length - needle.length) {
    const idx = hay.indexOf(needle, from);
    if (idx === -1) break;
    count += 1;
    from = idx + needle.length;
  }
  return count;
}

/** Disclaimers like «אינו ייעוץ אישי» should not trip the forbidden phrase «ייעוץ אישי». */
function isOnlyNegated(hay: string, needle: string): boolean {
  const total = countOccurrences(hay, needle);
  if (total === 0) return false;
  const negated =
    countOccurrences(hay, `אינו ${needle}`) +
    countOccurrences(hay, `לא ${needle}`) +
    countOccurrences(hay, `בלי ${needle}`);
  return negated >= total;
}

export function checkForbiddenPhrases(
  text: string,
  phrases: string[],
): ForbiddenCheckResult {
  const hay = normalize(text);
  if (!hay) return { ok: true };

  const matches: string[] = [];
  for (const phrase of phrases) {
    const needle = normalize(phrase);
    if (!needle) continue;
    if (!hay.includes(needle)) continue;
    if (isOnlyNegated(hay, needle)) continue;
    matches.push(phrase);
  }

  if (matches.length === 0) return { ok: true };
  return { ok: false, matches };
}

export function forbiddenErrorMessage(matches: string[]): string {
  return `הטקסט מכיל ביטוי אסור: ${matches.join(" · ")}. ערכו או הסירו לפני המשך.`;
}
