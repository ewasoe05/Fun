import type { Units } from '../types'

export const BAR_OPTIONS: Record<Units, number[]> = {
  lb: [45, 35, 15],
  kg: [20, 15, 10],
}

export const PLATE_SIZES: Record<Units, number[]> = {
  lb: [45, 35, 25, 10, 5, 2.5],
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
}

export interface PlateBreakdown {
  /** plates for ONE side of the bar, heaviest first (repeats allowed) */
  perSide: number[]
  /** weight that couldn't be loaded with available plates */
  remainder: number
  /** true when the target is lighter than the bar */
  belowBar: boolean
}

export function platesPerSide(targetWeight: number, barWeight: number, units: Units): PlateBreakdown {
  const half = (targetWeight - barWeight) / 2
  if (half < 0) return { perSide: [], remainder: 0, belowBar: true }
  let left = half
  const perSide: number[] = []
  for (const plate of PLATE_SIZES[units]) {
    while (left >= plate - 1e-9) {
      perSide.push(plate)
      left -= plate
    }
  }
  return { perSide, remainder: Math.round(left * 2 * 100) / 100, belowBar: false }
}
