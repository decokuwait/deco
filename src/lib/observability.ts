/**
 * Where a caught server error goes.
 *
 * Two callers, one shape: `onRequestError` in `src/instrumentation.ts` (everything Next itself catches)
 * and the handful of places that deliberately swallow an error to keep serving a page — `getRequestSite`
 * above all, which must not throw out of the tenant root layout. Anything swallowed silently is a failure
 * nobody hears about until a customer phones, so every swallow reports here.
 *
 * This module is imported by `instrumentation.ts`, which Next loads in the Node, Edge *and* browser
 * runtimes. It therefore may not import anything runtime-specific: no `node:*`, no `next/headers`, no
 * database. Keep it dependency-free.
 */

/** Flat, primitive fields only: one console line has to stay greppable in the Vercel log viewer. */
export type ErrorFields = Record<string, string | number | boolean | null | undefined>;

export interface ErrorReport {
  /** The call site that caught it — `onRequestError`, `site-lookup`, … Always present, always greppable. */
  source: string;
  /** `warning` for a handled degradation (the holding page rendered), `error` for a real fault. */
  severity?: "error" | "warning";
  fields?: ErrorFields;
}

interface Described {
  name: string;
  message: string;
  digest: string | null;
  stack: string | undefined;
}

/**
 * React replaces a Server Component error with an opaque one before it reaches the client, keeping only
 * `digest`. That digest is the *only* link between what the visitor was shown and this log line, so it is
 * extracted first and printed even when the message is useless.
 */
function digestOf(e: unknown): string | null {
  if (typeof e === "object" && e !== null && "digest" in e) {
    const d = (e as { digest?: unknown }).digest;
    if (typeof d === "string" && d) return d;
  }
  return null;
}

function describe(e: unknown): Described {
  if (e instanceof Error) return { name: e.name || "Error", message: e.message, digest: digestOf(e), stack: e.stack };
  return { name: typeof e, message: typeof e === "string" ? e : safeString(e), digest: digestOf(e), stack: undefined };
}

function safeString(v: unknown): string {
  try {
    return JSON.stringify(v) ?? String(v);
  } catch {
    return String(v);
  }
}

/** `key=value` pairs, quoted only when they need it, so the line reads like a log and not like JSON. */
function format(fields: ErrorFields): string {
  const out: string[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null || v === "") continue;
    const s = String(v).replace(/\s+/g, " ").slice(0, 300);
    out.push(/[\s"]/.test(s) ? `${k}=${JSON.stringify(s)}` : `${k}=${s}`);
  }
  return out.join(" ");
}

/* ------------------------------------------------------------------ Sentry (optional) */

interface SentryLike {
  init(options: Record<string, unknown>): void;
  captureException(e: unknown, hint?: { extra?: Record<string, unknown>; level?: string }): void;
  flush?(timeout?: number): Promise<boolean>;
}

/**
 * `@sentry/nextjs` is deliberately NOT a dependency: the owner has no DSN yet, and a package in
 * package.json that nothing configures is a build-time liability for a feature nobody is using.
 * The import specifier is read from a variable and marked ignorable so neither Turbopack nor webpack
 * tries to resolve it at build time — without the package installed the resolution simply fails at
 * runtime, once, and is remembered as "console only".
 */
const SENTRY_MODULE = process.env.SENTRY_MODULE?.trim() || "@sentry/nextjs";

let sentryPromise: Promise<SentryLike | null> | undefined;

function sentryDsn(): string {
  return (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || "").trim();
}

async function loadSentry(): Promise<SentryLike | null> {
  const dsn = sentryDsn();
  if (!dsn) return null;
  if (sentryPromise) return sentryPromise;
  sentryPromise = (async () => {
    try {
      const mod = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ SENTRY_MODULE)) as {
        default?: SentryLike;
      } & Partial<SentryLike>;
      const sentry = (typeof mod.captureException === "function" ? mod : mod.default) as SentryLike | undefined;
      if (!sentry || typeof sentry.captureException !== "function") return null;
      sentry.init({
        dsn,
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
        release: process.env.VERCEL_GIT_COMMIT_SHA || undefined,
        tracesSampleRate: 0,
      });
      return sentry;
    } catch (e) {
      // Never let the reporter be the thing that breaks the request.
      console.warn(`[dk:error] sentry unavailable (${SENTRY_MODULE} not installed?) — logging to console only:`, e);
      return null;
    }
  })();
  return sentryPromise;
}

/** True when errors are being forwarded somewhere the founder will actually see them. */
export function errorTrackingEnabled(): boolean {
  return sentryDsn() !== "";
}

/* ------------------------------------------------------------------ the reporter */

/**
 * Always logs; forwards to Sentry only when SENTRY_DSN is set. Never throws and never rejects — a caller
 * may `await` it or not, but on a serverless function `await` is what gets the event out before the
 * instance is frozen.
 */
export async function reportError(error: unknown, report: ErrorReport): Promise<void> {
  const d = describe(error);
  const fields: ErrorFields = {
    source: report.source,
    ...report.fields,
    name: d.name,
    digest: d.digest,
    message: d.message,
  };
  const line = `[dk:error] ${format(fields)}`;
  if (report.severity === "warning") console.warn(line, d.stack ?? error);
  else console.error(line, d.stack ?? error);

  try {
    const sentry = await loadSentry();
    if (!sentry) return;
    sentry.captureException(error, { extra: { ...report.fields, source: report.source, digest: d.digest }, level: report.severity ?? "error" });
    // Serverless instances freeze the moment the response is sent; an unflushed event is a lost event.
    await sentry.flush?.(2000);
  } catch (e) {
    console.warn("[dk:error] reporting failed:", e);
  }
}
