import type { SourcePlatform } from "@/lib/types";

export interface Attribution {
  sourcePlatform: SourcePlatform;
  utm: Record<string, string>;
  clickIds: Record<string, string>;
}

const CLICK_ID_PARAMS: Record<string, SourcePlatform> = {
  fbclid: "meta",
  ttclid: "tiktok",
  sccid: "snapchat",
  sc_click_id: "snapchat",
  gclid: "google",
  gbraid: "google",
  wbraid: "google",
  dclid: "google",
  twclid: "x",
};

const UTM_SOURCE_MAP: Array<[RegExp, SourcePlatform]> = [
  [/^(fb|facebook|ig|instagram|meta|messenger|fbig)$/i, "meta"],
  [/^(tiktok|tt)$/i, "tiktok"],
  [/^(snap|snapchat|sc)$/i, "snapchat"],
  [/^(google|adwords|googleads|youtube|yt|gads)$/i, "google"],
  [/^(x|twitter|tw|x\.com|twitter\.com)$/i, "x"],
];

const REFERRER_MAP: Array<[RegExp, SourcePlatform]> = [
  [/(^|\.)(facebook\.com|fb\.com|instagram\.com|messenger\.com|fb\.me)$/i, "meta"],
  [/(^|\.)(tiktok\.com|tiktokv\.com)$/i, "tiktok"],
  [/(^|\.)(snapchat\.com|snap\.com|sc-cdn\.net)$/i, "snapchat"],
  [/(^|\.)(google\.[a-z.]+|googleadservices\.com|doubleclick\.net|youtube\.com|youtu\.be)$/i, "google"],
  [/(^|\.)(twitter\.com|x\.com|t\.co)$/i, "x"],
];

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Detect where a visitor came from using (in priority order):
 * 1. platform click ids in the landing URL (fbclid, ttclid, sc_click_id, gclid...)
 * 2. utm_source
 * 3. HTTP referrer domain
 * Falls back to "direct" (no referrer / same host) or "other".
 */
export function detectAttribution(landingUrl: string | null | undefined, referrer: string | null | undefined): Attribution {
  const utm: Record<string, string> = {};
  const clickIds: Record<string, string> = {};
  let source: SourcePlatform | null = null;

  let params: URLSearchParams | null = null;
  try {
    if (landingUrl) params = new URL(landingUrl).searchParams;
  } catch {
    params = null;
  }
  if (params) {
    for (const [k, v] of params.entries()) {
      const key = k.toLowerCase();
      if (key.startsWith("utm_")) utm[key] = v.slice(0, 200);
      const plat = CLICK_ID_PARAMS[key];
      if (plat && v) {
        clickIds[key] = v.slice(0, 500);
        source = source ?? plat;
      }
    }
  }

  if (!source && utm.utm_source) {
    for (const [re, plat] of UTM_SOURCE_MAP) {
      if (re.test(utm.utm_source)) {
        source = plat;
        break;
      }
    }
  }

  const refHost = hostOf(referrer);
  if (!source && refHost) {
    for (const [re, plat] of REFERRER_MAP) {
      if (re.test(refHost)) {
        source = plat;
        break;
      }
    }
  }

  if (!source) {
    const landingHost = hostOf(landingUrl);
    if (!refHost || (landingHost && refHost === landingHost)) source = "direct";
    else source = "other";
  }
  return { sourcePlatform: source, utm, clickIds };
}

/** Build the Meta `fbc` value from a fbclid when the browser did not set the _fbc cookie. */
export function fbcFromClickId(fbclid: string | undefined, nowMs = Date.now()): string | undefined {
  if (!fbclid) return undefined;
  return `fb.1.${nowMs}.${fbclid}`;
}
