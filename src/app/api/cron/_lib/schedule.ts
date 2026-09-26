/**
 * The numbers the scheduled jobs run on, in one place so the panel and the cron cannot disagree — the
 * "purged in N days" badge in /super/deleted is the same constant the purge actually uses.
 *
 * A leading underscore keeps this folder out of the router: Next never generates a route for `_lib`.
 */

/** How long a soft-deleted site stays restorable. Matches the promise made in the terms on /pricing. */
export const PURGE_AFTER_DAYS = 30;

/**
 * `login_attempts` had NO cleanup at all: every failed sign-in ever attempted was still on the row, which
 * both grows without bound and keeps a record of who tried to get in long after it can tell anyone
 * anything. The lockout window is fifteen minutes; thirty days is generous for looking at a pattern.
 */
export const LOGIN_ATTEMPT_RETENTION_DAYS = 30;

/** Spam leads go quickly; closed ones are kept a year for "who did we talk to last summer". */
export const LEAD_SPAM_RETENTION_DAYS = 30;
export const LEAD_CLOSED_RETENTION_DAYS = 365;

/**
 * Visitor PII retention.
 *
 * A `visitors` row carries an IP, a user agent, a referrer and a landing URL — the raw material of a
 * lead — and nothing ever removed any of it. After 18 months those fields cannot tell the owner anything
 * useful about a lead he never closed, so they are nulled while the row (and therefore the funnel count)
 * survives. A visitor who never got past `new` is deleted outright at 24 months.
 */
export const VISITOR_ANONYMISE_MONTHS = 18;
export const VISITOR_DELETE_MONTHS = 24;

/** How many queued external deletions one run attempts. Bounded so a backlog cannot time the function out. */
export const DELETION_BATCH = 100;

/** A queue row that has failed this many times stops being retried, but is never dropped — it is evidence. */
export const DELETION_MAX_ATTEMPTS = 10;
