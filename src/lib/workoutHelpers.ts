import { db, getSettings, newId } from '../db'
import type { Routine, SetLog, Workout, WorkoutEntry } from '../types'
import { suggestNextSets, type SuggestResult } from './coach'

/** Done sets from the N most recent finished workouts that include this exercise (most recent first). */
export async function lastSessions(exerciseId: string, n: number): Promise<SetLog[][]> {
  const workouts = await db.workouts.orderBy('startedAt').reverse().toArray()
  const out: SetLog[][] = []
  for (const w of workouts) {
    if (!w.finishedAt) continue
    const sets = w.entries
      .filter((e) => e.exerciseId === exerciseId)
      .flatMap((e) => e.sets)
      .filter((s) => s.done)
    if (sets.length > 0) {
      out.push(sets)
      if (out.length >= n) break
    }
  }
  return out
}

/** Done sets from the most recent finished workout that includes this exercise. */
export async function lastSessionSets(exerciseId: string): Promise<SetLog[]> {
  return (await lastSessions(exerciseId, 1))[0] ?? []
}

/**
 * New unchecked sets for the next session. With the coach enabled (default),
 * weights auto-progress/deload per the coach rules; otherwise last session's
 * numbers are copied as before.
 */
export async function buildSets(exerciseId: string, targetSets: number, targetReps: number): Promise<SuggestResult> {
  const settings = await getSettings()
  const sessions = await lastSessions(exerciseId, 2)
  if (settings.coachEnabled === false) {
    const prev = sessions[0] ?? []
    return {
      sets: Array.from({ length: targetSets }, (_, i) => {
        const p = prev[i] ?? prev[prev.length - 1]
        return { weightKg: p?.weightKg ?? 0, reps: p?.reps ?? targetReps, done: false }
      }),
    }
  }
  const exercise = await db.exercises.get(exerciseId)
  return suggestNextSets(exercise, sessions, targetSets, targetReps, settings.units)
}

export async function startWorkout(routine?: Routine): Promise<Workout> {
  const entries: WorkoutEntry[] = []
  if (routine) {
    for (const en of routine.entries) {
      const ex = await db.exercises.get(en.exerciseId)
      const built = await buildSets(en.exerciseId, en.targetSets, en.targetReps)
      entries.push({
        exerciseId: en.exerciseId,
        exerciseName: ex?.name ?? 'Unknown exercise',
        sets: built.sets,
        suggestion: built.suggestion,
      })
    }
  }
  const workout: Workout = {
    id: newId(),
    startedAt: Date.now(),
    routineId: routine?.id,
    routineName: routine?.name,
    entries,
  }
  await db.workouts.add(workout)
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {})
  }
  return workout
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}
