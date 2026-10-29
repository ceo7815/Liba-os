import { timingSafeEqual } from "node:crypto";

export const REAPER_CRON_SECRET_ENV = "AGENT_REAPER_CRON_SECRET";

export type CronAuth =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

/** Compare a presented cron secret with the env value. Unset secret never opens the route. */
export function authorizeCronSecret(
  presented: string | null | undefined,
  expected: string | null | undefined,
): CronAuth {
  const secret = expected?.trim() ?? "";
  if (!secret) {
    return { ok: false, status: 503, error: "cron secret is not configured" };
  }
  const value = presented?.trim() ?? "";
  if (!value) return { ok: false, status: 401, error: "unauthorized" };
  const actual = Buffer.from(value);
  const wanted = Buffer.from(secret);
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) {
    return { ok: false, status: 401, error: "unauthorized" };
  }
  return { ok: true };
}

/** Bearer token or x-cron-secret. The secret itself is never read from the repo. */
export function cronSecretFromRequest(headers: Headers): string | null {
  const direct = headers.get("x-cron-secret")?.trim();
  if (direct) return direct;
  const auth = headers.get("authorization");
  if (!auth) return null;
  const match = /^Bearer\s+(\S+)/i.exec(auth);
  return match?.[1]?.trim() || null;
}
