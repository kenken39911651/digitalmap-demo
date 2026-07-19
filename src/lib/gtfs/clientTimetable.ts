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

// 指定した停留所(gtfs_stops.id)の、現在時刻(Asia/Tokyo)以降の次の発車を数件返す。
// gtfs_stops以下のテーブルはRLSでselect誰でも可のため、ブラウザの匿名クライアント
// から直接クエリできる(サーバー側のAPIルートを新設する必要がない)。
export async function fetchUpcomingDepartures(
  feedId: string,
  gtfsStopUuid: string,
  limit = 5
): Promise<DepartureRow[]> {
  const supabase = createClient();
  const { dateStr, weekday, minutesSinceMidnight } = getTokyoNow();

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
  const serviceIds = new Set([
    ...(calendarRows ?? []).map((r) => r.service_id as string).filter((id) => !removed.has(id)),
    ...added,
  ]);
  if (serviceIds.size === 0) return [];

  const { data: stopTimeRows } = await supabase
    .from("gtfs_stop_times")
    .select(
      "departure_time, arrival_time, trip:gtfs_trips(service_id, trip_headsign, route:gtfs_routes(route_short_name, route_long_name))"
    )
    .eq("stop_uuid", gtfsStopUuid);

  type Row = {
    departure_time: string | null;
    arrival_time: string | null;
    trip:
      | {
          service_id: string;
          trip_headsign: string | null;
          route: { route_short_name: string | null; route_long_name: string | null } | null;
        }
      | {
          service_id: string;
          trip_headsign: string | null;
          route: { route_short_name: string | null; route_long_name: string | null } | null;
        }[]
      | null;
  };

  const rows = ((stopTimeRows ?? []) as unknown as Row[])
    .map((r, i) => {
      const trip = Array.isArray(r.trip) ? r.trip[0] : r.trip;
      const timeRaw = r.departure_time || r.arrival_time;
      const minutes = timeRaw ? timeStringToMinutes(timeRaw) : null;
      if (!trip || minutes === null) return null;
      if (!serviceIds.has(trip.service_id)) return null;
      if (minutes < minutesSinceMidnight) return null;
      const route = Array.isArray(trip.route) ? trip.route[0] : trip.route;
      return {
        key: `${i}-${timeRaw}`,
        sortMinutes: minutes,
        timeText: formatMinutes(minutes),
        headsign: trip.trip_headsign || null,
        routeName: route?.route_short_name || route?.route_long_name || null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => a.sortMinutes - b.sortMinutes)
    .slice(0, limit);

  return rows.map(({ key, timeText, headsign, routeName }) => ({ key, timeText, headsign, routeName }));
}
