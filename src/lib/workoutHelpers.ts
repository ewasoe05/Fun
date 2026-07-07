import { db, getSettings, newId } from '../db'
import type { Routine, SetLog, Workout, WorkoutEntry } from '../types'
import { suggestNextSets, type SuggestResult } from './coach'
import { findSubstitutes, generateWorkout, getActiveGym, isAvailable } from './equipment'

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
  const settings = await getSettings()
  const gym = getActiveGym(settings)
  const library = gym ? await db.exercises.toArray() : []

  const entries: WorkoutEntry[] = []
  if (routine) {
    for (const en of routine.entries) {
      let ex = await db.exercises.get(en.exerciseId)
      let subbedFrom: string | undefined
      // adapt to the active gym's equipment
      if (ex && gym && !isAvailable(ex, gym)) {
        const sub = findSubstitutes(ex, gym, library)[0]
        if (sub) {
          subbedFrom = ex.name
          ex = sub
        }
      }
      const exerciseId = ex?.id ?? en.exerciseId
      const built = await buildSets(exerciseId, en.targetSets, en.targetReps)
      entries.push({
        exerciseId,
        exerciseName: ex?.name ?? 'Unknown exercise',
        sets: built.sets,
        suggestion: built.suggestion,
        subbedFrom,
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

/** Generate and start a full-body session from the active gym's equipment. */
export async function startQuickWorkout(): Promise<Workout> {
  const settings = await getSettings()
  const gym = getActiveGym(settings)
  const library = await db.exercises.toArray()
  const workouts = await db.workouts.toArray()
  const picks = generateWorkout(gym, library, workouts)

  const entries: WorkoutEntry[] = []
  for (const ex of picks) {
    const built = await buildSets(ex.id, 3, 10)
    entries.push({ exerciseId: ex.id, exerciseName: ex.name, sets: built.sets, suggestion: built.suggestion })
  }
  const workout: Workout = {
    id: newId(),
    startedAt: Date.now(),
    routineName: `Quick workout · ${gym?.name ?? 'Full gym'}`,
    entries,
  }
  await db.workouts.add(workout)
  return workout
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}
