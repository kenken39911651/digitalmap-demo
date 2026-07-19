import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import PublicMapView from "@/components/map/PublicMapView";
import type { EventMap, MapCategory, Pin } from "@/lib/types";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getPublishedMap(slug: string) {
  const supabase = await createClient();

  const { data: map } = await supabase
    .from("event_maps")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!map) return null;

  const [{ data: categories }, { data: pins }] = await Promise.all([
    supabase
      .from("map_categories")
      .select("*")
      .eq("map_id", map.id)
      .order("sort_order"),
    supabase
      .from("pins")
      .select("*, sessions:pin_sessions(*)")
      .eq("map_id", map.id)
      .neq("status", "hidden")
      .order("sort_order")
      .order("sort_order", { foreignTable: "pin_sessions" }),
  ]);

  return {
    map: map as EventMap,
    categories: (categories ?? []) as MapCategory[],
    pins: (pins ?? []) as Pin[],
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
      </header>
      <PublicMapView map={map} categories={categories} pins={pins} />
    </div>
  );
}
