import { notFound } from "next/navigation";
import { getMapForEditing, getOrganizationGtfsFeeds } from "@/lib/data";
import AdminMapEditor from "@/components/admin/AdminMapEditor";

interface PageProps {
  params: Promise<{ mapId: string }>;
}

export default async function EditMapPage({ params }: PageProps) {
  const { mapId } = await params;
  const [result, gtfsFeeds] = await Promise.all([getMapForEditing(mapId), getOrganizationGtfsFeeds()]);
  if (!result) notFound();

  return (
    <AdminMapEditor
      map={result.map}
      categories={result.categories}
      pins={result.pins}
      gtfsFeeds={gtfsFeeds}
    />
  );
}
