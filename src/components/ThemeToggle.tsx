"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// data-theme属性(layout.tsxのインラインスクリプトが保存済み設定から反映する)を
// 真の値として読む。useSyncExternalStoreを使うのは、サーバー描画時点では
// 分からない値をuseEffect+setStateで後から入れるとリンタールール
// (react-hooks/set-state-in-effect)に引っかかるため。
function getSnapshot(): Theme {
  const current = document.documentElement.getAttribute("data-theme") as Theme | null;
  return current ?? getSystemTheme();
}

function getServerSnapshot(): Theme {
  return "light";
}

function setTheme(next: Theme) {
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  listeners.forEach((listener) => listener());
}

export default function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label="ライト/ダークモード切替"
      className={className ?? "theme-toggle-btn"}
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
