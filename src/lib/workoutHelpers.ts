import { db, newId } from '../db'
import type { Routine, SetLog, Workout, WorkoutEntry } from '../types'

/** Done sets from the most recent finished workout that includes this exercise. */
export async function lastSessionSets(exerciseId: string): Promise<SetLog[]> {
  const workouts = await db.workouts.orderBy('startedAt').reverse().toArray()
  for (const w of workouts) {
    if (!w.finishedAt) continue
    const sets = w.entries
      .filter((e) => e.exerciseId === exerciseId)
      .flatMap((e) => e.sets)
      .filter((s) => s.done)
    if (sets.length > 0) return sets
  }
  return []
}

/** New unchecked sets, pre-filled from the previous session (falling back to targets). */
export async function buildSets(exerciseId: string, targetSets: number, targetReps: number): Promise<SetLog[]> {
  const prev = await lastSessionSets(exerciseId)
  return Array.from({ length: targetSets }, (_, i) => {
    const p = prev[i] ?? prev[prev.length - 1]
    return { weightKg: p?.weightKg ?? 0, reps: p?.reps ?? targetReps, done: false }
  })
}

export async function startWorkout(routine?: Routine): Promise<Workout> {
  const entries: WorkoutEntry[] = []
  if (routine) {
    for (const en of routine.entries) {
      const ex = await db.exercises.get(en.exerciseId)
      entries.push({
        exerciseId: en.exerciseId,
        exerciseName: ex?.name ?? 'Unknown exercise',
        sets: await buildSets(en.exerciseId, en.targetSets, en.targetReps),
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
