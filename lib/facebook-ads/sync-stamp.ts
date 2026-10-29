/** Settings columns written at the end of a Facebook sync. */
export function facebookSettingsSyncStamp(
  now: string,
  warning: string | null | undefined,
): { last_synced_at?: string; last_error: string | null } {
  const text = warning?.trim() ?? "";
  if (text) return { last_error: text };
  return { last_synced_at: now, last_error: null };
}
