import { createHash, createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getVaultKey(): Buffer {
  const raw = process.env.VAULT_ENCRYPTION_KEY;
  if (!raw?.trim()) {
    throw new Error("Missing VAULT_ENCRYPTION_KEY");
  }

  // Accept base64 32-byte key, or derive from a passphrase via SHA-256.
  try {
    const fromB64 = Buffer.from(raw.trim(), "base64");
    if (fromB64.length === 32) return fromB64;
  } catch {
    // fall through
  }

  return createHash("sha256").update(raw.trim(), "utf8").digest();
}

/**
 * Encrypt plaintext → base64(iv | authTag | ciphertext)
 */
export function encryptVaultSecret(plaintext: string): string {
  const key = getVaultKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptVaultSecret(payload: string): string {
  const key = getVaultKey();
  const buf = Buffer.from(payload, "base64");
  if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error("Invalid ciphertext");
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const data = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}

export function hasVaultEncryptionKey(): boolean {
  return Boolean(process.env.VAULT_ENCRYPTION_KEY?.trim());
}
