import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * At-rest encryption for ad-platform tokens (AES-256-GCM) using PIXEL_SECRET_KEY (64 hex chars).
 * Without a key values are stored as-is, and previously encrypted values still decrypt once a key exists.
 */
const PREFIX = "enc:v1:";

function key(): Buffer | null {
  const hex = process.env.PIXEL_SECRET_KEY?.trim();
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) return null;
  return Buffer.from(hex, "hex");
}

export function encryptSecret(value: string | null | undefined): string | null {
  if (value == null || value === "") return value ?? null;
  const k = key();
  if (!k || value.startsWith(PREFIX)) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const ct = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${ct.toString("base64url")}`;
}

export function decryptSecret(value: string | null | undefined): string | null {
  if (value == null || value === "") return value ?? null;
  if (!value.startsWith(PREFIX)) return value;
  const k = key();
  if (!k) return value;
  try {
    const [ivS, tagS, ctS] = value.slice(PREFIX.length).split(".");
    const decipher = createDecipheriv("aes-256-gcm", k, Buffer.from(ivS, "base64url"));
    decipher.setAuthTag(Buffer.from(tagS, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ctS, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function secretsEncrypted(): boolean {
  return key() !== null;
}
