"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateOrganizationId, getMapForEditing } from "@/lib/data";
import { generateSlug } from "@/lib/slug";
import { getTemplate } from "@/lib/templates";
import type { EventType } from "@/lib/types";

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
    })
    .eq("id", input.mapId)
    .eq("organization_id", orgId);
  if (error) throw new Error("マップ設定の更新に失敗しました");
  revalidatePath("/admin");
  revalidatePath(`/admin/maps/${input.mapId}`);
}

export async function publishMap(mapId: string): Promise<void> {
  const orgId = await getOrCreateOrganizationId();
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_maps")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", mapId)
    .eq("organization_id", orgId);
  if (error) throw new Error("公開に失敗しました");
  revalidatePath("/admin");
  revalidatePath(`/admin/maps/${mapId}`);
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
