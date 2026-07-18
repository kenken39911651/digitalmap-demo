import { notFound } from "next/navigation";
import { getMapForEditing } from "@/lib/data";
import { getSiteUrl } from "@/lib/siteUrl";
import MapPreviewPanel from "@/components/admin/MapPreviewPanel";

interface PageProps {
  params: Promise<{ mapId: string }>;
}

export default async function PreviewMapPage({ params }: PageProps) {
  const { mapId } = await params;
  const result = await getMapForEditing(mapId);
  if (!result) notFound();

  const siteUrl = await getSiteUrl();

  return (
    <MapPreviewPanel
      map={result.map}
      categories={result.categories}
      pins={result.pins}
      siteUrl={siteUrl}
    />
  );
}
