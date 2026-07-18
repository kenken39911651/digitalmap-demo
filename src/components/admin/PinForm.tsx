"use client";

import { useState, useTransition } from "react";
import type { MapCategory, Pin } from "@/lib/types";
import { createPin, updatePin, deletePin, type SessionInput } from "@/lib/actions/pins";

interface PinFormProps {
  mapId: string;
  categories: MapCategory[];
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

export default function PinForm({ mapId, categories, target, onClose, onAddCategory }: PinFormProps) {
  const existing = target.mode === "edit" ? target.pin : null;
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

  function handleSave() {
    if (!title.trim()) {
      setError("名前を入力してください。");
      return;
    }
    setError(null);
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
