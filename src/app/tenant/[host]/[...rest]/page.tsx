import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/** Unknown paths on a tenant host (including platform-only routes) render the site's own 404 page. */
export default function TenantCatchAll() {
  notFound();
}
