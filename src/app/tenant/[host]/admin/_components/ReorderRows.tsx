"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { announceChange } from "@/components/admin/dirty";

export interface ReorderLabels {
  up: string;
  down: string;
  remove: string;
  undo: string;
  willBeDeleted: string;
}

/**
 * Client-side ordering and removal for a list of rows (a content section's items, a project's photos).
 *
 * Every ↑ / ↓ used to be a form submit: moving the tenth photo to the top was nine page reloads, each one
 * a full server round trip on a phone at a building site. The rows are now moved on the device and the
 * result travels with the one save the owner was going to make anyway — `<prefix>.order` is the new
 * sequence of the original row indexes and `<prefix>.removed` the ones to drop (see `rowSequence` in
 * content/_lib/spec.ts, which both readers use).
 *
 * Removal is undoable until that save, which is why it does not ask for confirmation: the undo is a
 * better answer than a dialog, and it is one tap instead of two on the path the owner takes every time.
 *
 * Each row keeps the field names it was rendered with; only its position moves. The rows are keyed by
 * their original index, so React moves the existing DOM nodes rather than rebuilding them: what is typed
 * in a field survives a move, focus is not lost, and the reading order matches the visible order.
 */
export function ReorderRows({ count, labels, children, prefix = "rows" }: { count: number; labels: ReorderLabels; children: ReactNode[]; prefix?: string }) {
  const [order, setOrder] = useState<number[]>(() => Array.from({ length: count }, (_, i) => i));
  const [removed, setRemoved] = useState<number[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  // Reordering and removing only write to hidden inputs, which fire no event of their own; without this
  // the save bar would still say the page has no unsaved changes.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    announceChange(root.current);
  }, [order, removed]);

  function move(index: number, dir: -1 | 1) {
    setOrder((prev) => {
      const at = prev.indexOf(index);
      const to = at + dir;
      if (at < 0 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[at], next[to]] = [next[to], next[at]];
      return next;
    });
  }

  const btn = "inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold disabled:opacity-40 sm:min-h-8";

  return (
    <div ref={root} className="grid gap-4">
      <input type="hidden" name={`${prefix}.order`} value={order.join(",")} />
      <input type="hidden" name={`${prefix}.removed`} value={removed.join(",")} />
      {order.map((index, position) => {
        const gone = removed.includes(index);
        return (
          <div key={index} className={`rounded-2xl border p-4 ${gone ? "border-red-200 bg-red-50/50" : "border-slate-200 bg-slate-50"}`}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-xs font-black text-slate-500">#{position + 1}</span>
              {gone ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-red-700">{labels.willBeDeleted}</span>
                  <button type="button" data-dk={`${prefix}-undo`} onClick={() => setRemoved((prev) => prev.filter((r) => r !== index))} className={btn}>
                    {labels.undo}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button type="button" data-dk={`${prefix}-up`} onClick={() => move(index, -1)} disabled={position === 0} className={btn} aria-label={labels.up}>
                    ↑ {labels.up}
                  </button>
                  <button type="button" data-dk={`${prefix}-down`} onClick={() => move(index, 1)} disabled={position === order.length - 1} className={btn} aria-label={labels.down}>
                    ↓ {labels.down}
                  </button>
                  <button
                    type="button"
                    data-dk={`${prefix}-remove`}
                    onClick={() => setRemoved((prev) => [...prev, index])}
                    className="ms-2 inline-flex min-h-10 items-center justify-center rounded-lg border border-red-200 bg-white px-3 text-xs font-bold text-red-700 sm:min-h-8"
                  >
                    {labels.remove}
                  </button>
                </div>
              )}
            </div>
            {/* The fields stay mounted while marked for deletion so an undo restores exactly what was typed. */}
            <div className={gone ? "pointer-events-none opacity-40" : undefined} aria-hidden={gone || undefined}>
              {children[index]}
            </div>
          </div>
        );
      })}
    </div>
  );
}
