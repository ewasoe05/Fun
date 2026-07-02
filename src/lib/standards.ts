import standardsData from '../data/strength-standards.json'
import type { Exercise, Sex, Workout } from '../types'
import { epley1RM } from './oneRepMax'

export interface LiftStandard {
  key: string
  label: string
  patterns: string[]
  excludePatterns: string[]
  ratios: Record<Sex, number[]>
}

export const LEVELS: string[] = standardsData.levels
export const LIFTS: LiftStandard[] = standardsData.lifts as LiftStandard[]

export function matchesLift(lift: LiftStandard, exerciseName: string): boolean {
  const name = exerciseName.toLowerCase()
  if (lift.excludePatterns.some((p) => name.includes(p))) return false
  return lift.patterns.some((p) => name.includes(p))
}

export interface LiftAssessment {
  lift: LiftStandard
  best1RmKg: number
  ratio: number
  /** -1 = below the first threshold ("Untrained" not yet reached) */
  levelIndex: number
  level: string
  /** 0..1 progress from current threshold toward the next level's threshold */
  progressToNext: number
  nextLevel?: string
  next1RmKg?: number
}

/**
 * Best estimated 1RM per standard lift across all finished workouts,
 * assessed against bodyweight-ratio strength standards.
 */
export function assessLifts(
  workouts: Workout[],
  exercisesById: Map<string, Exercise>,
  sex: Sex,
  bodyweightKg: number,
): LiftAssessment[] {
  const out: LiftAssessment[] = []
  for (const lift of LIFTS) {
    let best = 0
    for (const w of workouts) {
      if (!w.finishedAt) continue
      for (const entry of w.entries) {
        const name = exercisesById.get(entry.exerciseId)?.name ?? entry.exerciseName
        if (!matchesLift(lift, name)) continue
        for (const s of entry.sets) {
          if (s.done) best = Math.max(best, epley1RM(s.weightKg, s.reps))
        }
      }
    }
    if (best <= 0) continue

    const thresholds = lift.ratios[sex].map((r) => r * bodyweightKg)
    const ratio = best / bodyweightKg
    let levelIndex = -1
    for (let i = 0; i < thresholds.length; i++) {
      if (best >= thresholds[i]) levelIndex = i
    }
    const atTop = levelIndex >= thresholds.length - 1
    const floor = levelIndex < 0 ? 0 : thresholds[levelIndex]
    const ceil = atTop ? thresholds[thresholds.length - 1] : thresholds[levelIndex + 1]
    out.push({
      lift,
      best1RmKg: best,
      ratio,
      levelIndex,
      level: levelIndex < 0 ? 'Below untrained' : LEVELS[levelIndex],
      progressToNext: atTop ? 1 : Math.min(1, Math.max(0, (best - floor) / (ceil - floor))),
      nextLevel: atTop ? undefined : LEVELS[levelIndex + 1],
      next1RmKg: atTop ? undefined : ceil,
    })
  }
  return out
}
