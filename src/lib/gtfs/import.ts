import { createClient } from "@/lib/supabase/server";
import { loadGtfsZip, formatGtfsDate } from "./parse";

type DbClient = Awaited<ReturnType<typeof createClient>>;

async function upsertInBatches(
  supabase: DbClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
  batchSize = 500
): Promise<void> {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) throw new Error(`${table}への保存に失敗しました: ${error.message}`);
  }
}

async function insertInBatches(
  supabase: DbClient,
  table: string,
  rows: Record<string, unknown>[],
  batchSize = 500
): Promise<void> {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).insert(batch);
    if (error) throw new Error(`${table}への保存に失敗しました: ${error.message}`);
  }
}

// フィード登録時・「今すぐ更新」時に呼ぶ軽量な取り込み。stops.txt/routes.txtのみ。
export async function importFeedStops(
  supabase: DbClient,
  feedId: string,
  organizationId: string,
  sourceUrl: string
): Promise<void> {
  const gtfs = await loadGtfsZip(sourceUrl);
  const [stopRows, routeRows] = await Promise.all([gtfs.stops(), gtfs.routes()]);

  if (stopRows.length === 0) {
    throw new Error("stops.txtが見つからないか、内容が空です。フィードのURLを確認してください。");
  }

  await upsertInBatches(
    supabase,
    "gtfs_stops",
    stopRows
      .filter((r) => r.stop_id)
      .map((r) => ({
        feed_id: feedId,
        organization_id: organizationId,
        stop_id: r.stop_id,
        stop_name: r.stop_name ?? "",
        stop_lat: r.stop_lat ? Number(r.stop_lat) : null,
        stop_lon: r.stop_lon ? Number(r.stop_lon) : null,
      })),
    "feed_id,stop_id"
  );

  const routesPayload = routeRows
    .filter((r) => r.route_id)
    .map((r) => ({
      feed_id: feedId,
      organization_id: organizationId,
      route_id: r.route_id,
      route_short_name: r.route_short_name || null,
      route_long_name: r.route_long_name || null,
    }));
  if (routesPayload.length > 0) {
    await upsertInBatches(supabase, "gtfs_routes", routesPayload, "feed_id,route_id");
  }
}

// ピンに特定の停留所を選んだ時に呼ぶ。その停留所に関係するtrip/stop_times/
// calendarだけを芋づる式に抽出して取り込む(フィード全体は取り込まない)。
export async function importStopSchedule(
  supabase: DbClient,
  feedId: string,
  organizationId: string,
  sourceUrl: string,
  gtfsStopUuid: string,
  stopIdInFeed: string
): Promise<void> {
  const gtfs = await loadGtfsZip(sourceUrl);

  const stopTimeRows = (await gtfs.stopTimes()).filter((r) => r.stop_id === stopIdInFeed);
  if (stopTimeRows.length === 0) return;

  const tripIds = [...new Set(stopTimeRows.map((r) => r.trip_id))];
  const tripRows = (await gtfs.trips()).filter((r) => tripIds.includes(r.trip_id));

  const routeIds = [...new Set(tripRows.map((r) => r.route_id))];
  const routeRows = (await gtfs.routes()).filter((r) => routeIds.includes(r.route_id));
  if (routeRows.length > 0) {
    await upsertInBatches(
      supabase,
      "gtfs_routes",
      routeRows.map((r) => ({
        feed_id: feedId,
        organization_id: organizationId,
        route_id: r.route_id,
        route_short_name: r.route_short_name || null,
        route_long_name: r.route_long_name || null,
      })),
      "feed_id,route_id"
    );
  }

  const { data: routeRowsInDb, error: routeFetchError } = await supabase
    .from("gtfs_routes")
    .select("id, route_id")
    .eq("feed_id", feedId)
    .in("route_id", routeIds.length > 0 ? routeIds : [""]);
  if (routeFetchError) throw new Error("路線情報の取得に失敗しました");
  const routeUuidByRouteId = new Map(
    (routeRowsInDb ?? []).map((r) => [r.route_id as string, r.id as string])
  );

  const tripsPayload = tripRows
    .filter((r) => routeUuidByRouteId.has(r.route_id))
    .map((r) => ({
      feed_id: feedId,
      organization_id: organizationId,
      trip_id: r.trip_id,
      route_uuid: routeUuidByRouteId.get(r.route_id)!,
      service_id: r.service_id,
      trip_headsign: r.trip_headsign || null,
    }));
  if (tripsPayload.length > 0) {
    await upsertInBatches(supabase, "gtfs_trips", tripsPayload, "feed_id,trip_id");
  }

  const { data: tripRowsInDb, error: tripFetchError } = await supabase
    .from("gtfs_trips")
    .select("id, trip_id")
    .eq("feed_id", feedId)
    .in("trip_id", tripIds.length > 0 ? tripIds : [""]);
  if (tripFetchError) throw new Error("便情報の取得に失敗しました");
  const tripUuidByTripId = new Map(
    (tripRowsInDb ?? []).map((r) => [r.trip_id as string, r.id as string])
  );

  const stopTimesPayload = stopTimeRows
    .filter((r) => tripUuidByTripId.has(r.trip_id))
    .map((r) => ({
      feed_id: feedId,
      organization_id: organizationId,
      trip_uuid: tripUuidByTripId.get(r.trip_id)!,
      stop_uuid: gtfsStopUuid,
      stop_sequence: Number(r.stop_sequence),
      arrival_time: r.arrival_time || null,
      departure_time: r.departure_time || null,
    }));
  if (stopTimesPayload.length > 0) {
    await upsertInBatches(supabase, "gtfs_stop_times", stopTimesPayload, "feed_id,trip_uuid,stop_sequence");
  }

  const serviceIds = [...new Set(tripRows.map((r) => r.service_id))];

  const calendarRows = (await gtfs.calendar()).filter((r) => serviceIds.includes(r.service_id));
  const calendarPayload = calendarRows.map((r) => ({
    feed_id: feedId,
    organization_id: organizationId,
    service_id: r.service_id,
    monday: r.monday === "1",
    tuesday: r.tuesday === "1",
    wednesday: r.wednesday === "1",
    thursday: r.thursday === "1",
    friday: r.friday === "1",
    saturday: r.saturday === "1",
    sunday: r.sunday === "1",
    start_date: formatGtfsDate(r.start_date),
    end_date: formatGtfsDate(r.end_date),
  }));
  if (calendarPayload.length > 0) {
    await upsertInBatches(supabase, "gtfs_calendar", calendarPayload, "feed_id,service_id");
  }

  const calendarDateRows = (await gtfs.calendarDates()).filter((r) =>
    serviceIds.includes(r.service_id)
  );
  if (calendarDateRows.length > 0) {
    // calendar_datesにはunique制約がないため、再取り込み時の重複を避けるべく
    // 対象service_id分をいったん削除してから入れ直す。
    await supabase
      .from("gtfs_calendar_dates")
      .delete()
      .eq("feed_id", feedId)
      .in("service_id", serviceIds);
    await insertInBatches(
      supabase,
      "gtfs_calendar_dates",
      calendarDateRows.map((r) => ({
        feed_id: feedId,
        organization_id: organizationId,
        service_id: r.service_id,
        date: formatGtfsDate(r.date),
        exception_type: Number(r.exception_type),
      }))
    );
  }
}
