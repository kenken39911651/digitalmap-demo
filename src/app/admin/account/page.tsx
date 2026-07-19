import Link from "next/link";
import { requireUser, getOrganizationMaps } from "@/lib/data";
import DeleteAccountSection from "@/components/admin/DeleteAccountSection";

export default async function AccountPage() {
  const user = await requireUser();
  const maps = await getOrganizationMaps();

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <Link href="/admin" className="text-xs text-neutral-500 hover:underline">
        ← マイマップ
      </Link>
      <h1 className="mt-2 text-xl font-bold">アカウント設定</h1>
      <p className="mt-2 text-sm text-neutral-500">{user.email}</p>

      <DeleteAccountSection mapCount={maps.length} />
    </div>
  );
}
