import { publicErrorText } from "@/lib/sync-log";
import { isRetryableHttpStatus, RetryableError, withRetry } from "@/lib/sync-retry";

const DEFAULT_TOKEN_URL = "https://api.surense.com/oauth/token";
const DEFAULT_API_BASE = "https://api.surense.com/api/v1";
const DEFAULT_AUDIENCE = "https://api.surense.com";

type CachedToken = {
  accessToken: string;
  expiresAt: number;
};

let cached: CachedToken | null = null;

export function surenseConfigured(): boolean {
  return Boolean(process.env.SURENSE_CLIENT_ID?.trim() && process.env.SURENSE_CLIENT_SECRET?.trim());
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error("[surense-sync] missing env", { name });
    throw new Error(`Surense is not configured (missing ${name})`);
  }
  return value;
}

async function readErrorDetail(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  let detail = "";
  try {
    const payload = JSON.parse(text) as {
      error?: unknown;
      error_description?: unknown;
      message?: unknown;
    };
    const error = typeof payload.error === "string" ? payload.error : "";
    const description =
      typeof payload.error_description === "string"
        ? payload.error_description
        : typeof payload.message === "string"
          ? payload.message
          : "";
    detail = [error, description].filter(Boolean).join(": ");
  } catch {
    detail = text;
  }
  return publicErrorText(detail);
}

function tokenFailureMessage(status: number, detail: string): string {
  return detail
    ? `Surense token request failed (${status}): ${detail}`
    : `Surense token request failed (${status})`;
}

function tokenUrl(): string {
  return process.env.SURENSE_TOKEN_URL?.trim() || DEFAULT_TOKEN_URL;
}

function tokenAudience(): string {
  return process.env.SURENSE_AUDIENCE?.trim() || DEFAULT_AUDIENCE;
}

function apiBase(): string {
  return (process.env.SURENSE_API_BASE?.trim() || DEFAULT_API_BASE).replace(/\/$/, "");
}

async function readToken(response: Response): Promise<CachedToken> {
  const payload = (await response.json()) as { access_token?: unknown; expires_in?: unknown };
  const accessToken = typeof payload.access_token === "string" ? payload.access_token : "";
  if (!response.ok || !accessToken) {
    throw new Error(`Surense token request failed (${response.status})`);
  }
  const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : Number(payload.expires_in);
  const seconds = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 300;
  return { accessToken, expiresAt: Date.now() + seconds * 1000 };
}

async function requestToken(clientId: string, clientSecret: string): Promise<CachedToken> {
  const url = tokenUrl();
  const audience = tokenAudience();
  const form = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    audience,
  });
  let posted: Response;
  try {
    posted = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
      cache: "no-store",
    });
  } catch (err) {
    const message = publicErrorText(err instanceof Error ? err.message : "token request failed");
    console.error("[surense-sync] token request failed", { message });
    throw new Error(`Surense token request failed: ${message}`);
  }
  if (posted.ok) return readToken(posted);

  const postedDetail = await readErrorDetail(posted);
  console.error("[surense-sync] token form post failed", {
    status: posted.status,
    detail: postedDetail || null,
  });

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  let authorized: Response;
  try {
    authorized = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        audience,
      }),
      cache: "no-store",
    });
  } catch (err) {
    const message = publicErrorText(err instanceof Error ? err.message : "token request failed");
    console.error("[surense-sync] token basic auth failed", { message });
    throw new Error(tokenFailureMessage(posted.status, postedDetail));
  }
  if (authorized.ok) return readToken(authorized);
  const basicDetail = await readErrorDetail(authorized);
  console.error("[surense-sync] token basic auth failed", {
    status: authorized.status,
    detail: basicDetail || null,
  });
  throw new Error(tokenFailureMessage(authorized.status || posted.status, basicDetail || postedDetail));
}

export async function surenseAccessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.accessToken;
  const next = await requestToken(requiredEnv("SURENSE_CLIENT_ID"), requiredEnv("SURENSE_CLIENT_SECRET"));
  cached = next;
  return next.accessToken;
}

export async function surensePost(path: string, body: unknown): Promise<Response> {
  return surenseFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const SURENSE_TIMEOUT_MS = 12_000;

export async function surenseFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return withRetry(async () => {
    const token = await surenseAccessToken();
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("Accept", "application/json");
    let response: Response;
    try {
      response = await fetch(`${apiBase()}${suffix}`, {
        ...init,
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(SURENSE_TIMEOUT_MS),
      });
    } catch (err) {
      const message = publicErrorText(err instanceof Error ? err.message : "surense fetch failed");
      throw new RetryableError(message || "Surense לא הגיב");
    }
    if (isRetryableHttpStatus(response.status)) {
      throw new RetryableError(`Surense ${suffix} ${response.status}`);
    }
    return response;
  });
}
