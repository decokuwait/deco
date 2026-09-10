"use client";

import { useState } from "react";

/**
 * Colour override control: the "custom" checkbox is ticked automatically when the admin picks a colour,
 * and unticking it returns that colour to the template default on save.
 */
export function ColorPick({ name, label, templateValue, value, customLabel }: { name: string; label: string; templateValue: string; value: string; customLabel: string }) {
  const [custom, setCustom] = useState(!!value);
  const [color, setColor] = useState(value || templateValue);
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <span className="mb-1.5 block text-sm font-bold text-slate-700">{label}</span>
      <div className="flex items-center gap-3">
        <input
          type="color"
          name={name}
          value={color}
          onChange={(e) => {
            setColor(e.target.value);
            setCustom(true);
          }}
          className="h-11 w-16 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
        />
        <span className="font-mono text-xs text-slate-500" dir="ltr">
          {custom ? color : templateValue}
        </span>
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-600">
        <input type="checkbox" name={`${name}_custom`} checked={custom} onChange={(e) => setCustom(e.target.checked)} className="h-4 w-4" />
        {customLabel}
      </label>
    </div>
  );
}
