/**
 * Feed caption layout for Facebook + Instagram (same caption).
 *
 * Why this shape (2026):
 * - IG feed shows ~125 characters then "...more". The first line must be a hook.
 * - FB truncates around ~200–280 characters / a few lines. Same hook rule.
 * - Dense one-block paragraphs get skipped; blank lines create scan-points.
 * - Emoji as section markers (3–5), not decoration spam.
 * - IG: 3–5 targeted hashtags at the end outperform stuffing 30.
 * - FB: hashtags barely help reach — so they are optional in the composer.
 * - Contact lives below the CTA so the hook stays clean.
 */

export const DEFAULT_HASHTAGS = [
  "#ליבה",
  "#ביטוח",
  "#פנסיה",
  "#תיקביטוח",
  "#תכנוןפיננסי",
];

const DISCLAIMER = "המידע כללי ואינו המלצה פרטנית.";

export function layoutCaptionBody(raw: string): string {
  let text = raw.replace(/\r\n/g, "\n").trim();
  text = stripManagedBlocks(text);

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length <= 1) return lines[0] ?? "";

  const hook = lines[0];
  const body: string[] = [];
  let cta = "";
  let disclaimer = "";

  for (const line of lines.slice(1)) {
    if (line.includes("המידע כללי")) {
      disclaimer = line;
      continue;
    }
    if (line.includes("👉") || /^רוצים\b/.test(line)) {
      cta = line;
      continue;
    }
    body.push(line);
  }

  const sections: string[] = [hook];
  if (body.length) sections.push(body.join("\n"));
  if (cta) sections.push(cta);
  if (disclaimer) sections.push(disclaimer);
  return sections.join("\n\n");
}

export function contactFooter(
  phone?: string | null,
  address?: string | null,
  phoneSecondary?: string | null,
): string {
  const rows: string[] = [];
  const phones = [phone, phoneSecondary]
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p));
  // Unique while preserving order
  const unique: string[] = [];
  for (const p of phones) {
    if (!unique.includes(p)) unique.push(p);
  }
  for (const p of unique) rows.push(`📞 ${p}`);
  if (address?.trim()) rows.push(`📍 ${address.trim()}`);
  return rows.join("\n");
}

export function hashtagLine(tags: string[] = DEFAULT_HASHTAGS): string {
  return tags
    .map((t) => (t.startsWith("#") ? t : `#${t}`))
    .slice(0, 5)
    .join(" ");
}

export function finalizeCaption(input: {
  body: string;
  phone?: string | null;
  phoneSecondary?: string | null;
  address?: string | null;
  includeHashtags?: boolean;
  hashtags?: string[];
}): string {
  const parts: string[] = [layoutCaptionBody(input.body)];

  if (!parts[0].includes("המידע כללי")) {
    parts.push(DISCLAIMER);
  }

  const contact = contactFooter(
    input.phone,
    input.address,
    input.phoneSecondary,
  );
  if (contact) parts.push(contact);

  if (input.includeHashtags) {
    parts.push(hashtagLine(input.hashtags));
  }

  return parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

function stripManagedBlocks(text: string): string {
  let out = text;
  out = out.replace(/\n*📞[^\n]*/g, "");
  out = out.replace(/\n*📍[^\n]*/g, "");
  out = out.replace(/\n*(?:#[\u0590-\u05FFa-zA-Z0-9_]+(?:\s+|$))+$/m, "");
  out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim();
}
