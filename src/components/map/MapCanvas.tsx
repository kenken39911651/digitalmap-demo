"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MapCategory, Pin } from "@/lib/types";
import {
  applyBrandTint,
  applyJapaneseLabels,
  BasemapToggleControl,
  styleUrlFor,
} from "./maptilerBasemap";
import { fetchUpcomingDepartures } from "@/lib/gtfs/clientTimetable";

export interface MapCanvasHandle {
  flyTo(lat: number, lng: number, zoom?: number): void;
  openPopup(pinId: string): void;
}

interface MapCanvasProps {
  centerLat: number;
  centerLng: number;
  zoom: number;
  basemap: "std" | "photo";
  brandColor?: string;
  centerLabel?: string;
  /** 管理画面では実ピンと重なって紛らわしいため非表示にする(既定は表示)。 */
  showCenterMarker?: boolean;
  /** 来場者向け公開マップでのみ「現在地」ボタンを表示する(既定は非表示)。 */
  showGeolocate?: boolean;
  categories: MapCategory[];
  pins: Pin[];
  activeCategoryIds: Set<string>;
  onMarkerClick?: (pinId: string) => void;
  /** Admin mode: clicking the map drops a new pin at that location. */
  onMapClick?: (lat: number, lng: number) => void;
}

function escapeHtml(str: string) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
}

function makePinElement(color: string, cancelled: boolean, emoji: string) {
  const el = document.createElement("div");
  // touch-actionを指定しないと、ピンの上から指でピンチ操作を始めたときに
  // ブラウザ標準のタッチ処理と地図側のジェスチャー処理が競合し、ズームの
  // 中心がずれたような挙動になることがある。地図本体と同様にnoneにする。
  //
  // position:absoluteが重要: relativeのままだと通常の文書フローにも乗って
  // しまい、MapLibreのtransformによる配置に加えて生成順に応じたわずかな
  // 縦ズレが積み重なる。広域ズームで実距離のピクセル差がほぼ0になると、
  // このズレだけが目立ってピンが無関係な場所に散らばって見えるバグの原因
  // だった。absoluteでフローから外すことでtransformのみが位置を決める。
  el.style.cssText = `
    position:absolute; width:30px; height:30px; cursor:pointer;
    opacity:${cancelled ? "0.45" : "1"}; touch-action:none;
  `;
  el.innerHTML = `
    <div style="
      position:absolute; inset:0; background:${color}; border-radius:50% 50% 50% 0;
      transform: rotate(-45deg); border:2px solid #fff; box-shadow:0 2px 6px rgba(0,0,0,0.3);
    "></div>
    <div style="
      position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
      font-size:15px; line-height:1; transform: translateY(-2px);
    ">${escapeHtml(emoji)}</div>
  `;
  return el;
}

function formatSessionTime(t: string | null) {
  return t ? t.slice(0, 5) : "";
}

function sessionListHtml(pin: Pin) {
  const sessions = pin.sessions;
  if (!sessions || sessions.length === 0) return "";
  const rows = sessions
    .map((s) => {
      const time = [formatSessionTime(s.start_time), formatSessionTime(s.end_time)]
        .filter(Boolean)
        .join("〜");
      return `<li>${time ? `<span class="popup-schedule-time">${escapeHtml(time)}</span>` : ""}${escapeHtml(s.title)}</li>`;
    })
    .join("");
  return `
    <div class="popup-schedule">
      <div class="popup-schedule-title">プログラム</div>
      <ul class="popup-schedule-list">${rows}</ul>
    </div>
  `;
}

function transitHtml(pin: Pin) {
  const stop = pin.transit_stop;
  if (!stop) return "";
  if (stop.data_source === "external_link" && stop.external_url) {
    return `
      <div class="popup-transit">
        <a class="popup-transit-link-btn" href="${escapeHtml(stop.external_url)}" target="_blank" rel="noopener noreferrer">
          🚉 ${escapeHtml(stop.external_label || "Yahoo!路線情報で見る")}
        </a>
      </div>
    `;
  }
  if (stop.data_source === "gtfs") {
    return `<div class="popup-transit"><p class="popup-transit-loading">🚉 時刻表を読み込み中…</p></div>`;
  }
  return "";
}

// GTFS時刻表は開くたびに最新を取りに行くため、popupHtml()の同期文字列では
// なく、ポップアップの"open"イベントで非同期に.popup-transit要素へ差し込む。
function loadTransitTimetable(pin: Pin, popup: maplibregl.Popup) {
  const stop = pin.transit_stop;
  if (!stop || stop.data_source !== "gtfs" || !stop.gtfs_stops || stop.gtfs_stops.length === 0) return;

  const stopQueries = stop.gtfs_stops.map((s) => ({
    feedId: s.feed_id,
    gtfsStopUuid: s.gtfs_stop_id,
    routeUuids: (s.routes ?? []).map((r) => r.route_uuid),
  }));

  fetchUpcomingDepartures(stopQueries)
    .then((rows) => {
      if (!popup.isOpen()) return;
      const el = popup.getElement()?.querySelector<HTMLElement>(".popup-transit");
      if (!el) return;
      if (rows.length === 0) {
        el.innerHTML = `<p class="popup-transit-empty">本日の運行はありません</p>`;
        return;
      }
      el.innerHTML = `
        <ul class="popup-transit-list">
          ${rows
            .map(
              (r) => `
            <li class="popup-transit-row">
              <span class="popup-transit-time">${escapeHtml(r.timeText)}</span>
              <span class="popup-transit-headsign">${escapeHtml(
                [r.routeName, r.headsign].filter(Boolean).join(" ")
              )}</span>
            </li>
          `
            )
            .join("")}
        </ul>
      `;
    })
    .catch(() => {
      if (!popup.isOpen()) return;
      const el = popup.getElement()?.querySelector<HTMLElement>(".popup-transit");
      if (el) el.innerHTML = `<p class="popup-transit-empty">時刻表を取得できませんでした</p>`;
    });
}

function popupHtml(pin: Pin, category: MapCategory | undefined) {
  const accent = category?.color ?? "var(--map-text-muted)";
  const cancelledBadge =
    pin.status === "cancelled"
      ? `<span class="popup-badge popup-badge--cancelled">中止</span>`
      : "";
  const titleStyle = pin.status === "cancelled" ? "text-decoration:line-through;" : "";
  const meta = [pin.date ? formatDate(pin.date) : null, pin.time_label]
    .filter(Boolean)
    .join("｜");
  return `
    <div class="popup-content" style="--popup-accent:${accent}">
      <div class="popup-head">
        <span class="popup-emoji-badge">${pin.emoji}</span>
        <div class="popup-headline">
          <div class="popup-title" style="${titleStyle}">${escapeHtml(pin.title)}${cancelledBadge}</div>
          ${category ? `<div class="popup-category">${escapeHtml(category.label)}</div>` : ""}
        </div>
      </div>
      ${meta || pin.place_note ? `
        <div class="popup-meta-group">
          ${meta ? `<div class="popup-meta">🕒 ${escapeHtml(meta)}</div>` : ""}
          ${pin.place_note ? `<div class="popup-meta">📍 ${escapeHtml(pin.place_note)}</div>` : ""}
        </div>
      ` : ""}
      ${pin.description ? `<div class="popup-desc">${escapeHtml(pin.description)}</div>` : ""}
      ${sessionListHtml(pin)}
      ${transitHtml(pin)}
    </div>
  `;
}

const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvas(
  {
    centerLat,
    centerLng,
    zoom,
    basemap,
    brandColor = "#c0472e",
    centerLabel,
    showCenterMarker = true,
    showGeolocate = false,
    categories,
    pins,
    activeCategoryIds,
    onMarkerClick,
    onMapClick,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const centerMarkerRef = useRef<maplibregl.Marker | null>(null);
  const markersRef = useRef<Record<string, maplibregl.Marker>>({});
  const activePinIdRef = useRef<string | null>(null);
  const onMarkerClickRef = useRef(onMarkerClick);
  const onMapClickRef = useRef(onMapClick);

  onMarkerClickRef.current = onMarkerClick;
  onMapClickRef.current = onMapClick;

  // Map init (once)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrlFor(basemap),
      center: [centerLng, centerLat],
      zoom,
      // 会場マップに地図の回転は不要で、スマホのピンチズーム時に指が
      // わずかにねじれるだけで意図せず回転してしまい「ピンが動く」ように
      // 感じる原因になるため、回転操作自体を無効化する(ズームは維持)。
      dragRotate: false,
      touchPitch: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();

    // top-leftはモバイルで浮動の「イベント一覧」ボタンと重なるため、
    // ズームボタンはbottom-leftに配置する。
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-left");
    map.addControl(
      new BasemapToggleControl(basemap, brandColor, () => {
        /* handled via re-render on parent state if needed */
      }),
      "top-right"
    );

    if (showGeolocate) {
      const geolocate = new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      });
      // GeolocateControlは失敗時に見た目上のフィードバックを出さないため、
      // 権限拒否・取得失敗を利用者に伝える最低限のアラートを出す。
      geolocate.on("error", (err) => {
        if (err.code === 1) {
          alert("位置情報の利用が許可されていません。ブラウザの設定から位置情報の利用を許可してください。");
        } else {
          alert("現在地を取得できませんでした。電波状況の良い場所で再度お試しください。");
        }
      });
      map.addControl(geolocate, "bottom-left");
    }

    map.once("style.load", () => {
      applyBrandTint(map, basemap, brandColor);
      applyJapaneseLabels(map);
    });

    map.on("click", (e) => {
      onMapClickRef.current?.(e.lngLat.lat, e.lngLat.lng);
    });

    mapRef.current = map;

    // flexレイアウト内ではマウント時にコンテナの高さが未確定なことがあり、
    // その場合MapLibreのCanvasが白紙のまま固まる。サイズ変化を監視して
    // 都度resize()を呼び、レイアウト確定後も正しく描画されるようにする。
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Center marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !showCenterMarker) return;

    const el = document.createElement("div");
    // position:absoluteが必須の理由はピンのマーカーと同じ(下のmakePinElement
    // のコメント参照)。
    el.style.cssText = `
      position:absolute;
      background:#2b2a26; color:#fff; border-radius:999px;
      width:34px; height:34px; display:flex; align-items:center; justify-content:center;
      font-size:16px; box-shadow:0 2px 8px rgba(0,0,0,0.35); border:2px solid #fff;
      touch-action:none;
    `;
    el.textContent = "📍";

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([centerLng, centerLat])
      .addTo(map);

    if (centerLabel) {
      marker.setPopup(
        new maplibregl.Popup({ offset: 20 }).setHTML(
          `<div class="popup-content"><div class="popup-title">${escapeHtml(centerLabel)}</div></div>`
        )
      );
    }

    centerMarkerRef.current = marker;
    return () => {
      marker.remove();
    };
  }, [centerLat, centerLng, centerLabel, showCenterMarker]);

  // Pin markers, re-rendered when data/filter changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function render() {
      Object.values(markersRef.current).forEach((m) => m.remove());
      markersRef.current = {};

      const categoryById = Object.fromEntries(categories.map((c) => [c.id, c]));

      pins
        .filter((p) => p.status !== "hidden")
        .filter((p) => !p.category_id || activeCategoryIds.has(p.category_id))
        .forEach((pin) => {
          const category = pin.category_id ? categoryById[pin.category_id] : undefined;
          const color = category?.color ?? "#6b7280";
          const el = makePinElement(color, pin.status === "cancelled", pin.emoji);
          const popup = new maplibregl.Popup({ offset: 24, maxWidth: "300px" }).setHTML(
            popupHtml(pin, category)
          );
          popup.on("close", () => {
            if (activePinIdRef.current === pin.id) activePinIdRef.current = null;
          });
          popup.on("open", () => loadTransitTimetable(pin, popup));
          const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
            .setLngLat([pin.lng, pin.lat])
            .setPopup(popup)
            .addTo(map!);
          // MapLibreの「マーカークリックでポップアップ開閉」は地図のclickイベント
          // 経由の間接的な仕組みで、確実に発火するとは限らない。自前のクリック
          // ハンドラで直接開閉する。
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            // 別のピンのポップアップが開いていたら閉じてから、このピンを開く
            if (activePinIdRef.current && activePinIdRef.current !== pin.id) {
              markersRef.current[activePinIdRef.current]?.getPopup()?.remove();
            }
            if (!popup.isOpen()) marker.togglePopup();
            activePinIdRef.current = pin.id;
            onMarkerClickRef.current?.(pin.id);
          });
          markersRef.current[pin.id] = marker;
        });
    }

    if (map.isStyleLoaded()) render();
    else map.once("style.load", render);
  }, [pins, categories, activeCategoryIds]);

  // Keep basemap/brand color in sync if changed from outside (e.g. wizard step)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    applyBrandTint(map, basemap, brandColor);
    applyJapaneseLabels(map);
  }, [basemap, brandColor]);

  useImperativeHandle(ref, () => ({
    flyTo(lat, lng, targetZoom) {
      // ズームレベルを明示的に指定しない限り、タップ時に縮尺を変えず
      // 現在のズームを維持したままパンする。
      const zoomToUse = targetZoom ?? mapRef.current?.getZoom();
      mapRef.current?.flyTo({ center: [lng, lat], zoom: zoomToUse, duration: 600 });
    },
    openPopup(pinId) {
      // 一覧からの選択時も、別のピンのポップアップが開いていたら閉じる。
      if (activePinIdRef.current && activePinIdRef.current !== pinId) {
        markersRef.current[activePinIdRef.current]?.getPopup()?.remove();
      }
      // マーカー自体のクリックでは、MapLibre標準の挙動で既にポップアップが
      // 開いているため、ここでtogglePopup()すると閉じてしまう。既に開いて
      // いる場合は何もしない、閉じている場合だけ開く(冪等)。
      const marker = markersRef.current[pinId];
      if (marker && !marker.getPopup()?.isOpen()) {
        marker.togglePopup();
      }
      activePinIdRef.current = pinId;
    },
  }));

  return <div ref={containerRef} className="map-canvas" />;
});

export default MapCanvas;
