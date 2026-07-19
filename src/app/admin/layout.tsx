import Link from "next/link";
import { requireUser } from "@/lib/data";
import { signOut } from "./actions";
import ThemeToggle from "@/components/ThemeToggle";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center justify-between border-b border-black/10 px-4 dark:border-white/10">
        <Link href="/admin" className="text-sm font-bold">
          🗺️ イベントマップ管理
        </Link>
        <div className="flex items-center gap-3 text-sm text-neutral-500">
          <ThemeToggle className="text-base leading-none hover:opacity-70" />
          <span>{user.email}</span>
          <Link href="/admin/transit-feeds" className="hover:underline">
            交通機関フィード
          </Link>
          <Link href="/admin/account" className="hover:underline">
            アカウント設定
          </Link>
          <form action={signOut}>
            <button type="submit" className="hover:underline">
              ログアウト
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
