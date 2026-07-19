"use client";

import { useState, useTransition } from "react";
import { deleteAccount } from "@/lib/actions/account";

const CONFIRM_WORD = "削除";

export default function DeleteAccountSection({ mapCount }: { mapCount: number }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteAccount();
      } catch {
        setError("削除に失敗しました。もう一度お試しください。");
      }
    });
  }

  return (
    <div className="mt-10 rounded-2xl border border-red-300 p-5 dark:border-red-900">
      <h2 className="text-sm font-bold text-red-600">アカウントを削除</h2>
      <p className="mt-2 text-sm text-neutral-500">
        アカウントを削除すると、作成した{mapCount}件のマップ（ピン・カテゴリを含む）が
        すべて完全に削除されます。この操作は取り消せません。
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 dark:border-red-900"
      >
        アカウントを削除する
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 dark:bg-neutral-900">
            <h3 className="text-base font-bold text-red-600">本当に削除しますか？</h3>
            <p className="mt-3 text-sm text-neutral-500">
              作成した{mapCount}件のマップと、その中のすべてのピン・カテゴリが完全に削除されます。
              元に戻すことはできません。
            </p>
            <label className="mt-4 flex flex-col gap-1 text-sm font-medium">
              確認のため「{CONFIRM_WORD}」と入力してください
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-normal dark:border-neutral-700 dark:bg-neutral-950"
              />
            </label>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setConfirmText("");
                  setError(null);
                }}
                className="px-3 py-2 text-sm text-neutral-500"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={confirmText !== CONFIRM_WORD || pending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {pending ? "削除中…" : "完全に削除する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
