import type { Units } from '../types'

export const KG_PER_LB = 0.45359237

export function toKg(value: number, units: Units): number {
  return units === 'kg' ? value : value * KG_PER_LB
}

export function fromKg(kg: number, units: Units): number {
  return units === 'kg' ? kg : kg / KG_PER_LB
}

/** Weight in display units, rounded to 1 decimal, without a trailing ".0". */
export function formatWeight(kg: number, units: Units): string {
  const v = Math.round(fromKg(kg, units) * 10) / 10
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

export function formatWeightWithUnit(kg: number, units: Units): string {
  return `${formatWeight(kg, units)} ${units}`
}

export const CM_PER_IN = 2.54

export function cmToFtIn(cm: number): { ft: number; inches: number } {
  const totalIn = Math.round(cm / CM_PER_IN)
  return { ft: Math.floor(totalIn / 12), inches: totalIn % 12 }
}

export function ftInToCm(ft: number, inches: number): number {
  return Math.round((ft * 12 + inches) * CM_PER_IN * 10) / 10
}
