"use client";

import { useState } from "react";
import { HOURS_DAYS, type HoursDay, type DayShifts } from "../_lib/hours";

export interface HoursLabels {
  days: Record<HoursDay, string>;
  closed: string;
  shiftOne: string;
  shiftTwo: string;
  from: string;
  to: string;
  applyAll: string;
}

const timeCls = "rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30";

/**
 * Opening hours as a week, not a sentence.
 *
 * `contact.hours` is free text ("من ٩ صباحاً"), which no search engine can read as a schedule. This is
 * the structured version that becomes openingHoursSpecification. It is laid out for the Kuwaiti week —
 * Saturday first, Friday last and closed by default — and every day has two shifts, because a workshop
 * that closes for the afternoon and reopens in the evening is the normal case here, not an exception.
 */
export function HoursEditor({ value, labels }: { value: Record<HoursDay, DayShifts>; labels: HoursLabels }) {
  const [week, setWeek] = useState(value);

  function patch(day: HoursDay, next: Partial<DayShifts>) {
    setWeek((prev) => ({ ...prev, [day]: { ...prev[day], ...next } }));
  }

  function applyToOthers(from: HoursDay) {
    setWeek((prev) => {
      const source = prev[from];
      const next = { ...prev };
      for (const day of HOURS_DAYS) if (day !== from && day !== "Friday") next[day] = { ...source };
      return next;
    });
  }

  return (
    <div className="grid gap-3">
      {HOURS_DAYS.map((day) => {
        const d = week[day];
        return (
          <div key={day} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <input
                  type="checkbox"
                  name={`hours.${day}.open`}
                  checked={d.open}
                  onChange={(e) => patch(day, { open: e.target.checked })}
                  className="h-5 w-5"
                />
                {labels.days[day]}
              </label>
              {!d.open && <span className="text-xs font-bold text-slate-500">{labels.closed}</span>}
              {d.open && day === HOURS_DAYS[0] && (
                <button type="button" onClick={() => applyToOthers(day)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700">
                  {labels.applyAll}
                </button>
              )}
            </div>
            {d.open && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {(["a", "b"] as const).map((shift) => (
                  <div key={shift}>
                    <span className="mb-1.5 block text-xs font-bold text-slate-600">{shift === "a" ? labels.shiftOne : labels.shiftTwo}</span>
                    <div className="flex items-center gap-2" dir="ltr">
                      <span className="text-xs text-slate-500">{labels.from}</span>
                      <input
                        type="time"
                        name={`hours.${day}.${shift}.from`}
                        value={d[shift].from}
                        onChange={(e) => patch(day, { [shift]: { ...d[shift], from: e.target.value } } as Partial<DayShifts>)}
                        className={timeCls}
                      />
                      <span className="text-xs text-slate-500">{labels.to}</span>
                      <input
                        type="time"
                        name={`hours.${day}.${shift}.to`}
                        value={d[shift].to}
                        onChange={(e) => patch(day, { [shift]: { ...d[shift], to: e.target.value } } as Partial<DayShifts>)}
                        className={timeCls}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
