const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const FACEBOOK_RECONNECT_PATH = "/api/facebook-ads/connect";

/** Warning when the stored user token expires within 7 days, including already expired. */
export function facebookTokenExpiryWarning(
  expiresAt: string | null | undefined,
  now = Date.now(),
): string | null {
  if (!expiresAt) return null;
  const time = Date.parse(expiresAt);
  if (!Number.isFinite(time)) return null;
  if (time - now > WINDOW_MS) return null;
  const when = new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(time));
  if (time <= now) return `טוקן פייסבוק פג ב־${when}. יש לחבר מחדש.`;
  return `טוקן פייסבוק יפוג ב־${when} (בתוך 7 ימים). יש לחבר מחדש.`;
}
