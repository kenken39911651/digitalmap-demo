"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface MobileDrawerProps {
  toggleLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

const CLOSE_DRAG_THRESHOLD = 80;

// 西高屋デモのモバイルサイドバー（ドロワー＋スクリム＋ハンバーガー）を移植。
// 一覧タップ時に閉じる必要があるため、開閉状態は親（PublicMapView）が管理する。
export default function MobileDrawer({
  toggleLabel,
  open,
  onOpenChange,
  children,
}: MobileDrawerProps) {
  const sidebarRef = useRef<HTMLElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const onOpenChangeRef = useRef(onOpenChange);
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  // ハンドルの上から下へのドラッグでシートを閉じる。Reactのtouchmoveハンドラは
  // ブラウザ側でpassiveリスナーとして登録されるためpreventDefault()が効かず、
  // ブラウザ標準のプルダウン更新(リロード)がドラッグ中に発火してしまう。
  // ここではDOMに直接{passive:false}で登録し、確実にpreventDefault()する。
  useEffect(() => {
    const handle = handleRef.current;
    const sidebar = sidebarRef.current;
    if (!handle || !sidebar) return;

    let startY = 0;
    let dragging = false;

    function onTouchStart(e: TouchEvent) {
      startY = e.touches[0].clientY;
      dragging = true;
      sidebar!.style.transition = "none";
    }

    function onTouchMove(e: TouchEvent) {
      if (!dragging) return;
      const deltaY = e.touches[0].clientY - startY;
      if (deltaY > 0) {
        e.preventDefault();
        sidebar!.style.transform = `translateY(${deltaY}px)`;
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (!dragging) return;
      dragging = false;
      sidebar!.style.transition = "";
      sidebar!.style.transform = "";
      const deltaY = e.changedTouches[0].clientY - startY;
      if (deltaY > CLOSE_DRAG_THRESHOLD) {
        onOpenChangeRef.current(false);
      }
    }

    handle.addEventListener("touchstart", onTouchStart, { passive: true });
    handle.addEventListener("touchmove", onTouchMove, { passive: false });
    handle.addEventListener("touchend", onTouchEnd);
    handle.addEventListener("touchcancel", onTouchEnd);

    return () => {
      handle.removeEventListener("touchstart", onTouchStart);
      handle.removeEventListener("touchmove", onTouchMove);
      handle.removeEventListener("touchend", onTouchEnd);
      handle.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

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

      <aside ref={sidebarRef} id="sidebar" className={"sidebar" + (open ? " is-open" : "")}>
        <div ref={handleRef} className="sidebar-drag-handle-zone" aria-hidden="true">
          <div className="sidebar-drag-handle" />
        </div>
        <div className="sidebar-inner">{children}</div>
      </aside>

      <div
        className={"sidebar-scrim" + (open ? " is-open" : "")}
        onClick={() => onOpenChange(false)}
      />
    </>
  );
}
