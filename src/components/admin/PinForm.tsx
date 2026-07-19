"use client";

import { useEffect, useState, useTransition } from "react";
import type { GtfsFeed, MapCategory, Pin } from "@/lib/types";
import { createPin, updatePin, deletePin, type SessionInput, type TransitStopInput } from "@/lib/actions/pins";
import { searchGtfsStops, prepareGtfsStopForPin } from "@/lib/actions/transit";

interface AddedStop {
  feedId: string;
  gtfsStopId: string;
  stopName: string;
  routes: { routeUuid: string; label: string }[];
  selectedRouteUuids: Set<string>;
  loadingRoutes: boolean;
}

interface PinFormProps {
  mapId: string;
  categories: MapCategory[];
  gtfsFeeds: GtfsFeed[];
  /** New pin: only lat/lng known. Existing pin: full Pin record. */
  target: { mode: "create"; lat: number; lng: number } | { mode: "edit"; pin: Pin };
  onClose: () => void;
  onAddCategory: () => void;
}

const EMOJI_CHOICES = ["📍", "🏮", "🍽️", "🎤", "🚻", "🚑", "🧸", "🎁", "🧯", "📦"];

function timeValue(t: string | null): string {
  // Supabaseのtime型は"17:00:00"で返るが、<input type="time">は"17:00"を要求する
  return t ? t.slice(0, 5) : "";
}

export default function PinForm({ mapId, categories, gtfsFeeds, target, onClose, onAddCategory }: PinFormProps) {
  const existing = target.mode === "edit" ? target.pin : null;
  const existingTransit = existing?.transit_stop ?? null;
  const [title, setTitle] = useState(existing?.title ?? "");
  const [emoji, setEmoji] = useState(existing?.emoji ?? "📍");
  const [categoryId, setCategoryId] = useState<string | null>(
    existing?.category_id ?? categories[0]?.id ?? null
  );
  const [placeNote, setPlaceNote] = useState(existing?.place_note ?? "");
  const [date, setDate] = useState(existing?.date ?? "");
  const [timeLabel, setTimeLabel] = useState(existing?.time_label ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [sessions, setSessions] = useState<SessionInput[]>(
    (existing?.sessions ?? []).map((s) => ({
      title: s.title,
      startTime: timeValue(s.start_time),
      endTime: timeValue(s.end_time),
      description: s.description ?? "",
    }))
  );
  const status = existing?.status ?? "active";
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [isTransitStop, setIsTransitStop] = useState(!!existingTransit);
  const [transitSource, setTransitSource] = useState<"external_link" | "gtfs">(
    existingTransit?.data_source ?? "external_link"
  );
  const [externalUrl, setExternalUrl] = useState(existingTransit?.external_url ?? "");
  const [externalLabel, setExternalLabel] = useState(existingTransit?.external_label ?? "");
  const [selectedFeedId, setSelectedFeedId] = useState(gtfsFeeds[0]?.id ?? "");
  const [stopQuery, setStopQuery] = useState("");
  const [stopResults, setStopResults] = useState<{ id: string; stop_name: string }[]>([]);
  const [addedStops, setAddedStops] = useState<AddedStop[]>(() =>
    (existingTransit?.data_source === "gtfs" ? existingTransit.gtfs_stops ?? [] : []).map((s) => ({
      feedId: s.feed_id,
      gtfsStopId: s.gtfs_stop_id,
      stopName: s.gtfs_stop?.stop_name ?? "登録済みの停留所",
      routes: [],
      selectedRouteUuids: new Set((s.routes ?? []).map((r) => r.route_uuid)),
      loadingRoutes: true,
    }))
  );
  const [searchPending, startSearchTransition] = useTransition();

  // 編集時、既に紐付いている停留所の路線一覧(名前つき)を取り直す。選択済みの
  // route_uuidだけはDBから分かるが、名前やチェックを外した他の路線の存在は
  // 停留所ごとに再取得しないと分からないため。
  useEffect(() => {
    addedStops.forEach((stop, index) => {
      if (!stop.loadingRoutes) return;
      prepareGtfsStopForPin(stop.feedId, stop.gtfsStopId)
        .then(({ routes }) => {
          setAddedStops((prev) =>
            prev.map((s, i) =>
              i === index
                ? { ...s, routes: routes.map((r) => ({ routeUuid: r.routeUuid, label: r.label })), loadingRoutes: false }
                : s
            )
          );
        })
        .catch(() => {
          setAddedStops((prev) => prev.map((s, i) => (i === index ? { ...s, loadingRoutes: false } : s)));
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateSession(index: number, patch: Partial<SessionInput>) {
    setSessions((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function addSession() {
    setSessions((prev) => [...prev, { title: "", startTime: "", endTime: "" }]);
  }

  function removeSession(index: number) {
    setSessions((prev) => prev.filter((_, i) => i !== index));
  }

  function moveSession(index: number, direction: -1 | 1) {
    setSessions((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function handleSearchStops() {
    if (!selectedFeedId || !stopQuery.trim()) return;
    setError(null);
    startSearchTransition(async () => {
      try {
        const results = await searchGtfsStops(selectedFeedId, stopQuery);
        setStopResults(results.map((r) => ({ id: r.id, stop_name: r.stop_name })));
      } catch {
        setError("停留所の検索に失敗しました。");
      }
    });
  }

  function addStop(stop: { id: string; stop_name: string }) {
    if (!selectedFeedId) return;
    if (addedStops.some((s) => s.feedId === selectedFeedId && s.gtfsStopId === stop.id)) {
      setStopResults([]);
      setStopQuery("");
      return;
    }
    setError(null);
    startSearchTransition(async () => {
      try {
        const { stopName, routes } = await prepareGtfsStopForPin(selectedFeedId, stop.id);
        setAddedStops((prev) => [
          ...prev,
          {
            feedId: selectedFeedId,
            gtfsStopId: stop.id,
            stopName,
            routes: routes.map((r) => ({ routeUuid: r.routeUuid, label: r.label })),
            selectedRouteUuids: new Set(routes.map((r) => r.routeUuid)),
            loadingRoutes: false,
          },
        ]);
        setStopResults([]);
        setStopQuery("");
      } catch {
        setError("停留所の取り込みに失敗しました。");
      }
    });
  }

  function removeStop(index: number) {
    setAddedStops((prev) => prev.filter((_, i) => i !== index));
  }

  function toggleStopRoute(index: number, routeUuid: string) {
    setAddedStops((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        const next = new Set(s.selectedRouteUuids);
        if (next.has(routeUuid)) next.delete(routeUuid);
        else next.add(routeUuid);
        return { ...s, selectedRouteUuids: next };
      })
    );
  }

  function buildTransitStop(): TransitStopInput {
    if (!isTransitStop) return null;
    if (transitSource === "external_link") {
      if (!externalUrl.trim()) return null;
      return { dataSource: "external_link", url: externalUrl.trim(), label: externalLabel.trim() || undefined };
    }
    if (addedStops.length === 0) return null;
    return {
      dataSource: "gtfs",
      stops: addedStops.map((s) => ({
        feedId: s.feedId,
        gtfsStopId: s.gtfsStopId,
        // 全路線が選択されている(=絞り込みなし)場合は空配列を送る
        routeUuids: s.selectedRouteUuids.size >= s.routes.length ? [] : [...s.selectedRouteUuids],
      })),
    };
  }

  function handleSave() {
    if (!title.trim()) {
      setError("名前を入力してください。");
      return;
    }
    setError(null);
    const transitStop = buildTransitStop();
    startTransition(async () => {
      try {
        if (target.mode === "create") {
          await createPin({
            mapId,
            categoryId,
            title: title.trim(),
            emoji,
            lat: target.lat,
            lng: target.lng,
            description,
            placeNote,
            date,
            timeLabel,
            sessions,
            transitStop,
          });
        } else {
          await updatePin({
            pinId: target.pin.id,
            mapId,
            categoryId,
            title: title.trim(),
            emoji,
            description,
            placeNote,
            date,
            timeLabel,
            status,
            sessions,
            transitStop,
          });
        }
        onClose();
      } catch {
        setError("保存に失敗しました。もう一度お試しください。");
      }
    });
  }

  function handleDelete() {
    if (target.mode !== "edit") return;
    startTransition(async () => {
      try {
        await deletePin(target.pin.id, mapId);
        onClose();
      } catch {
        setError("削除に失敗しました。");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 dark:bg-neutral-900 sm:rounded-2xl">
        <h3 className="text-base font-bold">
          {target.mode === "create" ? "ピンを追加" : "ピンを編集"}
        </h3>

        <div className="mt-4 flex flex-col gap-3">
          <div className="flex gap-2">
            {EMOJI_CHOICES.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={
                  "h-9 w-9 rounded-full border text-lg " +
                  (emoji === e
                    ? "border-neutral-900 bg-neutral-100 dark:border-white dark:bg-neutral-800"
                    : "border-neutral-300 dark:border-neutral-700")
                }
              >
                {e}
              </button>
            ))}
          </div>

          <p className="text-xs text-neutral-400">
            登録座標: {(target.mode === "create" ? target.lat : target.pin.lat).toFixed(6)},{" "}
            {(target.mode === "create" ? target.lng : target.pin.lng).toFixed(6)}
            {target.mode === "edit" &&
              "（位置がおかしい場合は削除して、地図を正しい場所でタップし直してください）"}
          </p>

          <label className="flex flex-col gap-1 text-sm font-medium">
            名前
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：たこ焼き屋台"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-normal dark:border-neutral-700 dark:bg-neutral-950"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            カテゴリ
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  className="rounded-full border px-3 py-1 text-xs font-semibold"
                  style={{
                    borderColor: c.color,
                    background: categoryId === c.id ? c.color : "transparent",
                    color: categoryId === c.id ? "#fff" : c.color,
                  }}
                >
                  {c.icon} {c.label}
                </button>
              ))}
              <button
                type="button"
                onClick={onAddCategory}
                className="rounded-full border border-dashed border-neutral-400 px-3 py-1 text-xs font-semibold text-neutral-500"
              >
                + カテゴリを追加
              </button>
            </div>
          </label>

          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
              日付
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-normal dark:border-neutral-700 dark:bg-neutral-950"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
              時間帯
              <input
                value={timeLabel}
                onChange={(e) => setTimeLabel(e.target.value)}
                placeholder="17:00〜20:00"
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-normal dark:border-neutral-700 dark:bg-neutral-950"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium">
            場所メモ
            <input
              value={placeNote}
              onChange={(e) => setPlaceNote(e.target.value)}
              placeholder="例：駅前ロータリー"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-normal dark:border-neutral-700 dark:bg-neutral-950"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            説明
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-normal dark:border-neutral-700 dark:bg-neutral-950"
            />
          </label>

          <div className="flex flex-col gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
            <span className="text-sm font-medium">
              プログラム（この会場で複数の企画がある場合）
            </span>
            {sessions.map((s, i) => (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-2 dark:border-neutral-800"
              >
                <div className="flex items-center gap-2">
                  <div className="flex shrink-0 flex-col">
                    <button
                      type="button"
                      onClick={() => moveSession(i, -1)}
                      disabled={i === 0}
                      aria-label="上に移動"
                      className="leading-none text-neutral-400 disabled:opacity-20"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSession(i, 1)}
                      disabled={i === sessions.length - 1}
                      aria-label="下に移動"
                      className="leading-none text-neutral-400 disabled:opacity-20"
                    >
                      ▼
                    </button>
                  </div>
                  <input
                    type="time"
                    value={s.startTime}
                    onChange={(e) => updateSession(i, { startTime: e.target.value })}
                    className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-950"
                  />
                  <span className="text-xs text-neutral-400">〜</span>
                  <input
                    type="time"
                    value={s.endTime}
                    onChange={(e) => updateSession(i, { endTime: e.target.value })}
                    className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-950"
                  />
                  <input
                    value={s.title}
                    onChange={(e) => updateSession(i, { title: e.target.value })}
                    placeholder="プログラム名（例：開会式）"
                    className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-950"
                  />
                  <button
                    type="button"
                    onClick={() => removeSession(i)}
                    className="shrink-0 text-xs text-red-600"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addSession}
              className="self-start rounded-full border border-dashed border-neutral-400 px-3 py-1 text-xs font-semibold text-neutral-500"
            >
              + プログラムを追加
            </button>
          </div>

          <div className="flex flex-col gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={isTransitStop}
                onChange={(e) => setIsTransitStop(e.target.checked)}
              />
              このピンは駅・バス停（時刻表を表示する）
            </label>

            {isTransitStop && (
              <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-2 dark:border-neutral-800">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTransitSource("external_link")}
                    className={
                      "rounded-full border px-3 py-1 text-xs font-semibold " +
                      (transitSource === "external_link"
                        ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                        : "border-neutral-300 dark:border-neutral-700")
                    }
                  >
                    外部リンク
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransitSource("gtfs")}
                    className={
                      "rounded-full border px-3 py-1 text-xs font-semibold " +
                      (transitSource === "gtfs"
                        ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                        : "border-neutral-300 dark:border-neutral-700")
                    }
                  >
                    GTFS時刻表
                  </button>
                </div>

                {transitSource === "external_link" ? (
                  <>
                    <label className="flex flex-col gap-1 text-xs font-medium">
                      リンクURL
                      <input
                        value={externalUrl}
                        onChange={(e) => setExternalUrl(e.target.value)}
                        placeholder="https://transit.yahoo.co.jp/..."
                        className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs font-normal dark:border-neutral-700 dark:bg-neutral-950"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium">
                      表示ラベル（任意）
                      <input
                        value={externalLabel}
                        onChange={(e) => setExternalLabel(e.target.value)}
                        placeholder="Yahoo!路線情報で見る"
                        className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs font-normal dark:border-neutral-700 dark:bg-neutral-950"
                      />
                    </label>
                  </>
                ) : gtfsFeeds.length === 0 ? (
                  <p className="text-xs text-neutral-500">
                    まだGTFSフィードが登録されていません。ヘッダーの「交通機関フィード」から登録してください。
                  </p>
                ) : (
                  <>
                    {addedStops.length > 0 && (
                      <div className="flex flex-col gap-2">
                        {addedStops.map((stop, i) => (
                          <div
                            key={`${stop.feedId}-${stop.gtfsStopId}`}
                            className="flex flex-col gap-1.5 rounded-lg border border-neutral-200 p-2 dark:border-neutral-800"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold">{stop.stopName}</span>
                              <button
                                type="button"
                                onClick={() => removeStop(i)}
                                className="shrink-0 text-xs text-red-600"
                              >
                                削除
                              </button>
                            </div>
                            {stop.loadingRoutes ? (
                              <p className="text-xs text-neutral-400">路線を確認中…</p>
                            ) : stop.routes.length === 0 ? (
                              <p className="text-xs text-neutral-400">この停留所を通る路線が見つかりませんでした。</p>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <span className="text-xs text-neutral-500">表示する路線</span>
                                {stop.routes.map((r) => (
                                  <label key={r.routeUuid} className="flex items-center gap-2 text-xs">
                                    <input
                                      type="checkbox"
                                      checked={stop.selectedRouteUuids.has(r.routeUuid)}
                                      onChange={() => toggleStopRoute(i, r.routeUuid)}
                                    />
                                    {r.label}
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <label className="flex flex-col gap-1 text-xs font-medium">
                      フィード
                      <select
                        value={selectedFeedId}
                        onChange={(e) => {
                          setSelectedFeedId(e.target.value);
                          setStopResults([]);
                        }}
                        className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs font-normal dark:border-neutral-700 dark:bg-neutral-950"
                      >
                        {gtfsFeeds.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex gap-2">
                      <input
                        value={stopQuery}
                        onChange={(e) => setStopQuery(e.target.value)}
                        placeholder="停留所名で検索（上り・下りなど複数追加できます）"
                        className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-2 py-1.5 text-xs font-normal dark:border-neutral-700 dark:bg-neutral-950"
                      />
                      <button
                        type="button"
                        onClick={handleSearchStops}
                        disabled={searchPending}
                        className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-40 dark:border-neutral-700"
                      >
                        {searchPending ? "処理中…" : "検索"}
                      </button>
                    </div>
                    {stopResults.length > 0 && (
                      <ul className="flex flex-col gap-1">
                        {stopResults.map((s) => (
                          <li key={s.id}>
                            <button
                              type="button"
                              onClick={() => addStop(s)}
                              className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-left text-xs hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
                            >
                              + {s.stop_name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="mt-5 flex items-center justify-between">
          {target.mode === "edit" ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="text-sm font-semibold text-red-600 disabled:opacity-40"
            >
              削除
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-neutral-500">
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={pending}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
            >
              {pending ? "保存中…" : "保存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
