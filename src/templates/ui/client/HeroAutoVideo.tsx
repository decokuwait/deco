"use client";

import { useEffect, useRef } from "react";

/**
 * Muted, looping background video. React does not serialise the `muted` attribute on the server, so
 * we force it (and kick off playback) after mount to keep browser autoplay policies happy.
 */
export function HeroAutoVideo({ src, poster, className = "" }: { src: string; poster?: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    const p = v.play();
    if (p && typeof p.catch === "function") p.catch(() => undefined);
  }, []);
  return <video ref={ref} src={src} poster={poster} className={className} autoPlay muted loop playsInline preload="metadata" aria-hidden />;
}
