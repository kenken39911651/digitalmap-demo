"use client";

import { useMemo, useRef, useState } from "react";
import type { EventMap, MapCategory, Pin } from "@/lib/types";
import MapCanvas, { type MapCanvasHandle } from "./MapCanvas";
import VenueTabs from "./VenueTabs";
import PinList from "./PinList";
import MobileDrawer from "./MobileDrawer";
import ScheduleView from "./ScheduleView";

interface PublicMapViewProps {
  map: Pick<
    EventMap,
    | "title"
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

export default function PublicMapView({ map, categories, pins }: PublicMapViewProps) {
  const [viewMode, setViewMode] = useState<"map" | "schedule">("map");
  const [selectedVenue, setSelectedVenue] = useState<string | null>(null);
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showNotice, setShowNotice] = useState(!!map.notice_text);
  const canvasRef = useRef<MapCanvasHandle>(null);

  const visiblePins = useMemo(() => pins.filter((p) => p.status !== "hidden"), [pins]);

  const venues = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const p of visiblePins) {
      if (p.place_note && !seen.has(p.place_note)) {
        seen.add(p.place_note);
        list.push(p.place_note);
      }
    }
    return list;
  }, [visiblePins]);

  const filteredPins = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visiblePins
      .filter((p) => selectedVenue === null || p.place_note === selectedVenue)
      .filter(
        (p) =>
          !q ||
          `${p.title}${p.place_note ?? ""}`.toLowerCase().includes(q)
      )
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  }, [visiblePins, selectedVenue, search]);

  const activeCategoryIds = useMemo(() => new Set(categories.map((c) => c.id)), [categories]);

  function selectPin(pinId: string, opts: { fromMap: boolean } = { fromMap: false }) {
    setActivePinId(pinId);
    const pin = pins.find((p) => p.id === pinId);
    if (!pin) return;
    canvasRef.current?.flyTo(pin.lat, pin.lng);
    canvasRef.current?.openPopup(pinId);
    if (!opts.fromMap && window.matchMedia("(max-width: 860px)").matches) {
      setDrawerOpen(false);
    }
  }

  return (
    <div
      className="app-body"
      style={{ ["--brand-color" as string]: map.brand_color }}
    >
      {showNotice && map.notice_text && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 dark:bg-neutral-900">
            <h3 className="text-base font-bold">ご来場にあたっての注意事項</h3>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{map.notice_text}</p>
            <button
              type="button"
              onClick={() => setShowNotice(false)}
              className="mt-4 w-full rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-neutral-900"
            >
              確認しました
            </button>
          </div>
        </div>
      )}

      <div className="view-switcher">
        <div className="view-switch-group" role="tablist" aria-label="表示切り替え">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "map"}
            className={`view-switch-btn${viewMode === "map" ? " is-active" : ""}`}
            onClick={() => setViewMode("map")}
          >
            🗺️ マップ
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "schedule"}
            className={`view-switch-btn${viewMode === "schedule" ? " is-active" : ""}`}
            onClick={() => setViewMode("schedule")}
          >
            🕒 タイムスケジュール
          </button>
        </div>
      </div>

      {viewMode === "schedule" ? (
        <ScheduleView
          pins={visiblePins}
          categories={categories}
          hiddenVenues={map.hidden_schedule_venues}
        />
      ) : (
        <div className="app-row">
          <MobileDrawer toggleLabel="イベント一覧" open={drawerOpen} onOpenChange={setDrawerOpen}>
            <div className="search-block">
              <label htmlFor="mapSearchInput" className="visually-hidden">
                検索
              </label>
              <svg
                className="search-icon"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <circle cx="7" cy="7" r="5.25" stroke="currentColor" strokeWidth="1.5" />
                <path d="M11 11L14.5 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                id="mapSearchInput"
                type="search"
                placeholder="名前・場所で検索"
                autoComplete="off"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {venues.length > 0 && (
              <fieldset className="filter-block">
                <legend>会場で絞り込み</legend>
                <VenueTabs venues={venues} selectedVenue={selectedVenue} onSelect={setSelectedVenue} />
              </fieldset>
            )}

            <div className="list-block">
              <div className="list-header">
                <span>{filteredPins.length}件のスポット</span>
              </div>
              <PinList
                pins={filteredPins}
                categories={categories}
                activePinId={activePinId}
                onSelect={(id) => selectPin(id, { fromMap: false })}
              />
            </div>
          </MobileDrawer>

          <div className="map-wrap">
            <MapCanvas
              ref={canvasRef}
              centerLat={map.center_lat}
              centerLng={map.center_lng}
              zoom={map.default_zoom}
              brandColor={map.brand_color}
              basemap={map.basemap}
              centerLabel={map.title}
              showGeolocate
              categories={categories}
              pins={filteredPins}
              activeCategoryIds={activeCategoryIds}
              onMarkerClick={(id) => selectPin(id, { fromMap: true })}
            />
            <div className="map-legend">
              <div className="map-legend-title">凡例</div>
              {categories.map((c) => (
                <div key={c.id} className="map-legend-row">
                  <span className="dot" style={{ background: c.color }} />
                  {c.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
