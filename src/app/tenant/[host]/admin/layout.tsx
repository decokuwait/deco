import type { ReactNode } from "react";

// Every admin page reads cookies/headers (session + locale) and must never be cached.
export const dynamic = "force-dynamic";

/** No auth here: the login page lives inside this segment. Pages call requireSiteAdmin() themselves. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
