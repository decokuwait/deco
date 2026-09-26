import type { Instrumentation } from "next";
import { errorTrackingEnabled, reportError } from "@/lib/observability";

/**
 * Server instrumentation. Next wires this file up on its own — no config, no import anywhere — and loads
 * it in the Node, Edge and browser runtimes alike, so nothing here may reach for `node:*`, `next/headers`
 * or the database. It exists because the platform previously had no error tracking of any kind: a failing
 * tenant page produced a 500 that only the visitor ever saw.
 */

/** Headers worth having next to an error. Cookies and Authorization are deliberately not among them. */
const SAFE_HEADERS = ["host", "x-forwarded-host", "x-dk-host", "x-vercel-id", "user-agent", "referer"] as const;

function header(headers: NodeJS.Dict<string | string[]>, name: string): string | undefined {
  const v = headers[name];
  const s = Array.isArray(v) ? v[0] : v;
  return s ? String(s).slice(0, 300) : undefined;
}

/**
 * Called once per server instance, before it serves anything. Used only to say — once, in the boot log —
 * whether errors from this deployment are going anywhere the founder will see. Silence about a missing
 * DSN is how a platform ends up finding out about outages by telephone.
 */
export function register(): void {
  const runtime = process.env.NEXT_RUNTIME || "nodejs";
  if (errorTrackingEnabled()) console.log(`[dk:instrumentation] ${runtime}: error reporting -> console + Sentry`);
  else console.log(`[dk:instrumentation] ${runtime}: error reporting -> console only (set SENTRY_DSN to forward)`);
}

/**
 * Every error Next catches while rendering a page, running a route handler, a server action or the proxy.
 *
 * The error handed over is usually *not* the one that was thrown: React replaces a Server Component error
 * with an opaque one and keeps only `digest`. That digest is also what the error boundaries show the
 * visitor, so it is the join key between "the customer sent me a screenshot" and this log line — the
 * reporter always prints it.
 *
 * `x-dk-host` / `host` are logged because this is a multi-tenant platform: "which site was down" is the
 * first question, and the route path (`/tenant/[host]/...`) cannot answer it.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  await reportError(error, {
    source: "onRequestError",
    fields: {
      path: request.path,
      method: request.method,
      routePath: context.routePath,
      routeType: context.routeType,
      routerKind: context.routerKind,
      renderSource: context.renderSource,
      revalidateReason: context.revalidateReason,
      runtime: process.env.NEXT_RUNTIME || "nodejs",
      ...Object.fromEntries(SAFE_HEADERS.map((h) => [h, header(request.headers, h)])),
    },
  });
};
