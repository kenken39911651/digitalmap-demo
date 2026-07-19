"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { EventMap, MapCategory, Pin } from "@/lib/types";
import PublicMapView from "@/components/map/PublicMapView";
import ShareSection from "./ShareSection";
import { applyPublishedChanges, publishMap, unpublishMap } from "@/lib/actions/maps";

interface MapPreviewPanelProps {
  map: EventMap;
  categories: MapCategory[];
  pins: Pin[];
  siteUrl: string;
}

export default function MapPreviewPanel({ map, categories, pins, siteUrl }: MapPreviewPanelProps) {
  const [status, setStatus] = useState(map.status);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const publicUrl = `${siteUrl}/m/${map.slug}`;

  function handlePublish() {
    setError(null);
    startTransition(async () => {
      try {
        await publishMap(map.id);
        setStatus("published");
      } catch {
        setError("公開に失敗しました。");
      }
    });
  }

  function handleUnpublish() {
    setError(null);
    startTransition(async () => {
      try {
        await unpublishMap(map.id);
        setStatus("draft");
      } catch {
        setError("非公開化に失敗しました。");
      }
    });
  }

  function handleApplyChanges() {
    setError(null);
    setApplied(false);
    startTransition(async () => {
      try {
        await applyPublishedChanges(map.id);
        setApplied(true);
      } catch {
        setError("反映に失敗しました。");
      }
    });
  }

  return (
    <div className="flex h-[calc(100dvh-56px)] flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 px-4 py-2 dark:border-white/10">
        <div>
          <Link href={`/admin/maps/${map.id}/edit`} className="text-xs text-neutral-500 hover:underline">
            ← 編集に戻る
          </Link>
          <h2 className="text-sm font-bold">プレビュー：{map.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {error && <span className="text-xs text-red-600">{error}</span>}
          {applied && !error && <span className="text-xs text-green-600">公開マップに反映しました。</span>}
          {status === "published" ? (
            <>
              <button
                type="button"
                onClick={handleApplyChanges}
                disabled={pending}
                className="rounded-lg bg-neutral-900 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
              >
                {pending ? "反映中…" : "変更を公開に反映"}
              </button>
              <button
                type="button"
                onClick={handleUnpublish}
                disabled={pending}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold disabled:opacity-40 dark:border-neutral-700"
              >
                下書きに戻す
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handlePublish}
              disabled={pending}
              className="rounded-lg bg-neutral-900 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
            >
              {pending ? "公開中…" : "公開する"}
            </button>
          )}
        </div>
      </div>

      {status === "published" && (
        <div className="border-b border-black/10 p-4 dark:border-white/10">
          <p className="mb-3 text-xs text-neutral-500">
            編集画面での変更は、ここで「変更を公開に反映」を押すまで来場者には表示されません。
            このプレビューは常に最新の編集内容を表示しています。
          </p>
          <ShareSection url={publicUrl} title={map.title} />
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        <PublicMapView map={map} categories={categories} pins={pins} />
      </div>
    </div>
  );
}
