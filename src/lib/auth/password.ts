import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";

const N = 16384;
const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEYLEN, { N }).toString("hex");
  return `scrypt$${N}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]);
  const salt = parts[2];
  const expected = Buffer.from(parts[3], "hex");
  const actual = scryptSync(password, salt, expected.length, { N: n });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
