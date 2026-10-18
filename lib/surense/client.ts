const DEFAULT_TOKEN_URL = "https://api.surense.com/oauth/token";
const DEFAULT_API_BASE = "https://api.surense.com/api/v1";

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
  if (!value) throw new Error("Surense is not configured");
  return value;
}

function tokenUrl(): string {
  return process.env.SURENSE_TOKEN_URL?.trim() || DEFAULT_TOKEN_URL;
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
  const form = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });
  const posted = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
    cache: "no-store",
  });
  if (posted.ok) return readToken(posted);

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const authorized = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    cache: "no-store",
  });
  if (authorized.ok) return readToken(authorized);
  throw new Error(`Surense token request failed (${posted.status})`);
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

export async function surenseFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await surenseAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return fetch(`${apiBase()}${suffix}`, { ...init, headers, cache: "no-store" });
}
