"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/siteUrl";

export interface RequestMagicLinkState {
  status: "idle" | "sent" | "error";
  message?: string;
}

export interface PasswordAuthState {
  status: "idle" | "error";
  message?: string;
}

export async function requestMagicLink(
  _prevState: RequestMagicLinkState,
  formData: FormData
): Promise<RequestMagicLinkState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email || !email.includes("@")) {
    return { status: "error", message: "メールアドレスを正しく入力してください。" };
  }

  const supabase = await createClient();
  const origin = await getSiteUrl();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    console.error("signInWithOtp failed:", origin, error.status, error.code, error.message);
    return { status: "error", message: "送信に失敗しました。時間をおいて再度お試しください。" };
  }

  return { status: "sent", message: `${email} 宛にログイン用リンクを送信しました。` };
}

export async function signInWithPassword(
  _prevState: PasswordAuthState,
  formData: FormData
): Promise<PasswordAuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { status: "error", message: "メールアドレスとパスワードを入力してください。" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { status: "error", message: "メールアドレスまたはパスワードが正しくありません。" };
  }

  redirect("/admin");
}

export async function signUpWithPassword(
  _prevState: PasswordAuthState,
  formData: FormData
): Promise<PasswordAuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { status: "error", message: "メールアドレスとパスワードを入力してください。" };
  }
  if (password.length < 6) {
    return { status: "error", message: "パスワードは6文字以上で入力してください。" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) {
    if (error.code === "user_already_exists") {
      return {
        status: "error",
        message: "このメールアドレスは既に登録されています。ログインしてください。",
      };
    }
    return { status: "error", message: "登録に失敗しました。時間をおいて再度お試しください。" };
  }

  redirect("/admin");
}
