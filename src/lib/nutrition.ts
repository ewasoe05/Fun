import type { ActivityLevel, Goal, MacroSet, Settings } from '../types'

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
}

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary (little exercise)',
  light: 'Light (1–3 workouts/week)',
  moderate: 'Moderate (3–5 workouts/week)',
  active: 'Active (6–7 workouts/week)',
  veryActive: 'Very active (physical job + training)',
}

const GOAL_ADJUST: Record<Goal, number> = { cut: -500, maintain: 0, bulk: 300 }

export const GOAL_LABELS: Record<Goal, string> = {
  cut: 'Lose fat (−500 kcal)',
  maintain: 'Maintain',
  bulk: 'Build muscle (+300 kcal)',
}

/**
 * Suggested daily targets: Mifflin-St Jeor BMR × activity factor, adjusted for
 * the goal; protein 1.8 g/kg bodyweight, fat 25% of calories, carbs the rest.
 * Returns null when settings are missing a required input.
 */
export function suggestTargets(s: Settings): MacroSet | null {
  if (!s.bodyweightKg || !s.heightCm || !s.birthYear || !s.activityLevel || !s.goal) return null
  const age = new Date().getFullYear() - s.birthYear
  if (age < 10 || age > 100) return null
  const bmr = 10 * s.bodyweightKg + 6.25 * s.heightCm - 5 * age + (s.sex === 'male' ? 5 : -161)
  const kcal = Math.round(bmr * ACTIVITY_FACTORS[s.activityLevel] + GOAL_ADJUST[s.goal])
  const protein = Math.round(1.8 * s.bodyweightKg)
  const fat = Math.round((kcal * 0.25) / 9)
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4))
  return { kcal, protein, carbs, fat }
}

export function scalePer100g(per100g: MacroSet, grams: number): MacroSet {
  const f = grams / 100
  return {
    kcal: Math.round(per100g.kcal * f),
    protein: Math.round(per100g.protein * f * 10) / 10,
    carbs: Math.round(per100g.carbs * f * 10) / 10,
    fat: Math.round(per100g.fat * f * 10) / 10,
  }
}

export function sumMacros(items: MacroSet[]): MacroSet {
  return items.reduce(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

// ---- date helpers for the diary & plan ----

export function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayKey(): string {
  return toDateKey(new Date())
}

export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return toDateKey(dt)
}

/** Monday of the week containing dateKey. */
export function weekStart(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const dow = (dt.getDay() + 6) % 7 // Mon=0
  dt.setDate(dt.getDate() - dow)
  return toDateKey(dt)
}

export function formatDateKey(dateKey: string, opts?: Intl.DateTimeFormatOptions): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, opts ?? { weekday: 'short', month: 'short', day: 'numeric' })
}
