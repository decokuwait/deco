"use client";

import { useState, type ReactNode } from "react";
import { Img, Video, cx } from "../primitives";

export interface RevealMedia {
  kind: "image" | "video";
  url: string;
  posterUrl?: string | null;
}

/**
 * Before/after reveal. The "after" layer fades in on mouse hover, and a tap / the label chips toggle it
 * explicitly (touch + keyboard). Once the visitor toggles, hover stops overriding their choice.
 * Videos render with native controls, so the full-area tap layer is only used while an image is shown.
 */
export function HoverReveal({
  before,
  after,
  beforeLabel,
  afterLabel,
  alt = "",
  className = "",
  aspect = "4/3",
}: {
  before: RevealMedia | null;
  after: RevealMedia | null;
  beforeLabel: string;
  afterLabel: string;
  alt?: string;
  className?: string;
  aspect?: string;
}) {
  const [showAfter, setShowAfter] = useState(false);
  const [locked, setLocked] = useState(false);
  const shown = showAfter ? after : before;
  const tapToggles = !shown || shown.kind !== "video";

  const set = (v: boolean) => {
    setLocked(true);
    setShowAfter(v);
  };

  return (
    <div
      className={cx("group relative select-none overflow-hidden rounded-card bg-surface-2", className)}
      style={{ aspectRatio: aspect }}
      onPointerEnter={(e) => e.pointerType === "mouse" && !locked && setShowAfter(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && !locked && setShowAfter(false)}
    >
      <Layer item={before} alt={`${beforeLabel} ${alt}`.trim()} visible={!showAfter} />
      <Layer item={after} alt={`${afterLabel} ${alt}`.trim()} visible={showAfter} />
      {tapToggles && (
        <button
          type="button"
          onClick={() => set(!showAfter)}
          aria-pressed={showAfter}
          aria-label={showAfter ? afterLabel : beforeLabel}
          className="absolute inset-0 h-full w-full cursor-pointer"
        />
      )}
      <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
        <div role="group" className="pointer-events-auto inline-flex rounded-full bg-black/55 p-1 shadow-lg backdrop-blur">
          <Chip active={!showAfter} onClick={() => set(false)}>
            {beforeLabel}
          </Chip>
          <Chip active={showAfter} onClick={() => set(true)}>
            {afterLabel}
          </Chip>
        </div>
      </div>
      <span
        aria-hidden
        className={cx(
          "pointer-events-none absolute bottom-3 end-3 h-2.5 w-2.5 rounded-full ring-2 ring-white/70 transition-colors duration-500",
          showAfter ? "bg-accent" : "bg-white/40",
        )}
      />
    </div>
  );
}

function Layer({ item, alt, visible }: { item: RevealMedia | null; alt: string; visible: boolean }) {
  return (
    <div
      aria-hidden={!visible}
      className={cx(
        "absolute inset-0 transition-[opacity,transform] duration-500 ease-out",
        visible ? "scale-100 opacity-100" : "pointer-events-none scale-105 opacity-0",
      )}
    >
      {item ? (
        item.kind === "video" ? (
          <Video item={item} className="h-full w-full object-cover" />
        ) : (
          <Img src={item.url} alt={alt} className="h-full w-full object-cover" />
        )
      ) : (
        <Img src={null} className="h-full w-full" />
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "min-h-11 rounded-full px-4 text-xs font-black uppercase tracking-wider transition",
        active ? "bg-white text-black shadow" : "text-white/85 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}
