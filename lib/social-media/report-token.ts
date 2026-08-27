import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

type Payload = { f: string; t: string; n: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function secret(): string {
  return (
    process.env.VAULT_ENCRYPTION_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    ""
  );
}

export function signSocialReportToken(from: string, to: string): string {
  const key = secret();
  if (!key) throw new Error("חסר מפתח לחתימת קישור הדוח");
  const payload: Payload = {
    f: from,
    t: to,
    n: randomBytes(8).toString("hex"),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", key).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySocialReportToken(
  token: string,
): { from: string; to: string } | null {
  const key = secret();
  if (!key) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", key).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as Payload;
    if (!DATE.test(payload.f) || !DATE.test(payload.t)) return null;
    if (payload.f > payload.t) return null;
    return { from: payload.f, to: payload.t };
  } catch {
    return null;
  }
}
