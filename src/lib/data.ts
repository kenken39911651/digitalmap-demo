import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { EventMap, GtfsFeed, MapCategory, Pin } from "@/lib/types";
import { normalizePinTransitStops } from "@/lib/gtfs/normalize";

export const requireUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
});

// Every organizer gets exactly one auto-provisioned organization on first
// login (schema supports many-per-user for future team features, unused in v1).
export const getOrCreateOrganizationId = cache(async (): Promise<string> => {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  if (memberships && memberships.length > 0) {
    return memberships[0].organization_id as string;
  }

  const orgName = user.email ? `${user.email.split("@")[0]}のイベント` : "マイイベント";
  const { data: newOrgId, error } = await supabase.rpc("create_organization_for_user", {
    org_name: orgName,
  });

  if (error || !newOrgId) {
    throw new Error("組織の作成に失敗しました");
  }

  return newOrgId as string;
});

export async function getOrganizationMaps(): Promise<EventMap[]> {
  const orgId = await getOrCreateOrganizationId();
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_maps")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  return (data ?? []) as EventMap[];
}

export async function getMapForEditing(mapId: string): Promise<{
  map: EventMap;
  categories: MapCategory[];
  pins: Pin[];
} | null> {
  const orgId = await getOrCreateOrganizationId();
  const supabase = await createClient();

  const { data: map } = await supabase
    .from("event_maps")
    .select("*")
    .eq("id", mapId)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (!map) return null;

  const [{ data: categories }, { data: pins }] = await Promise.all([
    supabase.from("map_categories").select("*").eq("map_id", mapId).order("sort_order"),
    supabase
      .from("pins")
      .select(
        "*, sessions:pin_sessions(*), transit_stop:pin_transit_stops(*, gtfs_stops:pin_transit_gtfs_stops(*, gtfs_stop:gtfs_stops(stop_name), routes:pin_transit_gtfs_routes(route_uuid)))"
      )
      .eq("map_id", mapId)
      .order("sort_order")
      .order("sort_order", { foreignTable: "pin_sessions" }),
  ]);

  return {
    map: map as EventMap,
    categories: (categories ?? []) as MapCategory[],
    pins: normalizePinTransitStops((pins ?? []) as Pin[]),
  };
}

export async function getOrganizationGtfsFeeds(): Promise<GtfsFeed[]> {
  const orgId = await getOrCreateOrganizationId();
  const supabase = await createClient();
  const { data } = await supabase
    .from("gtfs_feeds")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  return (data ?? []) as GtfsFeed[];
}
