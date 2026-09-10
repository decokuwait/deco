import type { LText } from "@/lib/types";
import { BilingualInput, Field, Input, Select, Textarea } from "@/components/admin/ui";
import { Uploader } from "@/components/admin/Uploader";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import type { FieldSpec, SectionSpec } from "../content/_lib/spec";
import { getPath } from "../content/_lib/spec";
import type { T } from "../_lib/guard";

/** Renders one field of a section spec bound to a value at `name`. */
export function FieldInput({ f, name, value, t, siteId }: { f: FieldSpec; name: string; value: unknown; t: T; siteId: string }) {
  switch (f.kind) {
    case "ltext":
      return (
        <BilingualInput
          name={name}
          value={(value as LText) ?? null}
          label={f.labelText ?? t(f.label)}
          textarea={f.textarea}
          required={f.required}
          placeholderAr={f.placeholderText?.ar}
          placeholderEn={f.placeholderText?.en}
        />
      );
    case "text":
      return (
        <Field label={t(f.label)} hint={f.hint ? t(f.hint) : undefined}>
          <Input name={name} type={f.type ?? "text"} defaultValue={(value as string) ?? ""} dir={f.dir} placeholder={f.placeholder} required={f.required} />
        </Field>
      );
    case "number":
      return (
        <Field label={t(f.label)} hint={f.hint ? t(f.hint) : undefined}>
          <Input name={name} type="number" min={f.min} max={f.max} defaultValue={value == null ? "" : String(value)} dir="ltr" className="max-w-[140px]" />
        </Field>
      );
    case "select":
      return (
        <Field label={t(f.label)}>
          <Select name={name} defaultValue={(value as string) ?? ""}>
            <option value="">{t("select")}</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      );
    case "upload":
      return (
        <Field label={t(f.label)} hint={f.hint ? t(f.hint) : undefined}>
          <Uploader
            name={name}
            siteId={siteId}
            value={(value as string) ?? ""}
            kind={f.media ?? "image"}
            accept={f.media === "video" ? "video/*" : "image/*"}
            label={t("upload")}
            uploadingLabel={t("uploading")}
            removeLabel={t("remove")}
          />
        </Field>
      );
  }
}

/** Flat fields of a section. */
export function FlatFields({ spec, content, t, siteId }: { spec: SectionSpec; content: unknown; t: T; siteId: string }) {
  if (!spec.fields.length) return null;
  return (
    <div className="grid gap-4">
      {spec.fields.map((f) => (
        <FieldInput key={f.key} f={f} name={f.key} value={getPath(content, f.key)} t={t} siteId={siteId} />
      ))}
    </div>
  );
}

const rowBtn = "inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold disabled:opacity-40 sm:min-h-8";

/**
 * Editable list rows. Each row has hidden id, move buttons and a confirmed delete that submit the whole
 * form with an `op` value (and skip HTML validation so reordering never depends on other rows);
 * a trailing "new row" block appends an item when filled.
 */
export function ListEditor({ spec, content, t, siteId }: { spec: SectionSpec; content: unknown; t: T; siteId: string }) {
  const list = spec.list;
  if (!list) return null;
  const rows = ((getPath(content, list.path) as unknown[]) ?? []) as Array<Record<string, unknown> | LText>;
  const simple = list.primaryKey === "";
  return (
    <div className="grid gap-4">
      <input type="hidden" name="rows.count" value={rows.length} />
      {rows.length === 0 && <p className="text-sm text-slate-500">{t("no_items")}</p>}
      {rows.map((row, i) => {
        const prefix = `rows.${i}`;
        const id = simple ? `${list.idPrefix}-${i}` : String((row as Record<string, unknown>).id ?? `${list.idPrefix}-${i}`);
        return (
          <div key={id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <input type="hidden" name={`${prefix}.id`} value={id} />
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-xs font-black text-slate-500">#{i + 1}</span>
              <div className="flex items-center gap-2">
                <button type="submit" name="op" value={`move:${i}:up`} disabled={i === 0} formNoValidate className={rowBtn} aria-label={t("move_up")}>
                  ↑ {t("move_up")}
                </button>
                <button type="submit" name="op" value={`move:${i}:down`} disabled={i === rows.length - 1} formNoValidate className={rowBtn} aria-label={t("move_down")}>
                  ↓ {t("move_down")}
                </button>
                <ConfirmButton message={t("confirm_delete_row")} name="op" value={`delete:${i}`} className="ms-2 min-h-10 sm:min-h-8">
                  {t("delete")}
                </ConfirmButton>
              </div>
            </div>
            <div className="grid gap-3">
              {simple ? (
                <BilingualInput name={prefix} value={row as LText} />
              ) : (
                list.fields.map((f) => <FieldInput key={f.key} f={f} name={`${prefix}.${f.key}`} value={(row as Record<string, unknown>)[f.key]} t={t} siteId={siteId} />)
              )}
            </div>
          </div>
        );
      })}
      <div className="rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/40 p-4">
        <div className="mb-3 text-sm font-black text-emerald-800">+ {t("add_item")}</div>
        <div className="grid gap-3">
          {simple
            ? <BilingualInput name="rows.new" value={null} />
            : list.fields.map((f) => <FieldInput key={f.key} f={f.kind === "ltext" ? { ...f, required: false } : f} name={`rows.new.${f.key}`} value={undefined} t={t} siteId={siteId} />)}
        </div>
      </div>
    </div>
  );
}
