"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EventMap, MapCategory, Pin } from "@/lib/types";
import MapCanvas, { type MapCanvasHandle } from "@/components/map/MapCanvas";
import CategoryChips from "@/components/map/CategoryChips";
import PinList from "@/components/map/PinList";
import PinForm from "./PinForm";
import AddCategoryModal from "./AddCategoryModal";
import MapNoticeModal from "./MapNoticeModal";
import { cyclePinStatus } from "@/lib/actions/pins";

type FormTarget =
  | { mode: "create"; lat: number; lng: number }
  | { mode: "edit"; pin: Pin }
  | null;

interface AdminMapEditorProps {
  map: EventMap;
  categories: MapCategory[];
  pins: Pin[];
}

export default function AdminMapEditor({ map, categories, pins }: AdminMapEditorProps) {
  const router = useRouter();
  const canvasRef = useRef<MapCanvasHandle>(null);
  const [activeCategoryIds, setActiveCategoryIds] = useState<Set<string>>(
    () => new Set(categories.map((c) => c.id))
  );
  const [formTarget, setFormTarget] = useState<FormTarget>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const sortedPins = useMemo(
    () => [...pins].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")),
    [pins]
  );

  function toggleCategory(id: string) {
    setActiveCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSelectPin(pinId: string) {
    setActivePinId(pinId);
    const pin = pins.find((p) => p.id === pinId);
    if (pin) canvasRef.current?.flyTo(pin.lat, pin.lng);
  }

  function handleCycleStatus(pin: Pin) {
    startTransition(async () => {
      await cyclePinStatus(pin.id, map.id, pin.status);
      router.refresh();
    });
  }

  function closeForm() {
    setFormTarget(null);
    router.refresh();
  }

  return (
    <div className="flex h-[calc(100dvh-56px)] flex-col">
      <div className="flex items-center justify-between border-b border-black/10 px-4 py-2 dark:border-white/10">
        <div>
          <Link href="/admin" className="text-xs text-neutral-500 hover:underline">
            ← マイマップ
          </Link>
          <h2 className="text-sm font-bold">{map.title}</h2>
        </div>
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => setShowNotice(true)}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 font-semibold dark:border-neutral-700"
          >
            注意事項{map.notice_text ? "✓" : ""}
          </button>
          <Link
            href={`/admin/maps/${map.id}/preview`}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 font-semibold dark:border-neutral-700"
          >
            プレビュー・公開
          </Link>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden sm:flex-row">
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto border-b border-black/10 p-4 dark:border-white/10 sm:w-[360px] sm:flex-none sm:border-b-0 sm:border-r">
          <p className="text-xs text-neutral-500">
            地図をタップしてピンを追加できます。当日はここでステータスをワンタップ切替できます。
          </p>

          <CategoryChips
            categories={categories}
            activeCategoryIds={activeCategoryIds}
            onToggle={toggleCategory}
          />

          <PinList
            pins={sortedPins}
            categories={categories}
            activePinId={activePinId}
            onSelect={handleSelectPin}
            editable
            onCycleStatus={handleCycleStatus}
            onEdit={(pin) => setFormTarget({ mode: "edit", pin })}
          />
        </div>

        <div className="relative flex-1">
          <MapCanvas
            ref={canvasRef}
            centerLat={map.center_lat}
            centerLng={map.center_lng}
            zoom={map.default_zoom}
            basemap={map.basemap}
            brandColor={map.brand_color}
            centerLabel={map.title}
            categories={categories}
            pins={pins}
            activeCategoryIds={activeCategoryIds}
            onMarkerClick={handleSelectPin}
            onMapClick={(lat, lng) => setFormTarget({ mode: "create", lat, lng })}
          />
        </div>
      </div>

      {formTarget && (
        <PinForm
          mapId={map.id}
          categories={categories}
          target={formTarget}
          onClose={closeForm}
          onAddCategory={() => setShowAddCategory(true)}
        />
      )}

      {showAddCategory && (
        <AddCategoryModal
          mapId={map.id}
          onClose={() => {
            setShowAddCategory(false);
            router.refresh();
          }}
        />
      )}

      {showNotice && (
        <MapNoticeModal
          mapId={map.id}
          initialNotice={map.notice_text}
          onClose={() => {
            setShowNotice(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
