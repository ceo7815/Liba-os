import type { ShemeshSnapshot, ShemeshSourceId } from "@/lib/shemesh/model";

export type ShemeshConnection = "awaiting_access" | "credentials_present";

export type ShemeshPullResult =
  | { ok: false; reason: "awaiting_access" | "not_implemented"; message: string }
  | { ok: true; patch: Partial<ShemeshSnapshot> };

export type ShemeshConnector = {
  id: ShemeshSourceId;
  label: string;
  pulls: string;
  envKeys: readonly string[];
  blockedMessage: string;
  readyMessage?: string;
  isReady?: (env: NodeJS.ProcessEnv) => boolean;
  pull: (env: NodeJS.ProcessEnv) => Promise<ShemeshPullResult>;
};

export type ShemeshSourceStatus = {
  id: ShemeshSourceId;
  label: string;
  pulls: string;
  connection: ShemeshConnection;
  lastSyncedAt: string | null;
  message: string;
};

export function credentialsPresent(env: NodeJS.ProcessEnv, keys: readonly string[]): boolean {
  return keys.every((key) => Boolean(env[key]?.trim()));
}

export function blockedPull(
  connector: Pick<ShemeshConnector, "envKeys" | "blockedMessage">,
  env: NodeJS.ProcessEnv,
  readyMessage: string,
): ShemeshPullResult {
  if (!credentialsPresent(env, connector.envKeys)) {
    return { ok: false, reason: "awaiting_access", message: connector.blockedMessage };
  }
  return { ok: false, reason: "not_implemented", message: readyMessage };
}
