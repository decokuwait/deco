/** First visible character of a name for avatar medallions; falls back to a star when empty. */
export function initialOf(name: string): string {
  return name.trim().charAt(0) || "★";
}

/** Decorative double quotation mark. */
export function QuoteGlyph({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" />
    </svg>
  );
}
