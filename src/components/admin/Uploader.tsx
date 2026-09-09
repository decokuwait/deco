"use client";

import { useRef, useState } from "react";

/**
 * Upload control for admin forms. Requests an upload target from /api/upload, uploads the file
 * directly (R2 presigned PUT, or local POST in development) and stores the public URL in a hidden
 * input named `name` so the surrounding form can submit it.
 */
export function Uploader({
  name,
  siteId,
  value,
  accept = "image/*",
  label,
  uploadingLabel,
  removeLabel,
  kind = "image",
  onUploaded,
}: {
  name: string;
  siteId: string;
  value?: string | null;
  accept?: string;
  label: string;
  uploadingLabel: string;
  removeLabel?: string;
  kind?: "image" | "video";
  onUploaded?: (url: string) => void;
}) {
  const [url, setUrl] = useState(value || "");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, filename: file.name, contentType: file.type, size: file.size }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const target = (await res.json()) as { mode: "put" | "post"; uploadUrl: string; publicUrl: string; headers?: Record<string, string> };
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(target.mode === "put" ? "PUT" : "POST", target.uploadUrl);
        if (target.headers) for (const [k, v] of Object.entries(target.headers)) xhr.setRequestHeader(k, v);
        else xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload ${xhr.status}`)));
        xhr.onerror = () => reject(new Error("network"));
        xhr.send(file);
      });
      setUrl(target.publicUrl);
      onUploaded?.(target.publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <input type="hidden" name={name} value={url} />
      {url ? (
        <div className="flex items-center gap-3">
          {kind === "video" ? (
            <video src={url} className="h-20 w-28 rounded-lg bg-black object-cover" muted playsInline />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-20 w-28 rounded-lg object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-slate-500" dir="ltr">
              {url}
            </p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold">
                {label}
              </button>
              <button type="button" onClick={() => setUrl("")} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-700">
                {removeLabel || "×"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-white px-4 py-6 text-sm font-bold text-slate-600 hover:border-emerald-500 hover:text-emerald-700 disabled:opacity-60"
        >
          {busy ? `${uploadingLabel} ${progress}%` : label}
        </button>
      )}
      {busy && url && <div className="mt-2 text-xs text-slate-500">{uploadingLabel} {progress}%</div>}
      {error && <p className="mt-2 text-xs font-bold text-red-600">{error}</p>}
      <input
        ref={fileRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
