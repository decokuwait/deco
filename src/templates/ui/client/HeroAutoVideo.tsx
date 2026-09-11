"use client";

import { useEffect, useRef } from "react";

/**
 * Muted, looping background video. React does not serialise the `muted` attribute on the server, so
 * we force it (and kick off playback) after mount to keep browser autoplay policies happy.
 * Playback is skipped for visitors who asked for reduced motion or data saving, and paused while the
 * hero is scrolled out of view, so a large upload never streams for nothing.
 */
export function HeroAutoVideo({ src, poster, className = "" }: { src: string; poster?: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (reduce || saveData) {
      v.removeAttribute("autoplay");
      v.pause();
      return;
    }
    v.muted = true;
    v.defaultMuted = true;
    const play = () => {
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => undefined);
    };
    if (!("IntersectionObserver" in window)) {
      play();
      return;
    }
    const io = new IntersectionObserver(([entry]) => (entry?.isIntersecting ? play() : v.pause()), { threshold: 0.15 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return <video ref={ref} src={src} poster={poster} className={className} autoPlay muted loop playsInline preload="metadata" aria-hidden />;
}
