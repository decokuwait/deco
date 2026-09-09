import { q, one, json, parseJson } from "./client";
import type { EventKey, PixelConfig, Platform } from "@/lib/types";

interface Row {
  id: string;
  site_id: string;
  platform: Platform;
  pixel_id: string;
  access_token: string | null;
  extra: unknown;
  test_event_code: string | null;
  active: boolean;
  event_map: unknown;
}

function map(r: Row): PixelConfig {
  return {
    id: r.id,
    siteId: r.site_id,
    platform: r.platform,
    pixelId: r.pixel_id,
    accessToken: r.access_token,
    extra: parseJson(r.extra, {}),
    testEventCode: r.test_event_code,
    active: !!r.active,
    eventMap: parseJson<Partial<Record<EventKey, string>>>(r.event_map, {}),
  };
}

export async function listPixels(siteId: string): Promise<PixelConfig[]> {
  const rows = await q<Row>(`select * from pixels where site_id = $1 order by platform`, [siteId]);
  return rows.map(map);
}

export async function getActivePixels(siteId: string): Promise<PixelConfig[]> {
  const rows = await q<Row>(`select * from pixels where site_id = $1 and active = true and pixel_id <> '' order by platform`, [siteId]);
  return rows.map(map);
}

export async function getPixel(siteId: string, platform: Platform): Promise<PixelConfig | null> {
  const r = await one<Row>(`select * from pixels where site_id = $1 and platform = $2`, [siteId, platform]);
  return r ? map(r) : null;
}

export async function upsertPixel(
  siteId: string,
  platform: Platform,
  patch: Partial<{
    pixelId: string;
    accessToken: string | null;
    extra: Record<string, unknown>;
    testEventCode: string | null;
    active: boolean;
    eventMap: Partial<Record<EventKey, string>>;
  }>,
): Promise<PixelConfig> {
  const existing = await getPixel(siteId, platform);
  const merged = {
    pixelId: patch.pixelId ?? existing?.pixelId ?? "",
    accessToken: patch.accessToken === undefined ? (existing?.accessToken ?? null) : patch.accessToken,
    extra: patch.extra ?? existing?.extra ?? {},
    testEventCode: patch.testEventCode === undefined ? (existing?.testEventCode ?? null) : patch.testEventCode,
    active: patch.active ?? existing?.active ?? false,
    eventMap: patch.eventMap ?? existing?.eventMap ?? {},
  };
  const r = await one<Row>(
    `insert into pixels (site_id, platform, pixel_id, access_token, extra, test_event_code, active, event_map)
     values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8::jsonb)
     on conflict (site_id, platform) do update set
       pixel_id = excluded.pixel_id, access_token = excluded.access_token, extra = excluded.extra,
       test_event_code = excluded.test_event_code, active = excluded.active, event_map = excluded.event_map, updated_at = now()
     returning *`,
    [siteId, platform, merged.pixelId, merged.accessToken, json(merged.extra), merged.testEventCode, merged.active, json(merged.eventMap)],
  );
  return map(r!);
}

export async function deletePixel(siteId: string, platform: Platform) {
  await q(`delete from pixels where site_id = $1 and platform = $2`, [siteId, platform]);
}
