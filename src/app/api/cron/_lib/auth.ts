import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Who may run a scheduled job.
 *
 * These routes pause sites, delete storage objects and purge rows. A publicly triggerable version of that
 * is a denial-of-service button with the platform's own credentials behind it, so there is no anonymous
 * path in and no fallback that quietly opens one.
 *
 * Two callers are allowed:
 *  - **Vercel Cron**, which sends `Authorization: Bearer $CRON_SECRET` with the value of the project's
 *    `CRON_SECRET` environment variable. That is the platform's own convention, so it is the one used.
 *  - **a signed-in super admin**, so the founder can force a run from the browser after a deploy without
 *    hunting for the secret.
 *
 * With no `CRON_SECRET` configured the bearer path does not exist — the route answers 503 rather than
 * falling open. `HEALTH_TOKEN` is deliberately NOT accepted: that token is handed to uptime monitors and
 * travels in query strings, and a read-only diagnostic credential must not also be able to delete things.
 */

function digest(v: string): Buffer {
  // Hashing first makes the comparison constant-length: `timingSafeEqual` throws on a length mismatch, so
  // comparing the raw strings would leak the secret's length through the difference between 500 and 401.
  return createHash("sha256").update(v, "utf8").digest();
}

export function sameSecret(a: string, b: string): boolean {
  return timingSafeEqual(digest(a), digest(b));
}

/** The bearer token on the request, or "" — `Bearer` is matched case-insensitively per RFC 7235. */
export function bearerToken(req: NextRequest): string {
  const header = req.headers.get("authorization") || "";
  const m = /^bearer\s+(.+)$/i.exec(header.trim());
  return m ? m[1].trim() : "";
}

export type CronAuth = { ok: true; via: "cron_secret" | "super_admin" } | { ok: false; response: NextResponse };

export async function authorizeCron(req: NextRequest): Promise<CronAuth> {
  const secret = process.env.CRON_SECRET?.trim() || "";
  const token = bearerToken(req);
  if (secret && token && sameSecret(secret, token)) return { ok: true, via: "cron_secret" };

  // A super admin session is the manual path. It is checked second so a scheduler with a bad token gets a
  // clean 401 rather than paying for a database round trip on every minute of a misconfigured schedule.
  try {
    if ((await getCurrentUser())?.isSuper === true) return { ok: true, via: "super_admin" };
  } catch {
    // A database that is down cannot authorise anyone; fall through to the refusal.
  }

  if (!secret) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "cron_not_configured", hint: "set CRON_SECRET in the project environment" },
        { status: 503, headers: { "cache-control": "no-store" } },
      ),
    };
  }
  // No body detail on a failed attempt, and a WWW-Authenticate header so the answer is a correct 401.
  return {
    ok: false,
    response: NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "cache-control": "no-store", "www-authenticate": "Bearer" } }),
  };
}
