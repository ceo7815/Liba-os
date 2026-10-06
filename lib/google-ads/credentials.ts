import { createAdminClient } from "@/lib/supabase/admin";
import { decryptVaultSecret, hasVaultEncryptionKey } from "@/lib/vault/crypto";

type StoredGoogleApp = {
  clientId: string | null;
  clientSecret: string | null;
  developerToken: string | null;
};

const empty: StoredGoogleApp = {
  clientId: null,
  clientSecret: null,
  developerToken: null,
};

let storedPromise: Promise<StoredGoogleApp> | null = null;

function decryptField(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const plain = decryptVaultSecret(value);
    return plain.trim() || null;
  } catch {
    return null;
  }
}

function readStored(): Promise<StoredGoogleApp> {
  storedPromise ??= (async () => {
    if (!hasVaultEncryptionKey()) return empty;
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("google_ads_settings")
      .select(
        "oauth_client_id_encrypted, oauth_client_secret_encrypted, developer_token_encrypted",
      )
      .eq("id", 1)
      .maybeSingle();
    if (error || !data) return empty;
    return {
      clientId: decryptField(data.oauth_client_id_encrypted),
      clientSecret: decryptField(data.oauth_client_secret_encrypted),
      developerToken: decryptField(data.developer_token_encrypted),
    };
  })();
  return storedPromise;
}

/** Env wins. The saved copy is used when the server process has no Google app env. */
export async function resolveGoogleOAuthClient(): Promise<{
  clientId: string;
  clientSecret: string;
}> {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET?.trim();
  if (clientId && clientSecret) return { clientId, clientSecret };
  const stored = await readStored();
  if (stored.clientId && stored.clientSecret) {
    return { clientId: stored.clientId, clientSecret: stored.clientSecret };
  }
  throw new Error("חסרים GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET");
}

export async function resolveGoogleDeveloperToken(): Promise<string> {
  const fromEnv = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  const stored = await readStored();
  if (stored.developerToken) return stored.developerToken;
  throw new Error("חסר GOOGLE_ADS_DEVELOPER_TOKEN בשרת");
}
