import type { ConsentMode } from "@/lib/types";

/**
 * The visitor's answer to the tracking notice.
 *
 * Deliberately a plain, script-readable cookie and not a field on the visitor row: it has to be
 * readable before anything else runs on every page, and it must work for a visitor who has no row yet.
 */
export const CONSENT_COOKIE = "dk_consent";
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 180;

export type ConsentChoice = "granted" | "declined" | "unset";
/**
 * `ssr` is the value the server render sees. It is part of the snapshot rather than a separate
 * `mounted` flag so the whole thing stays one stable string, which is what `useSyncExternalStore`
 * needs — and so the notice does not render into the HTML only to vanish a frame later.
 */
export type ConsentSnapshot = ConsentChoice | "ssr";

function readCookieChoice(): ConsentChoice {
  if (typeof document === "undefined") return "unset";
  const m = document.cookie.match(/(?:^|; )dk_consent=([^;]*)/);
  if (!m) return "unset";
  return m[1] === "1" ? "granted" : m[1] === "0" ? "declined" : "unset";
}

const listeners = new Set<() => void>();
let cached: ConsentSnapshot | null = null;

export function subscribeConsent(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Cached so repeated renders see the identical string; the cookie only changes through `setConsent`. */
export function consentSnapshot(): ConsentSnapshot {
  if (cached === null) cached = readCookieChoice();
  return cached;
}

export function serverConsentSnapshot(): ConsentSnapshot {
  return "ssr";
}

export function setConsent(choice: Exclude<ConsentChoice, "unset">) {
  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${choice === "granted" ? "1" : "0"}; path=/; max-age=${CONSENT_MAX_AGE}; samesite=lax${secure}`;
  cached = choice;
  for (const l of listeners) l();
}

export function choiceOf(snapshot: ConsentSnapshot): ConsentChoice {
  return snapshot === "ssr" ? "unset" : snapshot;
}

/**
 * Whether the ad-platform pixels and the server-side click signal may run.
 *
 * `notice` grants by default on purpose. Kuwait has no general data protection law, and the CITRA
 * DPPR covers licensed telecom/internet providers only, so this platform sits outside it; what the
 * notice answers is the ad platforms' own business-tool terms, which outside the EEA ask for
 * disclosure rather than opt-in. An opt-in wall here would cost the owner most of their measurement
 * for an obligation that does not exist — so it is offered (`explicit`) and is not the default.
 *
 * On the server render the answer is not knowable, so `explicit` withholds and `notice` proceeds:
 * each mode fails in the direction it was chosen for.
 */
export function trackingAllowed(mode: ConsentMode, snapshot: ConsentSnapshot): boolean {
  if (mode === "off") return true;
  const choice = choiceOf(snapshot);
  if (mode === "explicit") return choice === "granted";
  return choice !== "declined";
}

/** Whether the notice still has something to say. Never during the server render: it would flash. */
export function noticeVisible(mode: ConsentMode, snapshot: ConsentSnapshot): boolean {
  if (mode === "off" || snapshot === "ssr") return false;
  return snapshot === "unset";
}
