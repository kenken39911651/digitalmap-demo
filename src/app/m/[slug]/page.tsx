import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import PublicMapView from "@/components/map/PublicMapView";
import ThemeToggle from "@/components/ThemeToggle";
import { normalizePinTransitStops } from "@/lib/gtfs/normalize";
import type { EventMap, MapCategory, Pin, PublishedSnapshot } from "@/lib/types";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getPublishedMap(slug: string) {
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("event_maps")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!row) return null;

  // 「変更を公開に反映」済みのマップはスナップショットを表示する(編集中の
  // 内容が来場者に勝手に見えないようにするため)。
  if (row.published_snapshot) {
    const snapshot = row.published_snapshot as PublishedSnapshot;
    return {
      map: snapshot.map,
      categories: snapshot.categories,
      pins: snapshot.pins,
    };
  }

  // スナップショット未生成(この機能の導入前に公開されたマップ)は、従来通り
  // ライブデータを返す。次に「公開する」または「変更を反映」を押した時点で
  // スナップショットが作られ、以後はそちらが使われるようになる。
  const [{ data: categories }, { data: pins }] = await Promise.all([
    supabase
      .from("map_categories")
      .select("*")
      .eq("map_id", row.id)
      .order("sort_order"),
    supabase
      .from("pins")
      .select("*, sessions:pin_sessions(*), transit_stop:pin_transit_stops(*)")
      .eq("map_id", row.id)
      .neq("status", "hidden")
      .order("sort_order")
      .order("sort_order", { foreignTable: "pin_sessions" }),
  ]);

  return {
    map: row as EventMap,
    categories: (categories ?? []) as MapCategory[],
    pins: normalizePinTransitStops((pins ?? []) as Pin[]),
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPublishedMap(slug);
  if (!result) return { title: "マップが見つかりません" };

  const { map } = result;
  return {
    title: `${map.title} | デジタルマップ`,
    description: map.description ?? `${map.title}のイベントマップ`,
    openGraph: {
      title: map.title,
      description: map.description ?? undefined,
      type: "website",
    },
  };
}

export default async function PublicMapPage({ params }: PageProps) {
  const { slug } = await params;
  const result = await getPublishedMap(slug);
  if (!result) notFound();

  const { map, categories, pins } = result;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="map-header" style={{ ["--brand-color" as string]: map.brand_color }}>
        <span className="map-header-accent" aria-hidden="true" />
        <h1 className="map-header-title">{map.title}</h1>
        <ThemeToggle />
      </header>
      <PublicMapView map={map} categories={categories} pins={pins} />
    </div>
  );
}
