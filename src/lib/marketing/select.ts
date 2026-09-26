import type { PixelConfig, Platform, SignalMode, SourcePlatform } from "@/lib/types";

export type { SignalMode };

/** Why the selection came out the way it did — the admin shows this instead of implying a clean match. */
export type SelectionReason = "source" | "primary" | "all" | "none";

export interface Selection {
  targets: PixelConfig[];
  reason: SelectionReason;
  /** True when the visitor's source platform is not one we can attribute to (direct / other / missing). */
  unknownSource: boolean;
}

function knownSource(source: SourcePlatform | null | undefined): source is Platform {
  return !!source && source !== "direct" && source !== "other";
}

/**
 * Decide which active pixels receive a server-side signal for a visitor.
 *
 * The retired "smart" mode returned EVERY ready pixel whenever the source was unknown *or* the matching
 * pixel was not server-ready — and it was the default. One real lead then became N conversions across N
 * ad accounts: every ROAS inflates, and budget moves to whichever platform claims credit fastest. The
 * three modes are now explicit about that trade:
 *  - `source`  only the originating platform, and nothing at all when the source is unknown (default).
 *  - `primary` same, but unknown traffic falls back to the one platform the owner designated.
 *  - `all`     today's fan-out, chosen deliberately and labelled as such.
 * `ready` filters pixels that have the credentials needed to deliver (defaults to "has a pixel id").
 */
export function selectSignal(
  activePixels: PixelConfig[],
  source: SourcePlatform | null | undefined,
  mode: SignalMode = "source",
  ready: (p: PixelConfig) => boolean = (p) => !!p.pixelId,
  primaryPlatform: Platform | null = null,
): Selection {
  const usable = activePixels.filter((p) => p.active && p.pixelId && p.pixelId.trim() && ready(p));
  const unknownSource = !knownSource(source);
  if (mode === "all") return { targets: usable, reason: usable.length ? "all" : "none", unknownSource };
  if (knownSource(source)) {
    const match = usable.filter((p) => p.platform === source);
    if (match.length) return { targets: match, reason: "source", unknownSource };
  }
  // Source unknown, or its pixel is missing/not server-ready. Falling back to everything is what
  // manufactured the duplicate conversions, so the fallback is at most ONE platform, and only when the
  // owner named it.
  if (mode === "primary" && primaryPlatform) {
    const fallback = usable.filter((p) => p.platform === primaryPlatform);
    if (fallback.length) return { targets: fallback, reason: "primary", unknownSource };
  }
  return { targets: [], reason: "none", unknownSource };
}

/** Targets only — the shape the dispatcher and the admin's "will send to" card consume. */
export function selectTargets(
  activePixels: PixelConfig[],
  source: SourcePlatform | null | undefined,
  mode: SignalMode = "source",
  ready: (p: PixelConfig) => boolean = (p) => !!p.pixelId,
  primaryPlatform: Platform | null = null,
): PixelConfig[] {
  return selectSignal(activePixels, source, mode, ready, primaryPlatform).targets;
}
