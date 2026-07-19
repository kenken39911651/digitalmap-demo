import Link from "next/link";
import { getOrganizationGtfsFeeds } from "@/lib/data";
import TransitFeedManager from "@/components/admin/TransitFeedManager";

export default async function TransitFeedsPage() {
  const feeds = await getOrganizationGtfsFeeds();

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/admin" className="text-xs text-neutral-500 hover:underline">
        ← マイマップ
      </Link>
      <h1 className="mt-2 text-xl font-bold">交通機関フィード</h1>
      <p className="mt-2 text-sm text-neutral-500">
        バス・鉄道のGTFSフィードを登録すると、ピンに駅・バス停を設定して時刻表を表示できるようになります。
        GTFSに対応していない事業者は、ピン側で外部サイトへのリンクを設定してください。
      </p>

      <TransitFeedManager feeds={feeds} />
    </div>
  );
}
