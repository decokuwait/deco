"use client";

import { useRef, useState } from "react";

const MAX_EDGE = 2000;
const SKIP_BELOW = 1.5 * 1024 * 1024;

/**
 * Phone photos are 4000px+ and several MB; the site never renders wider than 2000px. Large images are
 * resized on the device before upload (transparent PNG/WebP keep their format, photos become JPEG),
 * which makes uploads fast on mobile data and keeps the hero image light for every visitor.
 */
async function prepareImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return file;
  if (typeof createImageBitmap !== "function") return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < SKIP_BELOW) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const type = file.type === "image/png" ? "image/png" : file.type === "image/webp" ? "image/webp" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.86));
    if (!blob || blob.size >= file.size) return file;
    const ext = type === "image/png" ? ".png" : type === "image/webp" ? ".webp" : ".jpg";
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ext, { type });
  } finally {
    bitmap.close();
  }
}

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

  async function onFile(original: File) {
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      const file = kind === "image" ? await prepareImage(original) : original;
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
        // Content-Length is a forbidden request header for XHR (the browser sets it); everything else is signed.
        if (target.headers) for (const [k, v] of Object.entries(target.headers)) if (k.toLowerCase() !== "content-length") xhr.setRequestHeader(k, v);
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
