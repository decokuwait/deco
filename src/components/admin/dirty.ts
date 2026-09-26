/**
 * Shared helpers for unsaved-change tracking. Pure, so the rule that decides "this form has edits in it"
 * is unit-testable without a DOM.
 */

/**
 * Fields React puts in a form itself so a Server Action still works without JavaScript. They change
 * between renders and are not the owner's typing, so they must never make a form look dirty.
 */
const REACT_INTERNAL = /^\$ACTION/;

/**
 * A stable string for everything a form would submit right now.
 *
 * Comparing against a baseline taken at mount (rather than latching a boolean on the first keystroke) is
 * what stops the guard from nagging an owner who typed a letter and deleted it again — a false alarm is
 * how a warning gets trained out of someone.
 */
export function formSignature(entries: Iterable<[string, FormDataEntryValue]>): string {
  const parts: string[] = [];
  for (const [name, value] of entries) {
    if (REACT_INTERNAL.test(name)) continue;
    // File values are never part of what the panel stores: an Uploader puts the finished URL in a hidden
    // input, and the file input itself is unnamed.
    if (typeof value !== "string") continue;
    parts.push(`${name}\u0000${value}`);
  }
  return parts.join("\u0001");
}

/**
 * Tells the surrounding form that a hidden field changed.
 *
 * Setting `value` from React fires no `input` event, so a reorder, a removal or a finished upload — all
 * of which write only to hidden inputs — would leave the unsaved-change guard believing the form is
 * untouched, which is worse than having no guard at all.
 */
export function announceChange(el: Element | null | undefined) {
  el?.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Whether a left click on a link should be held back by the guard instead of navigating. */
export function interceptsNavigation(
  anchor: { href: string; target: string; hasDownload: boolean },
  click: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; defaultPrevented: boolean },
  here: string,
): boolean {
  if (click.defaultPrevented || click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return false;
  if (anchor.hasDownload) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  let to: URL;
  let from: URL;
  try {
    from = new URL(here);
    to = new URL(anchor.href, here);
  } catch {
    return false;
  }
  if (to.origin !== from.origin) return false;
  // A jump inside the same page keeps the form on screen, so there is nothing to lose.
  return !(to.pathname === from.pathname && to.search === from.search);
}
