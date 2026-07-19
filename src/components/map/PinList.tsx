"use client";

import type { MapCategory, Pin, PinStatus } from "@/lib/types";

interface PinListProps {
  pins: Pin[];
  categories: MapCategory[];
  activePinId: string | null;
  onSelect: (pinId: string) => void;
  editable?: boolean;
  onCycleStatus?: (pin: Pin) => void;
  onEdit?: (pin: Pin) => void;
}

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
}

const STATUS_LABEL: Record<PinStatus, string> = {
  active: "公開中",
  cancelled: "中止",
  hidden: "非表示",
};

const NEXT_STATUS: Record<PinStatus, PinStatus> = {
  active: "cancelled",
  cancelled: "hidden",
  hidden: "active",
};

export default function PinList({
  pins,
  categories,
  activePinId,
  onSelect,
  editable = false,
  onCycleStatus,
  onEdit,
}: PinListProps) {
  const categoryById = Object.fromEntries(categories.map((c) => [c.id, c]));

  if (pins.length === 0) {
    return <p className="empty-state">条件に一致するピンがありません</p>;
  }

  return (
    <ul className="event-list">
      {pins.map((pin) => {
        const cat = pin.category_id ? categoryById[pin.category_id] : undefined;
        const meta = [pin.date ? formatDate(pin.date) : null, pin.time_label]
          .filter(Boolean)
          .join("｜");
        const accentColor = cat?.color ?? "var(--map-text-muted)";
        return (
          <li key={pin.id}>
            <div
              className={"event-card" + (pin.id === activePinId ? " is-active" : "")}
              style={{ ["--card-accent" as string]: accentColor }}
            >
              <button
                type="button"
                className="event-card-main"
                onClick={() => onSelect(pin.id)}
              >
                <div className="event-card-top">
                  <span className="event-emoji-badge" style={{ background: accentColor }}>
                    {pin.emoji}
                  </span>
                  <div className="event-card-headline">
                    <span
                      className="event-title"
                      style={pin.status === "cancelled" ? { textDecoration: "line-through" } : undefined}
                    >
                      {pin.title}
                    </span>
                    {cat && <span className="event-category">{cat.label}</span>}
                  </div>
                </div>
                {(meta || pin.place_note) && (
                  <div className="event-card-details">
                    {meta && <div className="event-meta">🕒 {meta}</div>}
                    {pin.place_note && <div className="event-meta">📍 {pin.place_note}</div>}
                  </div>
                )}
              </button>

              {editable && (
                <div className="event-card-actions">
                  <button
                    type="button"
                    className={`status-chip status-chip--${pin.status}`}
                    onClick={() => onCycleStatus?.(pin)}
                    title="タップでステータス切替"
                  >
                    {STATUS_LABEL[pin.status]} → {STATUS_LABEL[NEXT_STATUS[pin.status]]}
                  </button>
                  <button type="button" className="edit-chip" onClick={() => onEdit?.(pin)}>
                    編集
                  </button>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
