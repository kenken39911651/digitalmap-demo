"use client";

import { useState, useTransition } from "react";
import type { EventMap } from "@/lib/types";
import { updateMapSettings } from "@/lib/actions/maps";

interface MapSettingsModalProps {
  map: Pick<
    EventMap,
    "id" | "title" | "description" | "event_date_start" | "event_date_end" | "notice_text"
  >;
  onClose: () => void;
}

export default function MapSettingsModal({ map, onClose }: MapSettingsModalProps) {
  const [title, setTitle] = useState(map.title);
  const [description, setDescription] = useState(map.description ?? "");
  const [eventDateStart, setEventDateStart] = useState(map.event_date_start ?? "");
  const [eventDateEnd, setEventDateEnd] = useState(map.event_date_end ?? "");
  const [noticeText, setNoticeText] = useState(map.notice_text ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    if (!title.trim()) {
      setError("マップ名を入力してください。");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await updateMapSettings({
          mapId: map.id,
          title,
          description,
          eventDateStart,
          eventDateEnd,
          noticeText,
        });
        onClose();
      } catch {
        setError("保存に失敗しました。もう一度お試しください。");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 dark:bg-neutral-900">
        <h3 className="text-base font-bold">マップ設定</h3>

        <div className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            マップ名
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-normal dark:border-neutral-700 dark:bg-neutral-950"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            説明（任意）
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-normal dark:border-neutral-700 dark:bg-neutral-950"
            />
          </label>

          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
              開催日（開始）
              <input
                type="date"
                value={eventDateStart}
                onChange={(e) => setEventDateStart(e.target.value)}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-normal dark:border-neutral-700 dark:bg-neutral-950"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
              開催日（終了・任意）
              <input
                type="date"
                value={eventDateEnd}
                onChange={(e) => setEventDateEnd(e.target.value)}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-normal dark:border-neutral-700 dark:bg-neutral-950"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium">
            注意事項
            <span className="text-xs font-normal text-neutral-500">
              来場者がマップを開いたときに、最初にポップアップで表示されます。空欄なら表示されません。
            </span>
            <textarea
              value={noticeText}
              onChange={(e) => setNoticeText(e.target.value)}
              rows={4}
              placeholder="例：荒天時は中止となる場合があります。会場内は禁煙です。"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-normal dark:border-neutral-700 dark:bg-neutral-950"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
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
  );
}
