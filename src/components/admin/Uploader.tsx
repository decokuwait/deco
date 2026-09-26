"use client";

import { useEffect, useRef, useState } from "react";
import { uploadRequestHeaders } from "./upload-headers";
import { announceChange } from "./dirty";
import { responsiveSrc } from "@/templates/ui/img";
import { acceptFor, encodeTypeFor, extensionFor, fileProblem, variantPlan } from "./image-pipeline";

const SKIP_BELOW = 1.5 * 1024 * 1024;

interface Target {
  mode: "put" | "post";
  uploadUrl: string;
  publicUrl: string;
  key?: string;
  headers?: Record<string, string>;
}
interface TargetResponse extends Target {
  /** Sibling targets for the smaller derivatives, when the deployment's upload route supports them. */
  variants?: Array<Target & { width: number }>;
}

async function requestTarget(siteId: string, file: File, widths?: number[], width?: number): Promise<TargetResponse> {
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ siteId, filename: file.name, contentType: file.type, size: file.size, ...(widths?.length ? { widths, width } : {}) }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  return (await res.json()) as TargetResponse;
}

/**
 * Turns the browser's one opaque upload error into the cause the owner can act on.
 *
 * The PUT goes to the bucket, not to us, so when it never lands the browser refuses to say why — a
 * blocked CORS preflight, an unreachable bucket and a dropped connection are one indistinguishable
 * `onerror`. Only the first of those is the owner's own deployment to fix, and telling them "connection
 * lost" for it costs hours. The server is not bound by CORS, so it asks the bucket for us.
 *
 * Any failure to get an answer keeps the original verdict: if our own origin cannot be reached either,
 * "connection lost" was right.
 */
async function diagnose(): Promise<string> {
  try {
    const res = await fetch("/api/upload/diagnose", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (!res.ok) return "network";
    const reason = (await res.json())?.reason;
    return typeof reason === "string" ? reason : "network";
  } catch {
    return "network";
  }
}

function putFile(target: Target, file: File, onProgress: (fraction: number) => void): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(target.mode === "put" ? "PUT" : "POST", target.uploadUrl);
    /**
     * A request the page's own Content-Security-Policy refuses never reaches the network, and XHR
     * reports that refusal as an ordinary `onerror` — identical to a dropped connection. The panel
     * therefore told the owner "connection lost" while the network was perfectly fine, and the real
     * cause (the upload goes cross-origin to the bucket, which `connect-src` has to name) was invisible
     * from the message. The browser does fire a separate event for it, so listen for that and say which
     * of the two actually happened.
     */
    let blockedByPolicy = false;
    const onViolation = (e: SecurityPolicyViolationEvent) => {
      if (e.effectiveDirective.startsWith("connect-src") && target.uploadUrl.startsWith(e.blockedURI.slice(0, 40))) blockedByPolicy = true;
    };
    document.addEventListener("securitypolicyviolation", onViolation);
    const done = () => document.removeEventListener("securitypolicyviolation", onViolation);

    // Exactly once per header name: XHR merges repeated names into one comma-joined value, which
    // would no longer match what was signed. Content-Length is the browser's to set.
    for (const [header, headerValue] of uploadRequestHeaders(target.headers, file.type)) xhr.setRequestHeader(header, headerValue);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      done();
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`upload ${xhr.status}`));
    };
    xhr.onerror = () => {
      done();
      reject(new Error(blockedByPolicy ? "blocked_by_policy" : "network"));
    };
    xhr.send(file);
  });
}

/**
 * Decodes with the orientation the camera recorded.
 *
 * `createImageBitmap(file)` with no options leaves `imageOrientation` at the engine's default, and the
 * defaults disagree. Drawing that bitmap to a canvas and re-encoding throws the EXIF away, so on the
 * engines that ignore it a portrait phone photo was stored permanently rotated 90°, with no metadata
 * left for anything downstream to correct. It is not recoverable, so it must not happen.
 */
async function decode(file: File): Promise<ImageBitmap | null> {
  if (typeof createImageBitmap !== "function") return null;
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
}

async function render(bitmap: ImageBitmap, width: number, height: number, type: string): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, width, height);
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.86));
}

/**
 * Upload control for admin forms. Requests an upload target from /api/upload, uploads the file directly
 * (R2 presigned PUT, or local POST in development) and stores the public URL in a hidden input named
 * `name` so the surrounding form can submit it.
 *
 * With `multiple`, a whole job's worth of photos is picked once and uploaded as a queue, and each
 * finished URL gets its own hidden input — twenty photos are one pick and one save instead of twenty
 * upload-and-submit round trips on a phone at a building site.
 */
export function Uploader({
  name,
  siteId,
  value,
  accept,
  label,
  uploadingLabel,
  removeLabel,
  kind = "image",
  multiple = false,
  errorLabels,
  onUploaded,
}: {
  name: string;
  siteId: string;
  value?: string | null;
  /** Defaults to the explicit type list for `kind`; only pass this to narrow it further. */
  accept?: string;
  label: string;
  uploadingLabel: string;
  removeLabel?: string;
  kind?: "image" | "video";
  multiple?: boolean;
  /** Error code -> message, from uploadErrorLabels(t); an unknown code is shown as-is. */
  errorLabels?: Record<string, string>;
  onUploaded?: (url: string) => void;
}) {
  const [urls, setUrls] = useState<string[]>(value ? [value] : []);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [queue, setQueue] = useState({ done: 0, total: 0 });
  const [errors, setErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  // A finished upload writes only to hidden inputs, which fire no event; say so, or the unsaved-change
  // guard would let the owner walk away from a photo that was uploaded but never saved.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    announceChange(root.current);
  }, [urls]);

  function fail(code: string) {
    setErrors((prev) => (prev.includes(code) ? prev : [...prev, code]));
  }

  /** Uploads one image plus its derivatives; returns the URL of the stored original. */
  async function uploadImage(file: File, onProgress: (f: number) => void): Promise<string> {
    const bitmap = await decode(file);
    if (!bitmap) {
      const target = await requestTarget(siteId, file);
      await putFile(target, file, onProgress);
      return target.publicUrl;
    }
    try {
      const plan = variantPlan(bitmap.width, bitmap.height);
      const type = encodeTypeFor(file.type);
      const baseName = file.name.replace(/\.[^.]+$/, "") + extensionFor(type);
      // Already small enough: keep the owner's own file rather than re-encoding it for nothing (and
      // keep its type, which matters for the formats canvas cannot write back, such as AVIF).
      const untouched = plan.base.width === bitmap.width && plan.base.height === bitmap.height && file.size < SKIP_BELOW;
      const blob = untouched ? null : await render(bitmap, plan.base.width, plan.base.height, type);
      if (!untouched && !blob) return uploadOne(file, onProgress);
      const baseFile = blob ? new File([blob], baseName, { type }) : file;

      const widths = plan.variants.map((v) => v.width);
      const target = await requestTarget(siteId, baseFile, widths, plan.base.width);
      const variants = target.variants ?? [];
      const complete = widths.length > 0 && widths.every((w) => variants.some((v) => v.width === w));
      if (!complete) {
        // Either nothing to derive, or a deployment whose upload route does not issue sibling keys yet.
        // The stored name then carries no `@<width>w` marker, so the renderer asks for no candidates and
        // nothing 404s: the ladder simply turns itself on when the route supports it. A route that
        // honoured the request only partly would leave a marker promising files that were never written,
        // so that one target is dropped for a plain one.
        const marked = /@\d{2,5}w\.[a-z0-9]+$/i.test(target.key ?? "");
        const plain = marked ? await requestTarget(siteId, baseFile) : target;
        await putFile(plain, baseFile, onProgress);
        return plain.publicUrl;
      }
      // Derivatives first: the base file's name is the promise that they exist, so it must be the last
      // thing written. A failure here falls back to a plain, markerless upload rather than a broken srcSet.
      try {
        let uploaded = 0;
        for (const v of variants) {
          const size = plan.variants.find((p) => p.width === v.width);
          if (!size) continue;
          const small = await render(bitmap, size.width, size.height, type);
          if (!small) throw new Error("derivative_failed");
          await putFile(v, new File([small], baseName, { type }), (f) => onProgress(((uploaded + f) / variants.length) * 0.15));
          uploaded++;
        }
      } catch {
        const plain = await requestTarget(siteId, baseFile);
        await putFile(plain, baseFile, onProgress);
        return plain.publicUrl;
      }
      await putFile(target, baseFile, (f) => onProgress(0.15 + f * 0.85));
      return target.publicUrl;
    } finally {
      bitmap.close();
    }
  }

  async function run(files: File[]) {
    setBusy(true);
    setErrors([]);
    setProgress(0);
    setQueue({ done: 0, total: files.length });
    const accepted: string[] = [];
    for (const [i, file] of files.entries()) {
      setQueue({ done: i, total: files.length });
      setProgress(0);
      const problem = fileProblem(file, kind);
      if (problem) {
        fail(problem);
        continue;
      }
      try {
        const onProgress = (f: number) => setProgress(Math.max(0, Math.min(100, Math.round(f * 100))));
        // An animated GIF is one frame after a canvas round trip, so it is stored exactly as picked.
        const resize = kind === "image" && file.type !== "image/gif";
        const url = resize ? await uploadImage(file, onProgress) : await uploadOne(file, onProgress);
        accepted.push(url);
        onUploaded?.(url);
      } catch (e) {
        const code = e instanceof Error ? e.message : "error";
        // "network" is the browser's word for "the upload never got a reply", which is three different
        // faults wearing one name. Only that code is worth a round trip to find out which.
        fail(code === "network" ? await diagnose() : code);
      }
    }
    if (accepted.length) setUrls((prev) => (multiple ? [...prev, ...accepted] : accepted.slice(-1)));
    setQueue({ done: files.length, total: files.length });
    setBusy(false);
  }

  async function uploadOne(file: File, onProgress: (f: number) => void): Promise<string> {
    const target = await requestTarget(siteId, file);
    await putFile(target, file, onProgress);
    return target.publicUrl;
  }

  const single = urls[0] ?? "";
  const text = errors.map((code) => errorLabels?.[code] ?? code);
  const counter = queue.total > 1 ? `${queue.done + 1}/${queue.total} · ` : "";

  return (
    <div ref={root} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      {/* Always present, even empty, so the surrounding form always submits this field. */}
      {urls.length === 0 ? <input type="hidden" name={name} value="" /> : urls.map((u) => <input key={u} type="hidden" name={name} value={u} />)}

      {multiple ? (
        <>
          {urls.length > 0 && (
            <ul className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {urls.map((u) => (
                <li key={u} className="relative">
                  {kind === "video" ? (
                    <video src={u} className="h-20 w-full rounded-lg bg-black object-cover" muted playsInline preload="metadata" />
                  ) : (
                    <img src={u} {...responsiveSrc(u, "120px")} alt="" loading="lazy" decoding="async" className="h-20 w-full rounded-lg object-cover" />
                  )}
                  <button
                    type="button"
                    aria-label={removeLabel || "×"}
                    onClick={() => setUrls((prev) => prev.filter((x) => x !== u))}
                    className="absolute top-1 end-1 flex h-7 w-7 items-center justify-center rounded-full border border-red-200 bg-white/95 text-xs font-black text-red-700"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-white px-4 py-6 text-sm font-bold text-slate-600 hover:border-emerald-500 hover:text-emerald-700 disabled:opacity-60"
          >
            {busy ? `${counter}${uploadingLabel} ${progress}%` : label}
          </button>
        </>
      ) : single ? (
        <div className="flex items-center gap-3">
          {kind === "video" ? (
            <video src={single} className="h-20 w-28 rounded-lg bg-black object-cover" muted playsInline preload="metadata" />
          ) : (
            <img src={single} {...responsiveSrc(single, "112px")} alt="" loading="lazy" decoding="async" className="h-20 w-28 rounded-lg object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-slate-500" dir="ltr">
              {single}
            </p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold">
                {label}
              </button>
              <button type="button" onClick={() => setUrls([])} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-700">
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
          {busy ? `${counter}${uploadingLabel} ${progress}%` : label}
        </button>
      )}

      {busy && (
        <div className="mt-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500" aria-live="polite">
            {counter}
            {uploadingLabel} {progress}%
          </p>
        </div>
      )}
      {text.map((message) => (
        <p key={message} className="mt-2 text-xs font-bold text-red-600">
          {message}
        </p>
      ))}
      <input
        ref={fileRef}
        type="file"
        accept={accept ?? acceptFor(kind)}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          if (picked.length) void run(picked);
          e.target.value = "";
        }}
      />
    </div>
  );
}
