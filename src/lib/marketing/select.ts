import type { PixelConfig, Platform, SourcePlatform } from "@/lib/types";

export type SignalMode = "smart" | "all";

/**
 * Decide which active pixels receive a server-side signal for a visitor.
 * smart: if the visitor's source platform is known AND that platform has an active, server-ready pixel,
 *        only that pixel. Otherwise (direct/other/unknown, or that platform not ready) every ready pixel.
 * all:   always every ready pixel.
 * `ready` filters pixels that have the credentials needed to deliver (defaults to "has a pixel id").
 */
export function selectTargets(
  activePixels: PixelConfig[],
  source: SourcePlatform | null | undefined,
  mode: SignalMode = "smart",
  ready: (p: PixelConfig) => boolean = (p) => !!p.pixelId,
): PixelConfig[] {
  const usable = activePixels.filter((p) => p.active && p.pixelId && p.pixelId.trim() && ready(p));
  if (mode === "all") return usable;
  if (source && source !== "direct" && source !== "other") {
    const match = usable.filter((p) => p.platform === (source as Platform));
    if (match.length) return match;
  }
  return usable;
}
