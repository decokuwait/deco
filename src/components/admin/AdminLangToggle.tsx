"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function AdminLangToggle({ locale }: { locale: "ar" | "en" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const next = locale === "ar" ? "en" : "ar";
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        document.cookie = `dk_admin_lang=${next}; path=/; max-age=31536000; samesite=lax`;
        start(() => router.refresh());
      }}
      className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
    >
      {next === "en" ? "EN" : "ع"}
    </button>
  );
}
