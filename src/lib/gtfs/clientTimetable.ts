"use client";

import { createClient } from "@/lib/supabase/client";

export interface DepartureRow {
  key: string;
  timeText: string;
  headsign: string | null;
  routeName: string | null;
}

type WeekdayKey =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

const WEEKDAY_SHORT_TO_KEY: Record<string, WeekdayKey> = {
  Sun: "sunday",
  Mon: "monday",
  Tue: "tuesday",
  Wed: "wednesday",
  Thu: "thursday",
  Fri: "friday",
  Sat: "saturday",
};

function getTokyoNow(): { dateStr: string; weekday: WeekdayKey; minutesSinceMidnight: number } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(now);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const dateStr = `${map.year}-${map.month}-${map.day}`;
  const weekday = WEEKDAY_SHORT_TO_KEY[map.weekday];
  // hour12:falseだとPCによって"24"を返すことがあるため24を0として扱う
  const hour = Number(map.hour) % 24;
  const minutesSinceMidnight = hour * 60 + Number(map.minute);
  return { dateStr, weekday, minutesSinceMidnight };
}

function timeStringToMinutes(t: string): number | null {
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export interface StopQuery {
  feedId: string;
  gtfsStopUuid: string;
  /** 空なら絞り込みなし(全路線を表示)。 */
  routeUuids: string[];
}

type Row = {
  departure_time: string | null;
  arrival_time: string | null;
  trip:
    | {
        service_id: string;
        trip_headsign: string | null;
        route:
          | { id: string; route_short_name: string | null; route_long_name: string | null }
          | { id: string; route_short_name: string | null; route_long_name: string | null }[]
          | null;
      }
    | {
        service_id: string;
        trip_headsign: string | null;
        route:
          | { id: string; route_short_name: string | null; route_long_name: string | null }
          | { id: string; route_short_name: string | null; route_long_name: string | null }[]
          | null;
      }[]
    | null;
};

// 停留所(1つのピンに複数の場合あり)の、現在時刻(Asia/Tokyo)以降の次の発車を
// まとめて返す。gtfs_stops以下のテーブルはRLSでselect誰でも可のため、
// ブラウザの匿名クライアントから直接クエリできる(サーバー側のAPIルートを
// 新設する必要がない)。
export async function fetchUpcomingDepartures(
  stops: StopQuery[],
  limit = 5
): Promise<DepartureRow[]> {
  if (stops.length === 0) return [];
  const supabase = createClient();
  const { dateStr, weekday, minutesSinceMidnight } = getTokyoNow();

  const feedIds = [...new Set(stops.map((s) => s.feedId))];
  const serviceIdsByFeed = new Map<string, Set<string>>();

  await Promise.all(
    feedIds.map(async (feedId) => {
      const [{ data: calendarRows }, { data: calendarDateRows }] = await Promise.all([
        supabase
          .from("gtfs_calendar")
          .select("service_id")
          .eq("feed_id", feedId)
          .eq(weekday, true)
          .lte("start_date", dateStr)
          .gte("end_date", dateStr),
        supabase
          .from("gtfs_calendar_dates")
          .select("service_id, exception_type")
          .eq("feed_id", feedId)
          .eq("date", dateStr),
      ]);
      const removed = new Set(
        (calendarDateRows ?? []).filter((r) => r.exception_type === 2).map((r) => r.service_id as string)
      );
      const added = (calendarDateRows ?? [])
        .filter((r) => r.exception_type === 1)
        .map((r) => r.service_id as string);
      serviceIdsByFeed.set(
        feedId,
        new Set([
          ...(calendarRows ?? []).map((r) => r.service_id as string).filter((id) => !removed.has(id)),
          ...added,
        ])
      );
    })
  );

  const allRows: (DepartureRow & { sortMinutes: number })[] = [];
  let keySeq = 0;

  await Promise.all(
    stops.map(async (stop) => {
      const serviceIds = serviceIdsByFeed.get(stop.feedId);
      if (!serviceIds || serviceIds.size === 0) return;

      const { data: stopTimeRows } = await supabase
        .from("gtfs_stop_times")
        .select(
          "departure_time, arrival_time, trip:gtfs_trips(service_id, trip_headsign, route:gtfs_routes(id, route_short_name, route_long_name))"
        )
        .eq("stop_uuid", stop.gtfsStopUuid);

      const routeFilter = stop.routeUuids.length > 0 ? new Set(stop.routeUuids) : null;

      for (const r of (stopTimeRows ?? []) as unknown as Row[]) {
        const trip = Array.isArray(r.trip) ? r.trip[0] : r.trip;
        const timeRaw = r.departure_time || r.arrival_time;
        const minutes = timeRaw ? timeStringToMinutes(timeRaw) : null;
        if (!trip || minutes === null) continue;
        if (!serviceIds.has(trip.service_id)) continue;
        if (minutes < minutesSinceMidnight) continue;
        const route = trip.route ? (Array.isArray(trip.route) ? trip.route[0] : trip.route) : null;
        if (routeFilter && (!route || !routeFilter.has(route.id))) continue;

        allRows.push({
          key: `${keySeq++}-${timeRaw}`,
          sortMinutes: minutes,
          timeText: formatMinutes(minutes),
          headsign: trip.trip_headsign || null,
          routeName: route?.route_short_name || route?.route_long_name || null,
        });
      }
    })
  );

  return allRows
    .sort((a, b) => a.sortMinutes - b.sortMinutes)
    .slice(0, limit)
    .map(({ key, timeText, headsign, routeName }) => ({ key, timeText, headsign, routeName }));
}
