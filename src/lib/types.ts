export type EventType = "matsuri" | "marche" | "frima" | "bousai" | "other";
export type MapStatus = "draft" | "published";
export type PinStatus = "active" | "cancelled" | "hidden";
export type Basemap = "std" | "photo";

export interface EventMap {
  id: string;
  organization_id: string;
  slug: string;
  title: string;
  event_type: EventType;
  description: string | null;
  center_lat: number;
  center_lng: number;
  default_zoom: number;
  basemap: Basemap;
  brand_color: string;
  status: MapStatus;
  event_date_start: string | null;
  event_date_end: string | null;
  notice_text: string | null;
  hidden_schedule_venues: string[];
  published_at: string | null;
  published_snapshot: PublishedSnapshot | null;
  created_at: string;
  updated_at: string;
}

/**
 * 公開マップ(/m/[slug])が実際に表示する内容のスナップショット。管理画面での
 * 編集は常にライブテーブル(pins/map_categories/event_maps)に即時保存されるが、
 * それを来場者向けページへ反映するのは「変更を公開に反映」操作を挟むことで、
 * 編集途中の状態が公開中のマップに勝手に出てしまわないようにしている。
 */
export interface PublishedSnapshot {
  map: Pick<
    EventMap,
    | "title"
    | "description"
    | "center_lat"
    | "center_lng"
    | "default_zoom"
    | "basemap"
    | "brand_color"
    | "notice_text"
    | "hidden_schedule_venues"
  >;
  categories: MapCategory[];
  pins: Pin[];
}

export interface MapCategory {
  id: string;
  map_id: string;
  label: string;
  color: string;
  icon: string | null;
  sort_order: number;
}

export interface Pin {
  id: string;
  map_id: string;
  category_id: string | null;
  title: string;
  emoji: string;
  lat: number;
  lng: number;
  description: string | null;
  place_note: string | null;
  date: string | null;
  time_label: string | null;
  photo_url: string | null;
  status: PinStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
  /** Only populated when fetched via a nested Supabase select. */
  sessions?: PinSession[];
  /** Only populated when fetched via a nested Supabase select. */
  transit_stop?: PinTransitStop | null;
}

export interface PinSession {
  id: string;
  pin_id: string;
  title: string;
  start_time: string | null; // "HH:MM:SS" (Supabase time type)
  end_time: string | null;
  description: string | null;
  sort_order: number;
}

export type TransitDataSource = "gtfs" | "external_link";

export interface PinTransitStop {
  id: string;
  pin_id: string;
  data_source: TransitDataSource;
  external_url: string | null;
  external_label: string | null;
  feed_id: string | null;
  gtfs_stop_id: string | null;
  /** 管理画面での表示用。ネスト選択で取得したときだけ入る。 */
  gtfs_stop?: { stop_name: string } | null;
}

export type GtfsFeedStatus = "pending" | "stops_ready" | "ready" | "error";

export interface GtfsFeed {
  id: string;
  organization_id: string;
  name: string;
  source_url: string;
  status: GtfsFeedStatus;
  last_imported_at: string | null;
  last_error: string | null;
}

export interface GtfsStop {
  id: string;
  feed_id: string;
  stop_id: string;
  stop_name: string;
  stop_lat: number | null;
  stop_lon: number | null;
}

export interface Organization {
  id: string;
  name: string;
  created_at: string;
}
