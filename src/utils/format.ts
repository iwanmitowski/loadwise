// Number formatting helpers shared by the UI screens (T10 setup/planning, T16
// report). Domain values stay integer cm / kg — converting to human units
// (metres, percent, thousands separators) happens only here, at display time.

import type { Dimensions } from '@/types'

/** Integer centimetres → metres with 1 decimal: `620` → `"6.2 m"`. */
export function fmtM(cm: number): string {
  return `${(cm / 100).toFixed(1)} m`
}

/** Kilograms with thousands separators: `5000` → `"5,000 kg"`. */
export function fmtKg(kg: number): string {
  return `${withThousands(Math.round(kg))} kg`
}

/** Ratio → rounded percent: `0.834` → `"83%"`. May exceed 100%. */
export function fmtPct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`
}

/** Cubic centimetres → cubic metres with 2 decimals: `340000` → `"0.34 m³"`. */
export function fmtM3(cm3: number): string {
  return `${(cm3 / 1_000_000).toFixed(2)} m³`
}

/** Cargo-space dimensions as `"W × H × D m"` (each cm→m, 1 decimal). */
export function fmtDims({ width, height, depth }: Dimensions): string {
  const m = (cm: number) => (cm / 100).toFixed(1)
  return `${m(width)} × ${m(height)} × ${m(depth)} m`
}

/** `1234567` → `"1,234,567"` — deterministic, locale-independent. */
function withThousands(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
