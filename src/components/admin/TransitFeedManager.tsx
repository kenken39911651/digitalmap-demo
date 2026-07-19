"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { GtfsFeed } from "@/lib/types";
import { registerGtfsFeed, refreshGtfsFeedStops, deleteGtfsFeed } from "@/lib/actions/transit";

const STATUS_LABEL: Record<GtfsFeed["status"], string> = {
  pending: "取り込み待ち",
  stops_ready: "利用可能",
  ready: "利用可能",
  error: "エラー",
};

export default function TransitFeedManager({ feeds }: { feeds: GtfsFeed[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [pending, startTransition] = useTransition();
  const [busyFeedId, setBusyFeedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    if (!name.trim() || !sourceUrl.trim()) {
      setError("フィード名とURLを入力してください。");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await registerGtfsFeed({ name: name.trim(), sourceUrl: sourceUrl.trim() });
        setName("");
        setSourceUrl("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "登録に失敗しました。");
      }
    });
  }

  function handleRefresh(feedId: string) {
    setBusyFeedId(feedId);
    setError(null);
    startTransition(async () => {
      try {
        await refreshGtfsFeedStops(feedId);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "更新に失敗しました。");
      } finally {
        setBusyFeedId(null);
      }
    });
  }

  function handleDelete(feedId: string) {
    setBusyFeedId(feedId);
    setError(null);
    startTransition(async () => {
      try {
        await deleteGtfsFeed(feedId);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "削除に失敗しました。");
      } finally {
        setBusyFeedId(null);
      }
    });
  }

  return (
    <div className="mt-8 flex flex-col gap-6">
      <div className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="text-sm font-bold">新しいフィードを登録</h2>
        <div className="mt-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            フィード名
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：広島県バス協会"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-normal dark:border-neutral-700 dark:bg-neutral-950"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            GTFSフィードURL（.zip）
            <input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://..."
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-normal dark:border-neutral-700 dark:bg-neutral-950"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={handleAdd}
            disabled={pending}
            className="self-start rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
          >
            {pending && !busyFeedId ? "登録中…" : "登録する"}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-bold">登録済みフィード</h2>
        {feeds.length === 0 ? (
          <p className="text-sm text-neutral-500">まだフィードが登録されていません。</p>
        ) : (
          feeds.map((feed) => (
            <div
              key={feed.id}
              className="flex flex-col gap-2 rounded-2xl border border-neutral-200 p-4 text-sm dark:border-neutral-800"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{feed.name}</span>
                <span
                  className={
                    "rounded-full px-2 py-0.5 text-xs font-semibold " +
                    (feed.status === "error"
                      ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                      : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300")
                  }
                >
                  {STATUS_LABEL[feed.status]}
                </span>
              </div>
              <p className="break-all text-xs text-neutral-500">{feed.source_url}</p>
              {feed.last_imported_at && (
                <p className="text-xs text-neutral-500">
                  最終更新: {new Date(feed.last_imported_at).toLocaleString("ja-JP")}
                </p>
              )}
              {feed.last_error && <p className="text-xs text-red-600">{feed.last_error}</p>}
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleRefresh(feed.id)}
                  disabled={pending}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-40 dark:border-neutral-700"
                >
                  {pending && busyFeedId === feed.id ? "更新中…" : "今すぐ更新"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(feed.id)}
                  disabled={pending}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-40 dark:border-red-900"
                >
                  削除
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
