import { createHash, randomBytes } from "node:crypto";

const KEY_PREFIX = "liba_";

export function generateAgentApiKey() {
  return `${KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function hashAgentApiKey(rawKey: string) {
  return createHash("sha256").update(rawKey, "utf8").digest("hex");
}

export function maskAgentApiKey(rawKey: string) {
  if (rawKey.length <= 12) return "••••••••";
  return `${rawKey.slice(0, 8)}…${rawKey.slice(-4)}`;
}
