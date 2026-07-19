"use client";

import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  requestMagicLink,
  signInWithPassword,
  signUpWithPassword,
  type RequestMagicLinkState,
  type PasswordAuthState,
} from "../actions";

const initialMagicLinkState: RequestMagicLinkState = { status: "idle" };
const initialPasswordState: PasswordAuthState = { status: "idle" };

type Mode = "password" | "signup" | "magic";

function PasswordLoginForm() {
  const [state, action, pending] = useActionState(signInWithPassword, initialPasswordState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="email" className="text-sm font-medium">
        メールアドレス
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        placeholder="you@example.com"
        className="rounded-lg border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />
      <label htmlFor="password" className="text-sm font-medium">
        パスワード
      </label>
      <input
        id="password"
        name="password"
        type="password"
        required
        placeholder="••••••••"
        className="rounded-lg border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />
      {state.status === "error" && <p className="text-sm text-red-600">{state.message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
      >
        {pending ? "ログイン中…" : "ログイン"}
      </button>
    </form>
  );
}

function SignUpForm() {
  const [state, action, pending] = useActionState(signUpWithPassword, initialPasswordState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="signup-email" className="text-sm font-medium">
        メールアドレス
      </label>
      <input
        id="signup-email"
        name="email"
        type="email"
        required
        placeholder="you@example.com"
        className="rounded-lg border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />
      <label htmlFor="signup-password" className="text-sm font-medium">
        パスワード
      </label>
      <input
        id="signup-password"
        name="password"
        type="password"
        required
        minLength={6}
        placeholder="6文字以上"
        className="rounded-lg border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />
      {state.status === "error" && <p className="text-sm text-red-600">{state.message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
      >
        {pending ? "登録中…" : "アカウントを作成"}
      </button>
    </form>
  );
}

function MagicLinkForm() {
  const [state, action, pending] = useActionState(requestMagicLink, initialMagicLinkState);
  if (state.status === "sent") {
    return (
      <p className="rounded-lg border border-green-600/30 bg-green-600/10 p-4 text-sm">
        {state.message}
      </p>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="magic-email" className="text-sm font-medium">
        メールアドレス
      </label>
      <input
        id="magic-email"
        name="email"
        type="email"
        required
        placeholder="you@example.com"
        className="rounded-lg border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />
      {state.status === "error" && <p className="text-sm text-red-600">{state.message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
      >
        {pending ? "送信中…" : "ログインリンクを送る"}
      </button>
    </form>
  );
}

const TABS: { mode: Mode; label: string }[] = [
  { mode: "password", label: "パスワード" },
  { mode: "signup", label: "新規登録" },
  { mode: "magic", label: "メールリンク" },
];

function LoginTabs() {
  const searchParams = useSearchParams();
  const hasAuthError = searchParams.get("error") === "auth";
  const [mode, setMode] = useState<Mode>("password");

  return (
    <>
      {hasAuthError && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          ログインリンクの有効期限が切れているか、既に使用されています。
          お手数ですが、直近に届いたメールのリンクをお使いいただくか、もう一度お送りください。
        </p>
      )}

      <div className="flex gap-4 border-b border-neutral-200 text-sm dark:border-neutral-800">
        {TABS.map((tab) => (
          <button
            key={tab.mode}
            type="button"
            onClick={() => setMode(tab.mode)}
            className={
              "-mb-px whitespace-nowrap border-b-2 pb-2 font-semibold " +
              (mode === tab.mode
                ? "border-neutral-900 text-neutral-900 dark:border-white dark:text-white"
                : "border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300")
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mode === "password" && <PasswordLoginForm />}
      {mode === "signup" && <SignUpForm />}
      {mode === "magic" && <MagicLinkForm />}
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-xl font-bold">主催者ログイン</h1>
        <p className="mt-2 text-sm text-neutral-500">
          パスワードでのログイン・新規登録のほか、メールのログインリンクも使えます。
        </p>
      </div>
      <Suspense fallback={null}>
        <LoginTabs />
      </Suspense>
    </div>
  );
}
