"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Header shell that knows whether the page has been scrolled past `threshold` and swaps its classes.
 * While scrolled it also sets `data-scrolled` so children can react with `group-data-[scrolled]:` utilities.
 */
export function NavScrollState({
  children,
  className = "",
  topClassName = "",
  scrolledClassName = "",
  threshold = 32,
}: {
  children: ReactNode;
  className?: string;
  topClassName?: string;
  scrolledClassName?: string;
  threshold?: number;
}) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      setScrolled(window.scrollY > threshold);
    };
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [threshold]);
  return (
    <header id="top" data-scrolled={scrolled ? "" : undefined} className={`group ${className} ${scrolled ? scrolledClassName : topClassName}`}>
      {children}
    </header>
  );
}
