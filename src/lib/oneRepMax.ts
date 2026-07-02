import type { Workout } from '../types'

/** Epley estimated one-rep max. For a single rep it's just the weight itself. */
export function epley1RM(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30)
}

export interface ExerciseSessionStats {
  date: number
  best1RmKg: number
  topSetKg: number
  volumeKg: number
  sets: { weightKg: number; reps: number }[]
}

/** Per-session stats for one exercise across a list of finished workouts. */
export function sessionStats(workouts: Workout[], exerciseId: string): ExerciseSessionStats[] {
  const out: ExerciseSessionStats[] = []
  for (const w of workouts) {
    if (!w.finishedAt) continue
    const sets = w.entries
      .filter((e) => e.exerciseId === exerciseId)
      .flatMap((e) => e.sets)
      .filter((s) => s.done && s.reps > 0)
    if (sets.length === 0) continue
    out.push({
      date: w.startedAt,
      best1RmKg: Math.max(...sets.map((s) => epley1RM(s.weightKg, s.reps))),
      topSetKg: Math.max(...sets.map((s) => s.weightKg)),
      volumeKg: sets.reduce((sum, s) => sum + s.weightKg * s.reps, 0),
      sets: sets.map((s) => ({ weightKg: s.weightKg, reps: s.reps })),
    })
  }
  return out.sort((a, b) => a.date - b.date)
}
