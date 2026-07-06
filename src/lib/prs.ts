import type { Workout } from '../types'
import { epley1RM } from './oneRepMax'

/** Best estimated 1RM for an exercise across finished workouts started before atTime. */
export function bestBefore(workouts: Workout[], exerciseId: string, atTime: number): number {
  let best = 0
  for (const w of workouts) {
    if (!w.finishedAt || w.startedAt >= atTime) continue
    for (const entry of w.entries) {
      if (entry.exerciseId !== exerciseId) continue
      for (const s of entry.sets) {
        if (s.done) best = Math.max(best, epley1RM(s.weightKg, s.reps))
      }
    }
  }
  return best
}

export interface PRRecord {
  exerciseId: string
  exerciseName: string
  weightKg: number
  reps: number
  oneRmKg: number
  date: number
}

/**
 * Personal records: sessions whose best estimated 1RM for an exercise beat all
 * previous sessions. The first-ever session of an exercise is a baseline, not a PR.
 */
export function recentPRs(workouts: Workout[], limit = 3): PRRecord[] {
  const finished = workouts.filter((w) => w.finishedAt).sort((a, b) => a.startedAt - b.startedAt)
  const best = new Map<string, number>()
  const prs: PRRecord[] = []
  for (const w of finished) {
    for (const entry of w.entries) {
      let sessionBest = 0
      let bestSet: { weightKg: number; reps: number } | null = null
      for (const s of entry.sets) {
        if (!s.done) continue
        const rm = epley1RM(s.weightKg, s.reps)
        if (rm > sessionBest) {
          sessionBest = rm
          bestSet = s
        }
      }
      if (!bestSet || sessionBest <= 0) continue
      const prev = best.get(entry.exerciseId)
      if (prev !== undefined && sessionBest > prev) {
        prs.push({
          exerciseId: entry.exerciseId,
          exerciseName: entry.exerciseName,
          weightKg: bestSet.weightKg,
          reps: bestSet.reps,
          oneRmKg: sessionBest,
          date: w.startedAt,
        })
      }
      if (prev === undefined || sessionBest > prev) best.set(entry.exerciseId, sessionBest)
    }
  }
  return prs.sort((a, b) => b.date - a.date).slice(0, limit)
}
