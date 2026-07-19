import JSZip from "jszip";
import { parse } from "csv-parse/sync";

export interface GtfsStopRow {
  stop_id: string;
  stop_name: string;
  stop_lat?: string;
  stop_lon?: string;
}
export interface GtfsRouteRow {
  route_id: string;
  route_short_name?: string;
  route_long_name?: string;
}
export interface GtfsTripRow {
  trip_id: string;
  route_id: string;
  service_id: string;
  trip_headsign?: string;
}
export interface GtfsStopTimeRow {
  trip_id: string;
  stop_id: string;
  stop_sequence: string;
  arrival_time?: string;
  departure_time?: string;
}
export interface GtfsCalendarRow {
  service_id: string;
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  sunday: string;
  start_date: string;
  end_date: string;
}
export interface GtfsCalendarDateRow {
  service_id: string;
  date: string;
  exception_type: string;
}

async function loadZip(sourceUrl: string): Promise<JSZip> {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`GTFSフィードの取得に失敗しました (HTTP ${res.status})`);
  const buffer = await res.arrayBuffer();
  return JSZip.loadAsync(buffer);
}

// GTFSのzipはサブディレクトリに入っていることが稀にあるため、末尾一致で探す。
function findEntry(zip: JSZip, filename: string) {
  const escaped = filename.replace(".", "\\.");
  const matches = zip.file(new RegExp(`${escaped}$`, "i"));
  return matches[0] ?? null;
}

async function parseCsvFile<T>(zip: JSZip, filename: string): Promise<T[]> {
  const entry = findEntry(zip, filename);
  if (!entry) return [];
  const text = await entry.async("string");
  if (!text.trim()) return [];
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  }) as T[];
}

export async function loadGtfsZip(sourceUrl: string) {
  const zip = await loadZip(sourceUrl);
  return {
    stops: () => parseCsvFile<GtfsStopRow>(zip, "stops.txt"),
    routes: () => parseCsvFile<GtfsRouteRow>(zip, "routes.txt"),
    trips: () => parseCsvFile<GtfsTripRow>(zip, "trips.txt"),
    stopTimes: () => parseCsvFile<GtfsStopTimeRow>(zip, "stop_times.txt"),
    calendar: () => parseCsvFile<GtfsCalendarRow>(zip, "calendar.txt"),
    calendarDates: () => parseCsvFile<GtfsCalendarDateRow>(zip, "calendar_dates.txt"),
  };
}

// GTFSの日付は"YYYYMMDD"形式。Postgresのdate型用に"YYYY-MM-DD"へ変換する。
export function formatGtfsDate(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}
