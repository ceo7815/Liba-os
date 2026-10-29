/** Strip credentials before an error string is logged or shown in a toast. */
export function publicErrorText(value: string): string {
  return value
    .replace(/https?:\/\/\S+/gi, (url) => url.split("?")[0] ?? url)
    .replace(/access_token[=:]\s*\S+/gi, "access_token=(redacted)")
    .replace(/client_secret[=:]\s*\S+/gi, "client_secret=(redacted)")
    .replace(/Bearer\s+\S+/gi, "Bearer (redacted)")
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "(redacted-jwt)")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}
