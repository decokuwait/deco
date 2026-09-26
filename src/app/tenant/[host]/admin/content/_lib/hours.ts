import type { AdminUiKey } from "@/lib/i18n/admin";

/**
 * The working week as the owner reads it: Saturday first, Friday last. The keys are schema.org day
 * names because that is what `openingHoursSpecification` needs; nothing but the renderer sees them.
 */
export const HOURS_DAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
export type HoursDay = (typeof HOURS_DAYS)[number];

export const HOURS_DAY_LABELS: Record<HoursDay, AdminUiKey> = {
  Saturday: "day_sat",
  Sunday: "day_sun",
  Monday: "day_mon",
  Tuesday: "day_tue",
  Wednesday: "day_wed",
  Thursday: "day_thu",
  Friday: "day_fri",
};

/** A day is open or not, and has up to two shifts — the split shift is the normal Kuwaiti pattern. */
export interface DayShifts {
  open: boolean;
  a: { from: string; to: string };
  b: { from: string; to: string };
}

export type HoursSpec = { days: string[]; opens: string; closes: string }[];

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMPTY: DayShifts = { open: false, a: { from: "", to: "" }, b: { from: "", to: "" } };

/**
 * The week a site starts from: every day closed, with a plausible split shift already typed in.
 *
 * Nothing is published until the owner ticks a day. Pre-ticking them would put opening hours this
 * business never stated into its structured data the first time anything else on the page is saved —
 * invented facts about a real shop, from a form the owner may never have scrolled to.
 */
export function defaultWeek(): Record<HoursDay, DayShifts> {
  const out = {} as Record<HoursDay, DayShifts>;
  for (const day of HOURS_DAYS) out[day] = { ...EMPTY, a: { from: "09:00", to: "13:00" }, b: { from: "16:00", to: "20:00" } };
  return out;
}

/** Stored spec -> one entry per day, for the editor. Ranges beyond the second are dropped. */
export function spreadHours(spec: HoursSpec | undefined | null): Record<HoursDay, DayShifts> {
  if (!spec?.length) return defaultWeek();
  const byDay = new Map<HoursDay, { from: string; to: string }[]>();
  for (const entry of spec) {
    if (!TIME.test(entry.opens || "") || !TIME.test(entry.closes || "")) continue;
    for (const day of entry.days ?? []) {
      if (!(HOURS_DAYS as readonly string[]).includes(day)) continue;
      const list = byDay.get(day as HoursDay) ?? [];
      list.push({ from: entry.opens, to: entry.closes });
      byDay.set(day as HoursDay, list);
    }
  }
  const out = {} as Record<HoursDay, DayShifts>;
  for (const day of HOURS_DAYS) {
    const ranges = (byDay.get(day) ?? []).sort((x, y) => (x.from < y.from ? -1 : 1));
    out[day] = {
      open: ranges.length > 0,
      a: ranges[0] ?? { from: "09:00", to: "13:00" },
      b: ranges[1] ?? { from: "", to: "" },
    };
  }
  return out;
}

/**
 * The editor's fields -> the stored spec, with days that share a range grouped into one entry.
 *
 * Grouping is not cosmetic: `openingHoursSpecification` with one entry per day per shift is fourteen
 * objects of mostly identical data, and Google reads the grouped form just as well.
 */
export function readHoursSpec(fd: FormData): HoursSpec {
  const field = (name: string) => String(fd.get(name) ?? "").trim().slice(0, 5);
  const byRange = new Map<string, string[]>();
  for (const day of HOURS_DAYS) {
    const checked = fd.get(`hours.${day}.open`);
    if (!(checked === "on" || checked === "true" || checked === "1")) continue;
    for (const shift of ["a", "b"] as const) {
      const opens = field(`hours.${day}.${shift}.from`);
      const closes = field(`hours.${day}.${shift}.to`);
      // A shift that ends before it starts is a typo, not an overnight shift: nobody here opens at 20:00
      // and closes at 09:00, and publishing it would tell Google the shop is shut all day.
      if (!TIME.test(opens) || !TIME.test(closes) || closes <= opens) continue;
      const key = `${opens}-${closes}`;
      byRange.set(key, [...(byRange.get(key) ?? []), day]);
    }
  }
  return [...byRange.entries()]
    .map(([key, days]) => ({ days, opens: key.slice(0, 5), closes: key.slice(6) }))
    .sort((x, y) => (x.opens < y.opens ? -1 : 1));
}
