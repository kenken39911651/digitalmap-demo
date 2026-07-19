"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateOrganizationId, getMapForEditing } from "@/lib/data";
import { generateSlug } from "@/lib/slug";
import { getTemplate } from "@/lib/templates";
import { normalizePinTransitStops } from "@/lib/gtfs/normalize";
import type { EventType, MapCategory, Pin, PublishedSnapshot } from "@/lib/types";

// 中心地点はウィザードStep3で設定されるまでの仮の値（東京駅）。
const DEFAULT_CENTER = { lat: 35.681236, lng: 139.767125 };

interface CreateMapInput {
  eventType: EventType;
  title: string;
  description?: string;
  eventDateStart?: string;
  eventDateEnd?: string;
}

export async function createMap(input: CreateMapInput): Promise<{ mapId: string; slug: string }> {
  const orgId = await getOrCreateOrganizationId();
  const supabase = await createClient();

  let slug = generateSlug();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing } = await supabase
      .from("event_maps")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!existing) break;
    slug = generateSlug();
  }

  const { data: map, error } = await supabase
    .from("event_maps")
    .insert({
      organization_id: orgId,
      slug,
      title: input.title,
      event_type: input.eventType,
      description: input.description || null,
      center_lat: DEFAULT_CENTER.lat,
      center_lng: DEFAULT_CENTER.lng,
      event_date_start: input.eventDateStart || null,
      event_date_end: input.eventDateEnd || null,
    })
    .select("id")
    .single();

  if (error || !map) {
    throw new Error("マップの作成に失敗しました");
  }

  const template = getTemplate(input.eventType);
  const { error: catError } = await supabase.from("map_categories").insert(
    template.defaultCategories.map((c, i) => ({
      map_id: map.id,
      label: c.label,
      color: c.color,
      icon: c.icon,
      sort_order: i,
    }))
  );
  if (catError) {
    throw new Error("カテゴリの作成に失敗しました");
  }

  revalidatePath("/admin");
  return { mapId: map.id as string, slug };
}

interface UpdateMapCenterInput {
  mapId: string;
  centerLat: number;
  centerLng: number;
  basemap: "std" | "photo";
  brandColor: string;
  defaultZoom?: number;
}

export async function updateMapCenter(input: UpdateMapCenterInput): Promise<void> {
  const orgId = await getOrCreateOrganizationId();
  const supabase = await createClient();

  const { error } = await supabase
    .from("event_maps")
    .update({
      center_lat: input.centerLat,
      center_lng: input.centerLng,
      basemap: input.basemap,
      brand_color: input.brandColor,
      ...(input.defaultZoom ? { default_zoom: input.defaultZoom } : {}),
    })
    .eq("id", input.mapId)
    .eq("organization_id", orgId);

  if (error) throw new Error("マップ設定の更新に失敗しました");
  revalidatePath(`/admin/maps/${input.mapId}`);
}

interface UpdateMapSettingsInput {
  mapId: string;
  title: string;
  description: string;
  eventDateStart: string;
  eventDateEnd: string;
  noticeText: string;
  hiddenScheduleVenues: string[];
}

export async function updateMapSettings(input: UpdateMapSettingsInput): Promise<void> {
  const orgId = await getOrCreateOrganizationId();
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_maps")
    .update({
      title: input.title.trim(),
      description: input.description.trim() || null,
      event_date_start: input.eventDateStart || null,
      event_date_end: input.eventDateEnd || null,
      notice_text: input.noticeText.trim() || null,
      hidden_schedule_venues: input.hiddenScheduleVenues,
    })
    .eq("id", input.mapId)
    .eq("organization_id", orgId);
  if (error) throw new Error("マップ設定の更新に失敗しました");
  revalidatePath("/admin");
  revalidatePath(`/admin/maps/${input.mapId}`);
}

// 公開マップ(/m/[slug])に出す内容のスナップショットを、その時点のライブデータ
// (event_maps/map_categories/pins)から組み立てる。publishMapと
// applyPublishedChangesの両方から使う共通処理。
async function buildSnapshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  mapId: string,
  orgId: string
): Promise<PublishedSnapshot> {
  const { data: map, error: mapError } = await supabase
    .from("event_maps")
    .select(
      "title, description, center_lat, center_lng, default_zoom, basemap, brand_color, notice_text, hidden_schedule_venues"
    )
    .eq("id", mapId)
    .eq("organization_id", orgId)
    .single();
  if (mapError || !map) throw new Error("マップが見つかりません");

  const [{ data: categories }, { data: pins }] = await Promise.all([
    supabase.from("map_categories").select("*").eq("map_id", mapId).order("sort_order"),
    supabase
      .from("pins")
      .select(
        "*, sessions:pin_sessions(*), transit_stop:pin_transit_stops(*, gtfs_stops:pin_transit_gtfs_stops(*, routes:pin_transit_gtfs_routes(route_uuid)))"
      )
      .eq("map_id", mapId)
      .neq("status", "hidden")
      .order("sort_order")
      .order("sort_order", { foreignTable: "pin_sessions" }),
  ]);

  return {
    map: map as PublishedSnapshot["map"],
    categories: (categories ?? []) as MapCategory[],
    pins: normalizePinTransitStops((pins ?? []) as Pin[]),
  };
}

export async function publishMap(mapId: string): Promise<void> {
  const orgId = await getOrCreateOrganizationId();
  const supabase = await createClient();
  const snapshot = await buildSnapshot(supabase, mapId, orgId);
  const { error } = await supabase
    .from("event_maps")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      published_snapshot: snapshot,
    })
    .eq("id", mapId)
    .eq("organization_id", orgId);
  if (error) throw new Error("公開に失敗しました");
  revalidatePath("/admin");
  revalidatePath(`/admin/maps/${mapId}`);
  revalidatePath(`/admin/maps/${mapId}/preview`);
}

// 公開済みマップの編集内容(ピン・カテゴリ・マップ設定)を、来場者向けページに
// 反映する。編集画面での保存は常にライブテーブルに即時反映されるが、それだけ
// では来場者向けページ(スナップショット参照)は変わらない。この操作で初めて
// 公開側に反映される。
export async function applyPublishedChanges(mapId: string): Promise<void> {
  const orgId = await getOrCreateOrganizationId();
  const supabase = await createClient();
  const snapshot = await buildSnapshot(supabase, mapId, orgId);
  const { error } = await supabase
    .from("event_maps")
    .update({ published_snapshot: snapshot })
    .eq("id", mapId)
    .eq("organization_id", orgId)
    .eq("status", "published");
  if (error) throw new Error("反映に失敗しました");
  revalidatePath("/admin");
  revalidatePath(`/admin/maps/${mapId}`);
  revalidatePath(`/admin/maps/${mapId}/preview`);
}

export async function unpublishMap(mapId: string): Promise<void> {
  const orgId = await getOrCreateOrganizationId();
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_maps")
    .update({ status: "draft" })
    .eq("id", mapId)
    .eq("organization_id", orgId);
  if (error) throw new Error("非公開化に失敗しました");
  revalidatePath("/admin");
  revalidatePath(`/admin/maps/${mapId}`);
}

export async function duplicateMap(mapId: string): Promise<{ mapId: string }> {
  const orgId = await getOrCreateOrganizationId();
  const source = await getMapForEditing(mapId);
  if (!source) throw new Error("複製元のマップが見つかりません");

  const supabase = await createClient();

  let slug = generateSlug();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing } = await supabase
      .from("event_maps")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!existing) break;
    slug = generateSlug();
  }

  const { data: newMap, error } = await supabase
    .from("event_maps")
    .insert({
      organization_id: orgId,
      slug,
      title: `${source.map.title}のコピー`,
      event_type: source.map.event_type,
      description: source.map.description,
      center_lat: source.map.center_lat,
      center_lng: source.map.center_lng,
      default_zoom: source.map.default_zoom,
      basemap: source.map.basemap,
      brand_color: source.map.brand_color,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !newMap) throw new Error("複製に失敗しました");

  const categoryIdMap = new Map<string, string>();
  for (const category of source.categories) {
    const { data: newCategory, error: catError } = await supabase
      .from("map_categories")
      .insert({
        map_id: newMap.id,
        label: category.label,
        color: category.color,
        icon: category.icon,
        sort_order: category.sort_order,
      })
      .select("id")
      .single();
    if (catError || !newCategory) throw new Error("カテゴリの複製に失敗しました");
    categoryIdMap.set(category.id, newCategory.id as string);
  }

  if (source.pins.length > 0) {
    const { error: pinError } = await supabase.from("pins").insert(
      source.pins.map((pin) => ({
        map_id: newMap.id,
        category_id: pin.category_id ? categoryIdMap.get(pin.category_id) ?? null : null,
        title: pin.title,
        emoji: pin.emoji,
        lat: pin.lat,
        lng: pin.lng,
        description: pin.description,
        place_note: pin.place_note,
        date: pin.date,
        time_label: pin.time_label,
        status: pin.status === "cancelled" ? "active" : pin.status,
        sort_order: pin.sort_order,
      }))
    );
    if (pinError) throw new Error("ピンの複製に失敗しました");
  }

  revalidatePath("/admin");
  return { mapId: newMap.id as string };
}
