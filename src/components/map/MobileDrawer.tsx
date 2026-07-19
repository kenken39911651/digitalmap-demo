"use client";

import type { ReactNode } from "react";

interface MobileDrawerProps {
  toggleLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

// 西高屋デモのモバイルサイドバー（ドロワー＋スクリム＋ハンバーガー）を移植。
// 一覧タップ時に閉じる必要があるため、開閉状態は親（PublicMapView）が管理する。
export default function MobileDrawer({
  toggleLabel,
  open,
  onOpenChange,
  children,
}: MobileDrawerProps) {
  return (
    <>
      <button
        type="button"
        className={"menu-toggle" + (open ? " is-open" : "")}
        aria-expanded={open}
        aria-controls="sidebar"
        onClick={() => onOpenChange(!open)}
      >
        <span className="menu-icon" />
        {toggleLabel}
      </button>

      <aside id="sidebar" className={"sidebar" + (open ? " is-open" : "")}>
        <div className="sidebar-drag-handle" aria-hidden="true" />
        <div className="sidebar-inner">{children}</div>
      </aside>

      <div
        className={"sidebar-scrim" + (open ? " is-open" : "")}
        onClick={() => onOpenChange(false)}
      />
    </>
  );
}
