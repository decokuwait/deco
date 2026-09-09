import { requireSiteAdmin, sp1, type SearchParams } from "../_lib/guard";
import { Panel } from "../_components/Panel";
import { Card, PageHeader, Flash, Field, Input, Toggle, Badge } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { listPixels } from "@/lib/db/pixels";
import { PLATFORMS, PLATFORM_LABELS, type PixelConfig, type Platform } from "@/lib/types";
import { DEFAULT_EVENT_MAP, EVENT_KEYS, EVENT_KEY_LABELS } from "@/lib/marketing/mapping";
import { savePixel, saveSignalMode, sendTestEvent } from "./actions";
import type { AdminUiKey } from "@/lib/i18n/admin";

const ID_LABEL: Record<Platform, AdminUiKey> = { meta: "meta_pixel_id", tiktok: "tiktok_pixel_code", snapchat: "snap_pixel_id", google: "ga4_measurement_id", x: "x_pixel_id" };
const TOKEN_LABEL: Record<Platform, AdminUiKey> = { meta: "meta_token", tiktok: "tiktok_token", snapchat: "snap_token", google: "api_secret", x: "x_access_token" };

export default async function MarketingPage({ params, searchParams }: { params: Promise<{ host: string }>; searchParams: SearchParams }) {
  const { host } = await params;
  const sp = await searchParams;
  const ctx = await requireSiteAdmin(host);
  const { t, site, locale } = ctx;
  const pixels = await listPixels(site.id);
  const byPlatform = new Map(pixels.map((p) => [p.platform, p]));
  const tested = sp1(sp.tested);
  const testOk = sp1(sp.ok) === "1";
  const testMsg = sp1(sp.msg);
  const modeAction = saveSignalMode.bind(null, host);

  return (
    <Panel ctx={ctx} active="marketing">
      <PageHeader title={t("marketing")} subtitle={t("marketing_hint")} />
      <Flash saved={sp1(sp.saved)} error={sp1(sp.error)} savedText={t("saved")} errorText={t("error")} />

      <Card title={t("send_mode")} className="mb-5">
        <form action={modeAction} className="grid gap-3">
          {(["smart", "all"] as const).map((m) => (
            <label key={m} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50">
              <input type="radio" name="signalMode" value={m} defaultChecked={site.content.settings.signalMode === m} className="mt-1 h-4 w-4" />
              <span className="text-sm font-bold text-slate-800">{m === "smart" ? t("send_mode_smart") : t("send_mode_all")}</span>
            </label>
          ))}
          <div>
            <SubmitButton pendingText={t("saving")}>{t("save")}</SubmitButton>
          </div>
        </form>
      </Card>

      <div className="grid gap-5">
        {PLATFORMS.map((platform) => {
          const p: PixelConfig | undefined = byPlatform.get(platform);
          const save = savePixel.bind(null, host, platform);
          const test = sendTestEvent.bind(null, host, platform);
          const hasSecret = platform === "google" ? !!p?.extra?.apiSecret : !!p?.accessToken;
          return (
            <Card
              key={platform}
              title={
                <span id={platform} className="flex items-center gap-2 scroll-mt-20">
                  {PLATFORM_LABELS[platform]}
                  <Badge tone={p?.active && p.pixelId ? "green" : "slate"}>{p?.active && p.pixelId ? t("active") : t("inactive")}</Badge>
                </span>
              }
              actions={
                <form action={test}>
                  <SubmitButton variant="ghost" pendingText={t("sending")} className="text-xs">
                    {t("send_test")}
                  </SubmitButton>
                </form>
              }
            >
              {tested === platform && (
                <div className={`mb-4 rounded-xl border px-4 py-3 text-sm font-bold ${testOk ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
                  {testOk ? t("test_ok") : t("test_failed")}
                  {testMsg && (
                    <span className="mt-1 block break-all font-mono text-xs font-normal opacity-80" dir="ltr">
                      {testMsg === "pixel_not_configured" ? t("pixel_not_configured") : testMsg}
                    </span>
                  )}
                </div>
              )}
              <form action={save} className="grid gap-4">
                <Toggle name="active" defaultChecked={p?.active ?? false} label={t("active")} hint={t("test_hint")} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t(ID_LABEL[platform])}>
                    <Input name="pixelId" defaultValue={p?.pixelId ?? ""} dir="ltr" placeholder={platform === "google" ? "G-XXXXXXXXXX" : ""} />
                  </Field>
                  <Field label={t(TOKEN_LABEL[platform])} hint={hasSecret ? `${t("token_hint")} ✓` : t("token_hint")}>
                    <Input name={platform === "google" ? "apiSecret" : "accessToken"} type="password" autoComplete="off" dir="ltr" placeholder={hasSecret ? "••••••••" : ""} />
                  </Field>
                  <Field label={t("test_event_code")} hint={t("optional")}>
                    <Input name="testEventCode" defaultValue={p?.testEventCode ?? ""} dir="ltr" />
                  </Field>
                  {platform === "google" && (
                    <Field label={t("ads_id")} hint={t("optional")}>
                      <Input name="adsId" defaultValue={p?.extra?.adsId ?? ""} dir="ltr" placeholder="AW-XXXXXXXXX" />
                    </Field>
                  )}
                  {platform === "x" && (
                    <>
                      <Field label={t("x_consumer_key")}>
                        <Input name="consumerKey" defaultValue={(p?.extra as { consumerKey?: string } | undefined)?.consumerKey ?? ""} dir="ltr" autoComplete="off" />
                      </Field>
                      <Field label={t("x_consumer_secret")} hint={(p?.extra as { consumerSecret?: string } | undefined)?.consumerSecret ? `${t("token_hint")} ✓` : t("token_hint")}>
                        <Input name="consumerSecret" type="password" dir="ltr" autoComplete="off" placeholder={(p?.extra as { consumerSecret?: string } | undefined)?.consumerSecret ? "••••••••" : ""} />
                      </Field>
                      <Field label={t("x_token_secret")} hint={(p?.extra as { tokenSecret?: string } | undefined)?.tokenSecret ? `${t("token_hint")} ✓` : t("token_hint")}>
                        <Input name="tokenSecret" type="password" dir="ltr" autoComplete="off" placeholder={(p?.extra as { tokenSecret?: string } | undefined)?.tokenSecret ? "••••••••" : ""} />
                      </Field>
                      <p className="text-xs text-slate-500 sm:col-span-2">{t("x_event_hint")}</p>
                    </>
                  )}
                  {hasSecret && (
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                      <input type="checkbox" name="clearToken" className="h-4 w-4" />
                      {t("remove")} — {t(TOKEN_LABEL[platform])}
                    </label>
                  )}
                </div>
                <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <summary className="cursor-pointer text-sm font-bold text-slate-800">{t("event_map")}</summary>
                  <p className="mt-1 text-xs text-slate-500">{t("event_map_hint")}</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {EVENT_KEYS.map((k) => (
                      <Field key={k} label={EVENT_KEY_LABELS[k][locale]}>
                        <Input name={`event.${k}`} defaultValue={p?.eventMap?.[k] ?? ""} placeholder={DEFAULT_EVENT_MAP[platform][k]} dir="ltr" />
                      </Field>
                    ))}
                  </div>
                </details>
                <div>
                  <SubmitButton pendingText={t("saving")}>{t("save")}</SubmitButton>
                </div>
              </form>
            </Card>
          );
        })}
      </div>
    </Panel>
  );
}
