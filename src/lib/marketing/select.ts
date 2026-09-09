import type { PixelConfig, Platform, SourcePlatform } from "@/lib/types";

export type SignalMode = "smart" | "all";

/**
 * Decide which active pixels receive a signal for a visitor.
 * smart: if the visitor's source platform is known AND that platform has an active pixel, only that pixel.
 *        Otherwise (direct/other/unknown, or that platform has no pixel) every active pixel.
 * all:   always every active pixel.
 */
export function selectTargets(activePixels: PixelConfig[], source: SourcePlatform | null | undefined, mode: SignalMode = "smart"): PixelConfig[] {
  const usable = activePixels.filter((p) => p.active && p.pixelId && p.pixelId.trim());
  if (mode === "all") return usable;
  if (source && source !== "direct" && source !== "other") {
    const match = usable.filter((p) => p.platform === (source as Platform));
    if (match.length) return match;
  }
  return usable;
}
