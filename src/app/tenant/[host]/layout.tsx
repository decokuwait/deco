import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

/**
 * Pass-through layout for a tenant host. It exists so the segment owns a not-found boundary: unknown
 * paths (and platform-only routes) then render the site's own branded 404 page server-side instead of
 * the framework's generic error shell.
 */
export default function TenantHostLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
