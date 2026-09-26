import { requireSiteAdmin, sp1, type SearchParams } from "../_lib/guard";
import { Panel } from "../_components/Panel";
import { Card, PageHeader, Flash, Field, Input, Select, Toggle, Badge, translateCode } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { listPixels } from "@/lib/db/pixels";
import { CONSENT_MODES, PLATFORMS, PLATFORM_LABELS, SIGNAL_MODES, type ConsentMode, type PixelConfig, type Platform, type SignalMode } from "@/lib/types";
import { DEFAULT_EVENT_MAP, EVENT_KEYS, EVENT_KEY_LABELS } from "@/lib/marketing/mapping";
import { serverReady } from "@/lib/marketing/dispatch";
import { signalHealth } from "@/lib/marketing/store";
import { PLATFORM_SHORT } from "../_components/badges";
import { fmtDateTime } from "../_lib/format";
import { savePixel, saveSignalMode, sendTestEvent } from "./actions";
import type { AdminUiKey } from "@/lib/i18n/admin";

// Stage marking / test events fan out to the ad platforms (8 s timeout each, in parallel): allow more than the 10 s default.
export const maxDuration = 30;

const MODE_LABEL: Record<SignalMode, AdminUiKey> = { source: "send_mode_source", primary: "send_mode_primary", all: "send_mode_all" };
const MODE_HINT: Record<SignalMode, AdminUiKey> = { source: "send_mode_source_hint", primary: "send_mode_primary_hint", all: "send_mode_all_hint" };
const CONSENT_LABEL: Record<ConsentMode, AdminUiKey> = { off: "consent_mode_off", notice: "consent_mode_notice", explicit: "consent_mode_explicit" };

const ID_LABEL: Record<Platform, AdminUiKey> = { meta: "meta_pixel_id", tiktok: "tiktok_pixel_code", snapchat: "snap_pixel_id", google: "ga4_measurement_id", x: "x_pixel_id" };
const TOKEN_LABEL: Record<Platform, AdminUiKey> = { meta: "meta_token", tiktok: "tiktok_token", snapchat: "snap_token", google: "api_secret", x: "x_access_token" };

export default async function MarketingPage({ params, searchParams }: { params: Promise<{ host: string }>; searchParams: SearchParams }) {
  const { host } = await params;
  const sp = await searchParams;
  const ctx = await requireSiteAdmin(host);
  const { t, site, locale } = ctx;
  const [pixels, health] = await Promise.all([listPixels(site.id), signalHealth(site.id)]);
  const byPlatform = new Map(pixels.map((p) => [p.platform, p]));
  const signalMode = site.content.settings.signalMode;
  // Health is only meaningful for a connection the owner actually made; an untouched platform would
  // otherwise sit there reading "never" forever and train them to ignore the card.
  const activePlatforms = PLATFORMS.filter((p) => byPlatform.get(p)?.active || health[p]);
  const tested = sp1(sp.tested);
  const testOk = sp1(sp.ok) === "1";
  // The test result is a code, not the provider's text: translate what we know, say nothing otherwise
  // (the raw provider response is in the function log for whoever operates the platform).
  const testMsg = sp1(sp.msg);
  const testDetail = testMsg === "pixel_not_configured" ? t("pixel_not_configured") : translateCode(locale, testMsg);
  const modeAction = saveSignalMode.bind(null, host);

  return (
    <Panel ctx={ctx} active="marketing">
      <PageHeader title={t("marketing")} subtitle={t("marketing_hint")} />
      <Flash saved={sp1(sp.saved)} error={sp1(sp.error)} savedText={t("saved")} errorText={t("error")} locale={locale} />

      <Card title={t("send_mode")} className="mb-5">
        <form action={modeAction} className="grid gap-3">
          {SIGNAL_MODES.map((m) => (
            <label key={m} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50">
              <input type="radio" name="signalMode" value={m} defaultChecked={signalMode === m} className="mt-1 h-4 w-4" />
              <span>
                <span className="block text-sm font-bold text-slate-800">{t(MODE_LABEL[m])}</span>
                <span className={`mt-0.5 block text-xs ${m === "all" ? "font-bold text-amber-700" : "text-slate-500"}`}>{t(MODE_HINT[m])}</span>
              </span>
            </label>
          ))}
          <Field label={t("primary_platform")} hint={t("primary_platform_hint")}>
            <Select name="primaryPlatform" defaultValue={site.content.settings.primaryPlatform ?? ""}>
              <option value="">{t("select")}</option>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {PLATFORM_LABELS[p]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("consent_mode")} hint={t("consent_mode_hint")}>
            <Select name="consentMode" defaultValue={site.content.settings.consentMode}>
              {CONSENT_MODES.map((c) => (
                <option key={c} value={c}>
                  {t(CONSENT_LABEL[c])}
                </option>
              ))}
            </Select>
          </Field>
          <div>
            <SubmitButton pendingText={t("saving")}>{t("save")}</SubmitButton>
          </div>
        </form>
      </Card>

      {/* Signal health: the difference between a feature a contractor trusts and one they quietly stop
          believing in. An expired token used to be invisible — console.error'd into a JSON column. */}
      <Card title={t("signal_health")} className="mb-5">
        {activePlatforms.length === 0 ? (
          <p className="text-sm text-slate-500">{t("no_signal_data")}</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {activePlatforms.map((platform) => {
              const h = health[platform];
              const alarming = h?.lastFailCode === "auth" || h?.lastFailCode === "api_version";
              return (
                <li key={platform} className={`rounded-xl border p-3 text-xs ${alarming ? "border-red-300 bg-red-50" : "border-slate-200 bg-slate-50"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-800">{PLATFORM_SHORT[platform]}</span>
                    {alarming && <Badge tone="red">{t("needs_attention")}</Badge>}
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                    <dt className="text-slate-400">{t("last_success")}</dt>
                    <dd className="font-bold text-slate-700">{h?.lastOkAt ? fmtDateTime(h.lastOkAt, locale) : t("never")}</dd>
                    <dt className="text-slate-400">{t("failures_7d")}</dt>
                    <dd className="font-bold tabular-nums text-slate-700">{h?.failures7d ?? 0}</dd>
                    {h?.lastFailAt && (
                      <>
                        <dt className="text-slate-400">{t("last_failure")}</dt>
                        <dd className="font-bold text-slate-700">
                          {fmtDateTime(h.lastFailAt, locale)}
                          {h.lastFailCode && <span className="block font-normal text-slate-500">{translateCode(locale, h.lastFailCode) ?? h.lastFailCode}</span>}
                        </dd>
                      </>
                    )}
                    {!!h?.queued && (
                      <>
                        <dt className="text-slate-400">{t("queued_retries")}</dt>
                        <dd className="font-bold tabular-nums text-amber-700">{h.queued}</dd>
                      </>
                    )}
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
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
                  {p?.active && p.pixelId && !serverReady(p) && <Badge tone="amber">{t("server_not_ready")}</Badge>}
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
                  {testDetail && (
                    <span className="mt-1 block text-xs font-normal opacity-80">{testDetail}</span>
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
                  <Field label={t("test_event_code")} hint={t("test_code_hint")}>
                    <Input name="testEventCode" defaultValue={p?.testEventCode ?? ""} dir="ltr" />
                  </Field>
                  {platform === "google" && (
                    <>
                      <Field label={t("ads_id")} hint={t("optional")}>
                        <Input name="adsId" defaultValue={p?.extra?.adsId ?? ""} dir="ltr" placeholder="AW-XXXXXXXXX" />
                      </Field>
                      <Field label={t("ads_label")} hint={t("ads_label_hint")}>
                        <Input name="adsLabel" defaultValue={p?.extra?.adsLabel ?? ""} dir="ltr" placeholder="AbCdEfGhIj" />
                      </Field>
                    </>
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
