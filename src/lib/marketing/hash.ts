import { createHash } from "node:crypto";

export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  // Kuwait local numbers are 8 digits; add country code when missing.
  if (digits.length === 8) digits = `965${digits}`;
  return digits;
}

export function hashPhone(phone: string | null | undefined): string | null {
  const n = normalizePhone(phone);
  return n ? sha256(n) : null;
}

/** X expects phone numbers in E.164 form (with the leading +) before hashing. */
export function hashPhoneE164(phone: string | null | undefined): string | null {
  const n = normalizePhone(phone);
  return n ? sha256(`+${n}`) : null;
}

export function hashEmail(email: string | null | undefined): string | null {
  const e = (email || "").trim().toLowerCase();
  return e ? sha256(e) : null;
}

export function hashExternalId(code: string): string {
  return sha256(code.trim());
}

export function gaClientIdFromCookie(ga: string | undefined | null): string | null {
  if (!ga) return null;
  const m = ga.match(/^GA\d+\.\d+\.(\d+\.\d+)$/);
  return m ? m[1] : null;
}
