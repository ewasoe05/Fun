import type { EquipKey, Exercise, GymProfile, Settings, Workout } from '../types'

export const EQUIPMENT_OPTIONS: { key: EquipKey; label: string }[] = [
  { key: 'barbell', label: 'Barbell & plates' },
  { key: 'dumbbell', label: 'Dumbbells' },
  { key: 'kettlebell', label: 'Kettlebells' },
  { key: 'machine', label: 'Machines' },
  { key: 'cable', label: 'Cable station' },
  { key: 'bench', label: 'Bench' },
  { key: 'pullupBar', label: 'Pull-up bar' },
  { key: 'bands', label: 'Resistance bands' },
]

export function getActiveGym(settings: Settings): GymProfile | null {
  if (!settings.activeGymId) return null
  return settings.gyms?.find((g) => g.id === settings.activeGymId) ?? null
}

const TOKEN_MAP: [RegExp, EquipKey][] = [
  [/barbell|sz-bar|ez[- ]bar/, 'barbell'],
  [/dumbbell/, 'dumbbell'],
  [/kettlebell/, 'kettlebell'],
  [/machine/, 'machine'],
  [/cable/, 'cable'],
  [/bench/, 'bench'],
  [/pull-?up bar/, 'pullupBar'],
  [/band/, 'bands'],
]

/** Equipment an exercise needs, derived from its equipment field + name. Bodyweight = []. */
export function requiredEquipment(exercise: Exercise): EquipKey[] {
  const out = new Set<EquipKey>()
  const equip = (exercise.equipment ?? '').toLowerCase()
  for (const [re, key] of TOKEN_MAP) if (re.test(equip)) out.add(key)

  const name = exercise.name.toLowerCase()
  if (/pull-?up|chin-?up|hanging/.test(name)) out.add('pullupBar')
  if (/bench press|incline .*press|skull crusher|hip thrust/.test(name)) out.add('bench')
  if (/\bdips?\b/.test(name) && !/chair/.test(name)) out.add('bench')
  return [...out]
}

export function isAvailable(exercise: Exercise, gym: GymProfile | null): boolean {
  if (!gym) return true
  const have = new Set(gym.equipment)
  return requiredEquipment(exercise).every((k) => have.has(k))
}

/** Ordered name preferences that guarantee sensible swaps for the big lifts. */
const CURATED: [RegExp, string[]][] = [
  [/incline (bench|barbell) press|incline bench/, ['Incline Dumbbell Press', 'Pike Push-Up', 'Push-Up']],
  [/bench press/, ['Dumbbell Bench Press', 'Push-Up', 'Cable Chest Fly']],
  [/squat/, ['Goblet Squat', 'Leg Press', 'Bulgarian Split Squat', 'Split Squat', 'Bodyweight Squat']],
  [/deadlift/, ['Romanian Deadlift', 'Hip Thrust', 'Leg Curl', 'Glute Bridge']],
  [/overhead press|military press|strict press/, ['Dumbbell Shoulder Press', 'Pike Push-Up', 'Lateral Raise']],
  [/barbell row|bent[- ]over row|pendlay/, ['Dumbbell Row', 'Seated Cable Row', 'Inverted Row', 'Lat Pulldown']],
  [/pull-?up|chin-?up|lat pulldown/, ['Lat Pulldown', 'Dumbbell Row', 'Inverted Row', 'Seated Cable Row']],
  [/barbell curl|preacher curl/, ['Dumbbell Curl', 'Hammer Curl']],
  [/skull crusher|close-grip bench/, ['Triceps Pushdown', 'Chair Dip', 'Dip']],
  [/^dip$/, ['Chair Dip', 'Push-Up', 'Close-Grip Bench Press']],
]

function muscleOverlap(a: Exercise, b: Exercise): number {
  const setA = new Set(a.primaryMuscles.map((m) => m.toLowerCase()))
  return b.primaryMuscles.filter((m) => setA.has(m.toLowerCase())).length
}

/** Available alternatives for an exercise, best first. */
export function findSubstitutes(
  exercise: Exercise,
  gym: GymProfile | null,
  library: Exercise[],
  trainedIds: Set<string> = new Set(),
): Exercise[] {
  const name = exercise.name.toLowerCase()
  const out: Exercise[] = []
  const seen = new Set<string>([exercise.id])

  const curated = CURATED.find(([re]) => re.test(name))?.[1] ?? []
  for (const prefName of curated) {
    const match = library.find((e) => e.name.toLowerCase() === prefName.toLowerCase())
    if (match && !seen.has(match.id) && isAvailable(match, gym)) {
      out.push(match)
      seen.add(match.id)
    }
  }

  const scored = library
    .filter((e) => !seen.has(e.id) && isAvailable(e, gym) && muscleOverlap(exercise, e) > 0)
    .map((e) => ({
      e,
      score:
        muscleOverlap(exercise, e) * 2 +
        (e.category === exercise.category ? 1 : 0) +
        (trainedIds.has(e.id) ? 0.5 : 0),
    }))
    .sort((a, b) => b.score - a.score)
  for (const { e } of scored) {
    out.push(e)
    seen.add(e.id)
    if (out.length >= 5) break
  }

  // isolation moves can have unique muscle tags — fall back to same-category picks
  if (out.length < 3) {
    const sameCategory = library.filter(
      (e) => !seen.has(e.id) && e.category === exercise.category && isAvailable(e, gym),
    )
    for (const e of sameCategory) {
      out.push(e)
      if (out.length >= 5) break
    }
  }
  return out.slice(0, 5)
}

/** One solid pick per muscle group from whatever the gym has — a ready travel workout. */
export function generateWorkout(
  gym: GymProfile | null,
  library: Exercise[],
  workouts: Workout[],
): Exercise[] {
  const trainedCount = new Map<string, number>()
  for (const w of workouts) {
    if (!w.finishedAt) continue
    for (const e of w.entries) trainedCount.set(e.exerciseId, (trainedCount.get(e.exerciseId) ?? 0) + 1)
  }
  const picks: Exercise[] = []
  for (const category of ['Legs', 'Chest', 'Back', 'Shoulders', 'Core', 'Arms']) {
    const candidates = library
      .filter((e) => e.category === category && isAvailable(e, gym))
      .map((e) => ({
        e,
        score: (trainedCount.get(e.id) ?? 0) * 10 + (e.source === 'seed' ? 1 : 0) + e.primaryMuscles.length,
      }))
      .sort((a, b) => b.score - a.score)
    if (candidates.length > 0) picks.push(candidates[0].e)
  }
  return picks
}
