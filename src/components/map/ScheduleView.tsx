"use client";

import { useMemo } from "react";
import type { MapCategory, Pin } from "@/lib/types";

interface ScheduleViewProps {
  pins: Pin[];
  categories: MapCategory[];
  hiddenVenues: string[];
}

interface ScheduleRow {
  key: string;
  time: string;
  sortKey: string | null;
  label: string;
  emoji: string;
  color: string;
  cancelled: boolean;
}

function formatSessionTime(t: string | null) {
  return t ? t.slice(0, 5) : "";
}

export default function ScheduleView({ pins, categories, hiddenVenues }: ScheduleViewProps) {
  const categoryById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories]
  );

  const venueGroups = useMemo(() => {
    const hidden = new Set(hiddenVenues);
    const order: string[] = [];
    const rowsByVenue = new Map<string, ScheduleRow[]>();

    for (const pin of pins) {
      if (!pin.place_note || hidden.has(pin.place_note)) continue;

      const category = pin.category_id ? categoryById[pin.category_id] : undefined;
      const color = category?.color ?? "#6b7280";
      const rows: ScheduleRow[] = [];

      if (pin.sessions && pin.sessions.length > 0) {
        for (const s of pin.sessions) {
          const time = [formatSessionTime(s.start_time), formatSessionTime(s.end_time)]
            .filter(Boolean)
            .join("〜");
          rows.push({
            key: s.id,
            time,
            sortKey: s.start_time,
            label: pin.title === s.title ? s.title : `${pin.title} - ${s.title}`,
            emoji: pin.emoji,
            color,
            cancelled: pin.status === "cancelled",
          });
        }
      } else if (pin.time_label) {
        rows.push({
          key: pin.id,
          time: pin.time_label,
          sortKey: null,
          label: pin.title,
          emoji: pin.emoji,
          color,
          cancelled: pin.status === "cancelled",
        });
      } else {
        // 時刻情報がないピン(トイレ・受付など)はタイムスケジュールには出さない
        continue;
      }

      if (!rowsByVenue.has(pin.place_note)) {
        order.push(pin.place_note);
        rowsByVenue.set(pin.place_note, []);
      }
      rowsByVenue.get(pin.place_note)!.push(...rows);
    }

    return order.map((venue) => {
      const rows = rowsByVenue.get(venue)!;
      rows.sort((a, b) => {
        if (a.sortKey && b.sortKey) return a.sortKey.localeCompare(b.sortKey);
        if (a.sortKey) return -1;
        if (b.sortKey) return 1;
        return 0;
      });
      return { venue, rows };
    });
  }, [pins, categoryById, hiddenVenues]);

  if (venueGroups.length === 0) {
    return (
      <div className="empty-state">
        <p>タイムスケジュールに表示できるプログラムがありません。</p>
      </div>
    );
  }

  return (
    <div className="schedule-view">
      {venueGroups.map(({ venue, rows }) => (
        <section key={venue} className="schedule-venue-section">
          <h2 className="schedule-venue-title">{venue}</h2>
          <ul className="schedule-row-list">
            {rows.map((row) => (
              <li key={row.key} className="schedule-row">
                <span className="schedule-time">{row.time}</span>
                <span
                  className="schedule-emoji-badge"
                  style={{ background: `color-mix(in srgb, ${row.color} 16%, var(--map-surface))` }}
                >
                  {row.emoji}
                </span>
                <span
                  className="schedule-label"
                  style={row.cancelled ? { textDecoration: "line-through", opacity: 0.6 } : undefined}
                >
                  {row.label}
                </span>
                {row.cancelled && <span className="popup-badge popup-badge--cancelled">中止</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
