"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "./ConfirmDialog";
import { formSignature, interceptsNavigation } from "./dirty";

export interface DirtyLabels {
  /** "Unsaved changes" — shown in the save bar while the form differs from what is stored. */
  badge: string;
  title: string;
  message: string;
  /** Confirm: "Leave without saving". */
  leave: string;
  /** Cancel: "Stay on this page". */
  stay: string;
}

/**
 * Unsaved-change protection for one form.
 *
 * Two different things can take the owner off the page and they need two different guards:
 *  - a real document unload (reload, closing the tab, typing another address) -> `beforeunload`.
 *  - a tap on the bottom tab bar -> a `next/link` client transition, which fires no `beforeunload`
 *    at all. That is the one that actually happens: a contractor fills five bilingual fields, taps
 *    "المشاريع", and the browser throws the work away without a word. Those clicks are caught here,
 *    in the capture phase (before the router sees them), and replayed through the router if the owner
 *    says to leave.
 *
 * Dirtiness is a comparison against a snapshot taken at mount, not a latch on the first keystroke, so
 * typing a letter and deleting it again leaves the form clean.
 */
export function DirtyGuard({ labels }: { labels: DirtyLabels }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const baseline = useRef<string | null>(null);
  const held = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [asking, setAsking] = useState(false);
  const router = useRouter();

  const mark = useCallback((next: boolean) => {
    dirtyRef.current = next;
    setDirty(next);
  }, []);

  useEffect(() => {
    const form = anchor.current?.closest("form");
    if (!form) return;
    const signature = () => formSignature(new FormData(form).entries());
    baseline.current = signature();
    const check = () => mark(signature() !== baseline.current);
    // A submit is the moment the form stops being unsaved work: if the action redirects, the page is
    // replaced anyway; if it re-renders in place, this snapshot is already what the server received.
    const onSubmit = () => {
      baseline.current = signature();
      mark(false);
    };
    form.addEventListener("input", check);
    form.addEventListener("change", check);
    form.addEventListener("submit", onSubmit);
    return () => {
      form.removeEventListener("input", check);
      form.removeEventListener("change", check);
      form.removeEventListener("submit", onSubmit);
    };
  }, [mark]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      // The browser shows its own wording here; preventDefault is the whole API.
      e.preventDefault();
    };
    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current) return;
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      const ok = interceptsNavigation(
        { href: link.getAttribute("href") || "", target: link.target, hasDownload: link.hasAttribute("download") },
        e,
        window.location.href,
      );
      if (!ok) return;
      e.preventDefault();
      // The router must not learn about this click at all until the owner has answered.
      e.stopPropagation();
      held.current = link.href;
      setAsking(true);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return (
    <span ref={anchor} className="contents">
      {dirty && (
        <span role="status" className="me-auto inline-flex items-center gap-1.5 text-xs font-bold text-amber-700">
          <span aria-hidden>●</span>
          {labels.badge}
        </span>
      )}
      <ConfirmDialog
        open={asking}
        labels={{ title: labels.title, confirm: labels.leave, cancel: labels.stay }}
        message={labels.message}
        variant="danger"
        onConfirm={() => {
          const to = held.current;
          setAsking(false);
          held.current = null;
          // Cleared first: the navigation itself must not trip the beforeunload guard on the way out.
          mark(false);
          if (to) router.push(to);
        }}
        onCancel={() => {
          setAsking(false);
          held.current = null;
        }}
      />
    </span>
  );
}
