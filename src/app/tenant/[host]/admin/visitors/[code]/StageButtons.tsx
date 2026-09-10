"use client";

import { useFormStatus } from "react-dom";

export interface StageOption {
  value: string;
  label: string;
  index: number;
  isCurrent: boolean;
  done: boolean;
  usesValue: boolean;
}

/** Stage buttons with a shared pending state so a double tap can never fire a second signal. */
export function StageButtons({ stages, pendingText, resendLabel, currentStage }: { stages: StageOption[]; pendingText: string; resendLabel: string; currentStage: string }) {
  const { pending } = useFormStatus();
  return (
    <div className="grid gap-2 sm:grid-cols-2" aria-busy={pending}>
      {stages.map((s) => (
        <button
          key={s.value}
          type="submit"
          name="stage"
          value={s.value}
          disabled={pending}
          aria-pressed={s.isCurrent}
          aria-current={s.isCurrent ? "step" : undefined}
          className={`flex min-h-[56px] items-center justify-between gap-2 rounded-xl border px-4 py-3 text-start text-sm font-bold transition disabled:opacity-60 ${
            s.isCurrent
              ? "border-emerald-600 bg-emerald-600 text-white"
              : s.done
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                : "border-slate-300 bg-white text-slate-800 hover:border-emerald-500 hover:bg-emerald-50"
          }`}
        >
          <span className="flex items-center gap-2">
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${s.isCurrent ? "bg-white/20" : "bg-slate-100 text-slate-600"}`}>{s.index}</span>
            {pending ? pendingText : s.label}
          </span>
          {s.usesValue && <span className={`text-[10px] ${s.isCurrent ? "text-white/80" : "text-slate-400"}`}>KWD</span>}
        </button>
      ))}
      {currentStage !== "new" && (
        <button type="submit" name="resend" value={currentStage} disabled={pending} className="rounded-xl border border-dashed border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:border-emerald-500 hover:text-emerald-700 disabled:opacity-60 sm:col-span-2">
          {resendLabel}
        </button>
      )}
    </div>
  );
}
