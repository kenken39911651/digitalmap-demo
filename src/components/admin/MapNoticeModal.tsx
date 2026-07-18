"use client";

import { useState, useTransition } from "react";
import { updateMapNotice } from "@/lib/actions/maps";

interface MapNoticeModalProps {
  mapId: string;
  initialNotice: string | null;
  onClose: () => void;
}

export default function MapNoticeModal({ mapId, initialNotice, onClose }: MapNoticeModalProps) {
  const [notice, setNotice] = useState(initialNotice ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await updateMapNotice(mapId, notice);
        onClose();
      } catch {
        setError("保存に失敗しました。もう一度お試しください。");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 dark:bg-neutral-900">
        <h3 className="text-base font-bold">注意事項</h3>
        <p className="mt-1 text-xs text-neutral-500">
          来場者がマップを開いたときに、最初にポップアップで表示されます。空欄にすると表示されません。
        </p>
        <textarea
          value={notice}
          onChange={(e) => setNotice(e.target.value)}
          rows={5}
          placeholder="例：荒天時は中止となる場合があります。会場内は禁煙です。"
          className="mt-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
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
