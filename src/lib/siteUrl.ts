import "server-only";
import { headers } from "next/headers";

// 通常のページ遷移(GETナビゲーション)ではOriginヘッダーが送られてこないため、
// (await headers()).get("origin") に依存すると本番でも取得できず、
// フォールバック値(localhost)に落ちてしまう。Hostヘッダーは常に送られてくる
// ので、そちらを優先して組み立てる。NEXT_PUBLIC_SITE_URLが設定されていれば
// それを最優先する。
export async function getSiteUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  const headerList = await headers();
  const host = headerList.get("host");
  if (!host) return "http://localhost:3000";

  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${protocol}://${host}`;
}
