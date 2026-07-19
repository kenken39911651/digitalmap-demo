"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateOrganizationId } from "@/lib/data";
import { importFeedStops } from "@/lib/gtfs/import";
import type { GtfsStop } from "@/lib/types";

interface RegisterGtfsFeedInput {
  name: string;
  sourceUrl: string;
}

export async function registerGtfsFeed(input: RegisterGtfsFeedInput): Promise<{ feedId: string }> {
  const orgId = await getOrCreateOrganizationId();
  const supabase = await createClient();

  const { data: feed, error } = await supabase
    .from("gtfs_feeds")
    .insert({ organization_id: orgId, name: input.name, source_url: input.sourceUrl })
    .select("id")
    .single();
  if (error || !feed) throw new Error("フィードの登録に失敗しました");

  const feedId = feed.id as string;
  try {
    await importFeedStops(supabase, feedId, orgId, input.sourceUrl);
    await supabase
      .from("gtfs_feeds")
      .update({ status: "stops_ready", last_imported_at: new Date().toISOString(), last_error: null })
      .eq("id", feedId);
  } catch (e) {
    await supabase
      .from("gtfs_feeds")
      .update({ status: "error", last_error: e instanceof Error ? e.message : "取り込みに失敗しました" })
      .eq("id", feedId);
    throw e;
  }

  revalidatePath("/admin/transit-feeds");
  return { feedId };
}

export async function refreshGtfsFeedStops(feedId: string): Promise<void> {
  const orgId = await getOrCreateOrganizationId();
  const supabase = await createClient();

  const { data: feed } = await supabase
    .from("gtfs_feeds")
    .select("id, source_url")
    .eq("id", feedId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!feed) throw new Error("フィードが見つかりません");

  try {
    await importFeedStops(supabase, feedId, orgId, feed.source_url as string);
    await supabase
      .from("gtfs_feeds")
      .update({ status: "stops_ready", last_imported_at: new Date().toISOString(), last_error: null })
      .eq("id", feedId);
  } catch (e) {
    await supabase
      .from("gtfs_feeds")
      .update({ status: "error", last_error: e instanceof Error ? e.message : "取り込みに失敗しました" })
      .eq("id", feedId);
    throw e;
  }

  revalidatePath("/admin/transit-feeds");
}

export async function deleteGtfsFeed(feedId: string): Promise<void> {
  const orgId = await getOrCreateOrganizationId();
  const supabase = await createClient();
  const { error } = await supabase
    .from("gtfs_feeds")
    .delete()
    .eq("id", feedId)
    .eq("organization_id", orgId);
  if (error) throw new Error("フィードの削除に失敗しました");
  revalidatePath("/admin/transit-feeds");
}

export async function searchGtfsStops(feedId: string, query: string): Promise<GtfsStop[]> {
  await getOrCreateOrganizationId();
  const supabase = await createClient();
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { data, error } = await supabase
    .from("gtfs_stops")
    .select("id, feed_id, stop_id, stop_name, stop_lat, stop_lon")
    .eq("feed_id", feedId)
    .ilike("stop_name", `%${trimmed}%`)
    .limit(20);
  if (error) throw new Error("停留所の検索に失敗しました");
  return (data ?? []) as GtfsStop[];
}
