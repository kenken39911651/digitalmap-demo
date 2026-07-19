import type { Pin, PinTransitStop } from "@/lib/types";

// pin_transit_stopsはpin_idにunique制約があり1:1のはずだが、Supabaseの
// ネスト選択は関係によって配列/単一オブジェクトのどちらで返るか環境依存の
// 揺れがあるため、どちらで来ても単一オブジェクト(またはnull)に正規化する。
export function normalizePinTransitStops(pins: Pin[]): Pin[] {
  return pins.map((pin) => {
    const raw = pin.transit_stop as unknown;
    const normalized: PinTransitStop | null = Array.isArray(raw)
      ? ((raw[0] as PinTransitStop | undefined) ?? null)
      : ((raw as PinTransitStop | null | undefined) ?? null);
    return { ...pin, transit_stop: normalized };
  });
}
