"use client";

import { useMemo } from "react";
import type { MapCategory, Pin } from "@/lib/types";

interface ScheduleViewProps {
  pins: Pin[];
  categories: MapCategory[];
  hiddenVenues: string[];
}

interface GridEntry {
  key: string;
  startMinutes: number;
  endMinutes: number;
  label: string;
  emoji: string;
  color: string;
  cancelled: boolean;
  timeText: string;
  lane: number;
  laneCount: number;
}

interface FallbackRow {
  key: string;
  time: string;
  label: string;
  emoji: string;
  color: string;
  cancelled: boolean;
}

const ROW_HEIGHT = 64; // 1時間あたりの高さ(px)
const MIN_BLOCK_HEIGHT = 34; // 短時間の項目でも文字が読める最低の高さ(px)
const LANE_WIDTH = 116; // 1レーンあたりの幅(px)。会場列の幅を決めるのにも使う
const MIN_COLUMN_WIDTH = 150; // 会場列の最低幅(px)
const DEFAULT_DURATION = 60; // 終了時刻が分からない場合の仮の長さ(分)

function formatMinutes(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// "17:00〜20:00" のような自由記述から開始・終了(分)を読み取る。時刻が1つしか
// 書かれていない場合はDEFAULT_DURATION分の仮の長さを与える。時刻が全く
// 読み取れない場合はnullを返し、呼び出し側でグリッド外の一覧に回す。
function parseTimeLabelRange(label: string): { start: number; end: number } | null {
  const matches = [...label.matchAll(/(\d{1,2}):(\d{2})/g)];
  if (matches.length === 0) return null;
  const start = Number(matches[0][1]) * 60 + Number(matches[0][2]);
  if (matches.length >= 2) {
    const end = Number(matches[1][1]) * 60 + Number(matches[1][2]);
    if (end > start) return { start, end };
  }
  return { start, end: start + DEFAULT_DURATION };
}

export default function ScheduleView({ pins, categories, hiddenVenues }: ScheduleViewProps) {
  const categoryById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories]
  );

  const { venues, entriesByVenue, columnWidthByVenue, gridStart, gridEnd, fallbackRows } = useMemo(() => {
    const hidden = new Set(hiddenVenues);
    const venueOrder: string[] = [];
    const rawByVenue = new Map<string, Omit<GridEntry, "lane" | "laneCount">[]>();
    const fallback: FallbackRow[] = [];
    let minStart = Infinity;
    let maxEnd = -Infinity;

    for (const pin of pins) {
      if (!pin.place_note || hidden.has(pin.place_note)) continue;
      const category = pin.category_id ? categoryById[pin.category_id] : undefined;
      const color = category?.color ?? "#6b7280";
      const cancelled = pin.status === "cancelled";
      const rawEntries: Omit<GridEntry, "lane" | "laneCount">[] = [];

      if (pin.sessions && pin.sessions.length > 0) {
        for (const s of pin.sessions) {
          if (!s.start_time) continue;
          const [h, m] = s.start_time.split(":").map(Number);
          const start = h * 60 + m;
          let end = start + DEFAULT_DURATION;
          if (s.end_time) {
            const [eh, em] = s.end_time.split(":").map(Number);
            const candidateEnd = eh * 60 + em;
            if (candidateEnd > start) end = candidateEnd;
          }
          rawEntries.push({
            key: s.id,
            startMinutes: start,
            endMinutes: end,
            label: pin.title === s.title ? s.title : `${pin.title} - ${s.title}`,
            emoji: pin.emoji,
            color,
            cancelled,
            timeText: s.end_time ? `${formatMinutes(start)}〜${formatMinutes(end)}` : formatMinutes(start),
          });
        }
      } else if (pin.time_label) {
        const range = parseTimeLabelRange(pin.time_label);
        if (range) {
          rawEntries.push({
            key: pin.id,
            startMinutes: range.start,
            endMinutes: range.end,
            label: pin.title,
            emoji: pin.emoji,
            color,
            cancelled,
            timeText: pin.time_label,
          });
        } else {
          fallback.push({
            key: pin.id,
            time: pin.time_label,
            label: `${pin.title}（${pin.place_note}）`,
            emoji: pin.emoji,
            color,
            cancelled,
          });
        }
      }

      if (rawEntries.length === 0) continue;

      if (!rawByVenue.has(pin.place_note)) {
        venueOrder.push(pin.place_note);
        rawByVenue.set(pin.place_note, []);
      }
      rawByVenue.get(pin.place_note)!.push(...rawEntries);

      for (const e of rawEntries) {
        minStart = Math.min(minStart, e.startMinutes);
        maxEnd = Math.max(maxEnd, e.endMinutes);
      }
    }

    // 同じ会場内で時間帯が重なる項目は横に並べる(レーン割り当て)。会場列の幅は
    // 最大レーン数から決め、狭い場所に無理に収めて潰れないようにする(収まら
    // ない分は横スクロールで見る)。
    // 実データ上は重なっていなくても、MIN_BLOCK_HEIGHTの下限で見た目の高さが
    // 引き伸ばされるせいで、間隔の狭い項目同士が視覚的に重なることがある
    // (例: 5分間の項目が10分おきに並ぶ場合)。そのため「見た目上占有する時間」
    // をMIN_BLOCK_HEIGHT分だけ底上げしてからレーンの空き判定を行う。
    const minBlockMinutes = (MIN_BLOCK_HEIGHT / ROW_HEIGHT) * 60;
    const entriesByVenue = new Map<string, GridEntry[]>();
    const columnWidthByVenue = new Map<string, number>();
    for (const venue of venueOrder) {
      const raw = [...rawByVenue.get(venue)!].sort((a, b) => a.startMinutes - b.startMinutes);
      const laneEnds: number[] = [];
      const withLane: GridEntry[] = raw.map((e) => {
        const visualEnd = Math.max(e.endMinutes, e.startMinutes + minBlockMinutes);
        let lane = laneEnds.findIndex((end) => end <= e.startMinutes);
        if (lane === -1) {
          lane = laneEnds.length;
          laneEnds.push(visualEnd);
        } else {
          laneEnds[lane] = visualEnd;
        }
        return { ...e, lane, laneCount: 0 };
      });
      const laneCount = Math.max(laneEnds.length, 1);
      withLane.forEach((e) => (e.laneCount = laneCount));
      entriesByVenue.set(venue, withLane);
      columnWidthByVenue.set(venue, Math.max(MIN_COLUMN_WIDTH, laneCount * LANE_WIDTH));
    }

    const gridStart = Number.isFinite(minStart) ? Math.floor(minStart / 60) * 60 : 9 * 60;
    const gridEnd = Number.isFinite(maxEnd) ? Math.ceil(maxEnd / 60) * 60 : 18 * 60;

    return {
      venues: venueOrder,
      entriesByVenue,
      columnWidthByVenue,
      gridStart,
      gridEnd,
      fallbackRows: fallback,
    };
  }, [pins, categoryById, hiddenVenues]);

  if (venues.length === 0 && fallbackRows.length === 0) {
    return (
      <div className="empty-state">
        <p>タイムスケジュールに表示できるプログラムがありません。</p>
      </div>
    );
  }

  const hours: number[] = [];
  for (let t = gridStart; t <= gridEnd; t += 60) hours.push(t);
  const totalHeight = ((gridEnd - gridStart) / 60) * ROW_HEIGHT;

  return (
    <div className="schedule-view">
      {venues.length > 0 && (
        <div
          className="schedule-grid"
          style={{
            gridTemplateColumns: `56px ${venues
              .map((v) => `${columnWidthByVenue.get(v)}px`)
              .join(" ")}`,
          }}
        >
          <div className="schedule-grid-corner" />
          {venues.map((v) => (
            <div
              key={v}
              className="schedule-grid-venue-header"
              style={{ width: columnWidthByVenue.get(v) }}
            >
              {v}
            </div>
          ))}

          <div className="schedule-grid-hours" style={{ height: totalHeight }}>
            {hours.map((h) => (
              <div key={h} className="schedule-grid-hour-label" style={{ height: ROW_HEIGHT }}>
                {formatMinutes(h)}
              </div>
            ))}
          </div>

          {venues.map((venue) => (
            <div
              key={venue}
              className="schedule-grid-column"
              style={{ height: totalHeight, width: columnWidthByVenue.get(venue) }}
            >
              {hours.map((h) => (
                <div
                  key={h}
                  className="schedule-grid-line"
                  style={{ top: ((h - gridStart) / 60) * ROW_HEIGHT }}
                />
              ))}
              {entriesByVenue.get(venue)!.map((e) => (
                <div
                  key={e.key}
                  className="schedule-block"
                  style={{
                    top: ((e.startMinutes - gridStart) / 60) * ROW_HEIGHT,
                    height: Math.max(((e.endMinutes - e.startMinutes) / 60) * ROW_HEIGHT, MIN_BLOCK_HEIGHT),
                    left: e.lane * LANE_WIDTH,
                    width: LANE_WIDTH,
                    background: `color-mix(in srgb, ${e.color} 18%, var(--map-surface))`,
                    borderLeftColor: e.color,
                    opacity: e.cancelled ? 0.5 : 1,
                  }}
                >
                  <span className="schedule-block-time">{e.timeText}</span>
                  <span className="schedule-block-label">
                    {e.emoji} {e.label}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {fallbackRows.length > 0 && (
        <div className="schedule-fallback">
          <div className="schedule-fallback-title">時刻未定</div>
          <ul className="schedule-row-list">
            {fallbackRows.map((row) => (
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
        </div>
      )}
    </div>
  );
}
