import type { LText } from "@/lib/types";
import { BilingualInput, Field, Input, Select } from "@/components/admin/ui";
import { Uploader } from "@/components/admin/Uploader";
import { ReorderRows } from "./ReorderRows";
import type { FieldSpec, SectionSpec } from "../content/_lib/spec";
import { getPath } from "../content/_lib/spec";
import type { T } from "../_lib/guard";
import { uploadErrorLabels } from "@/lib/i18n/admin";

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
            errorLabels={uploadErrorLabels(t)}
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

/**
 * Editable list rows: ordering and removal happen on the device (see ReorderRows) and travel with the
 * one save at the bottom of the page; a trailing "new row" block appends an item when filled.
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
      {rows.length > 0 && (
        <ReorderRows count={rows.length} labels={{ up: t("move_up"), down: t("move_down"), remove: t("delete"), undo: t("undo"), willBeDeleted: t("will_be_deleted") }}>
          {rows.map((row, i) => {
            const prefix = `rows.${i}`;
            const id = simple ? `${list.idPrefix}-${i}` : String((row as Record<string, unknown>).id ?? `${list.idPrefix}-${i}`);
            return (
              <div key={id} className="grid gap-3">
                <input type="hidden" name={`${prefix}.id`} value={id} />
                {simple ? (
                  <BilingualInput name={prefix} value={row as LText} />
                ) : (
                  list.fields.map((f) => <FieldInput key={f.key} f={f} name={`${prefix}.${f.key}`} value={(row as Record<string, unknown>)[f.key]} t={t} siteId={siteId} />)
                )}
              </div>
            );
          })}
        </ReorderRows>
      )}
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
