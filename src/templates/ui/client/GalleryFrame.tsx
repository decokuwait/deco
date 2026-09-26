"use client";

import { createContext, useContext, type ReactNode } from "react";
import { Gallery, type LightboxItem } from "./Lightbox";
import { FOCUS_RING } from "../primitives";

const OpenCtx = createContext<(index: number) => void>(() => {});

/**
 * RSC-safe wrapper around `Gallery`. The frame owns one lightbox; any `GalleryOpen` rendered inside it
 * (including ones composed by server components) opens the viewer at the given index. No function
 * props cross the server/client boundary, so server sections can use it with plain JSX children.
 */
export function GalleryFrame({ items, closeLabel, children }: { items: LightboxItem[]; closeLabel: string; children: ReactNode }) {
  return (
    <Gallery items={items} closeLabel={closeLabel}>
      {(open) => <OpenCtx.Provider value={open}>{children}</OpenCtx.Provider>}
    </Gallery>
  );
}

/** Button that opens the enclosing `GalleryFrame` at `index`. Inert when `disabled` (e.g. project without media). */
export function GalleryOpen({
  index,
  children,
  className = "",
  label,
  disabled = false,
}: {
  index: number;
  children: ReactNode;
  className?: string;
  label?: string;
  disabled?: boolean;
}) {
  const open = useContext(OpenCtx);
  return (
    <button type="button" onClick={() => open(index)} className={`${className} ${FOCUS_RING}`} aria-label={label} disabled={disabled}>
      {children}
    </button>
  );
}
