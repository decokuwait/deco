import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

/** Auth is checked per page via requireSuper(); the login page lives inside this segment. */
export default function SuperLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
