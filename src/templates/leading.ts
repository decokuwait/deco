/**
 * Line-height floor for an Arabic heading.
 *
 * Latin display type is set tight — down to 1.02 on the editorial hero — and Arabic is not Latin: the
 * descenders of ج ح خ ع غ م ه ي ق, and the dots that hang under them, reach well below the baseline, so at
 * a Latin display leading the second line of a headline lands on top of the first. That headline is the
 * largest element on every page of every template, in the primary language of the site. Each heading
 * keeps its tight Latin value and adds this one, which wins on an Arabic page by specificity
 * (`.leading-[1.02]` is one class, `.[&:lang(ar)]:leading-[1.4]:lang(ar)` is a class plus a pseudo-class)
 * whatever order Tailwind emits them in.
 *
 * Both strings are written out in full, and live in a module of their own with no imports, because
 * Tailwind finds classes by scanning the source: a value assembled at runtime is never generated.
 */
export const AR_LEADING = "[&:lang(ar)]:leading-[1.4]";

/** The same floor for the Naskh and Ruqaa faces, whose descenders drop further still. */
export const AR_LEADING_TALL = "[&:lang(ar)]:leading-[1.55]";
