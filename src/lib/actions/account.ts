"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// 組織(とそこに紐づく全マップ・ピン)を完全削除する。ログイン資格情報
// (auth.usersの行)自体は残るため、同じメールアドレスで再ログインすると
// 空の新しい組織が自動作成される(通常の初回ログインと同じ挙動)。
export async function deleteAccount(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_own_account");
  if (error) throw new Error("削除に失敗しました");
  await supabase.auth.signOut();
  redirect("/login");
}
