import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db'
import type { Exercise, SetLog, Settings, Workout } from '../types'
import { useSettings } from '../hooks/useSettings'
import { buildSets, formatDuration, lastSessionSets, startWorkout } from '../lib/workoutHelpers'
import { formatWeight } from '../lib/units'
import SetRow from '../components/SetRow'
import RestTimer from '../components/RestTimer'
import ExercisePicker from '../components/ExercisePicker'

export default function WorkoutScreen() {
  // resolve to null (not undefined) so "no active workout" is distinguishable from "query loading"
  const active = useLiveQuery(async () => (await db.workouts.filter((w) => !w.finishedAt).first()) ?? null, [])
  const routines = useLiveQuery(() => db.routines.orderBy('createdAt').toArray(), []) ?? []
  const settings = useSettings()

  if (active === undefined) return null
  if (active) return <ActiveWorkout key={active.id} initial={active} settings={settings} />

  return (
    <>
      <h1>Start a workout</h1>
      <button className="btn-primary btn-wide" style={{ minHeight: 52 }} onClick={() => startWorkout()}>
        Start empty workout
      </button>
      <h2>From a routine</h2>
      {routines.length === 0 && (
        <div className="empty">
          <div className="big">📋</div>
          No routines yet.{' '}
          <Link className="text-link" to="/routines">
            Create one
          </Link>{' '}
          to pre-load your exercises.
        </div>
      )}
      {routines.map((r) => (
        <button key={r.id} className="list-item" onClick={() => startWorkout(r)}>
          <div className="grow">
            <div>{r.name}</div>
            <div className="muted">{r.entries.length} exercises</div>
          </div>
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Start</span>
        </button>
      ))}
    </>
  )
}

function ActiveWorkout({ initial, settings }: { initial: Workout; settings: Settings }) {
  const [workout, setWorkout] = useState(initial)
  const [rest, setRest] = useState<{ endsAt: number; total: number } | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Previous-session hints per exercise, loaded once per exercise list change
  const exerciseIds = workout.entries.map((e) => e.exerciseId).join(',')
  const [prevSets, setPrevSets] = useState<Record<string, SetLog[]>>({})
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const map: Record<string, SetLog[]> = {}
      for (const entry of workout.entries) {
        map[entry.exerciseId] = await lastSessionSets(entry.exerciseId)
      }
      if (!cancelled) setPrevSets(map)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseIds])

  const doneSets = useMemo(
    () => workout.entries.flatMap((e) => e.sets).filter((s) => s.done).length,
    [workout],
  )

  function update(next: Workout) {
    setWorkout(next)
    db.workouts.put(next)
  }

  function updateSet(entryIdx: number, setIdx: number, set: SetLog) {
    const wasDone = workout.entries[entryIdx].sets[setIdx].done
    const entries = workout.entries.map((e, i) =>
      i === entryIdx ? { ...e, sets: e.sets.map((s, j) => (j === setIdx ? set : s)) } : e,
    )
    update({ ...workout, entries })
    if (set.done && !wasDone) {
      setRest({ endsAt: Date.now() + settings.restSeconds * 1000, total: settings.restSeconds })
    }
  }

  function addSet(entryIdx: number) {
    const entries = workout.entries.map((e, i) => {
      if (i !== entryIdx) return e
      const last = e.sets[e.sets.length - 1]
      return { ...e, sets: [...e.sets, { weightKg: last?.weightKg ?? 0, reps: last?.reps ?? 0, done: false }] }
    })
    update({ ...workout, entries })
  }

  function removeLastSet(entryIdx: number) {
    const entries = workout.entries.map((e, i) => (i === entryIdx ? { ...e, sets: e.sets.slice(0, -1) } : e))
    update({ ...workout, entries: entries.filter((e) => e.sets.length > 0) })
  }

  function removeExercise(entryIdx: number) {
    update({ ...workout, entries: workout.entries.filter((_, i) => i !== entryIdx) })
  }

  async function addExercise(ex: Exercise) {
    setPickerOpen(false)
    const sets = await buildSets(ex.id, 3, 8)
    update({ ...workout, entries: [...workout.entries, { exerciseId: ex.id, exerciseName: ex.name, sets }] })
  }

  async function finish() {
    if (doneSets === 0) {
      if (confirm('No sets completed — discard this workout?')) await db.workouts.delete(workout.id)
      return
    }
    const entries = workout.entries
      .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) }))
      .filter((e) => e.sets.length > 0)
    await db.workouts.put({ ...workout, entries, finishedAt: Date.now() })
    setRest(null)
  }

  async function discard() {
    if (confirm('Discard this workout? Logged sets will be lost.')) {
      await db.workouts.delete(workout.id)
    }
  }

  return (
    <>
      <div className="workout-header row-between">
        <div>
          <strong>{workout.routineName ?? 'Workout'}</strong>
          <div className="muted duration">
            {formatDuration(now - workout.startedAt)} · {doneSets} {doneSets === 1 ? 'set' : 'sets'} done
          </div>
        </div>
        <button className="btn-primary" onClick={finish}>
          Finish
        </button>
      </div>

      {workout.entries.map((entry, ei) => (
        <div className="card" key={`${entry.exerciseId}-${ei}`}>
          <div className="row-between" style={{ marginBottom: 10 }}>
            <Link className="grow" to={`/exercises/${entry.exerciseId}`} style={{ color: 'var(--ink)', textDecoration: 'none', fontWeight: 600 }}>
              {entry.exerciseName}
            </Link>
            <button className="btn-icon btn-ghost" onClick={() => removeExercise(ei)} aria-label="Remove exercise">
              ✕
            </button>
          </div>
          <div className="set-grid set-head">
            <div>Set</div>
            <div>Previous</div>
            <div style={{ textAlign: 'center' }}>{settings.units}</div>
            <div style={{ textAlign: 'center' }}>Reps</div>
            <div />
          </div>
          {entry.sets.map((s, si) => {
            const prev = prevSets[entry.exerciseId]?.[si]
            return (
              <SetRow
                key={si}
                index={si}
                set={s}
                units={settings.units}
                prevHint={prev ? `${formatWeight(prev.weightKg, settings.units)} × ${prev.reps}` : undefined}
                onChange={(ns) => updateSet(ei, si, ns)}
              />
            )
          })}
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn-ghost grow" onClick={() => addSet(ei)}>
              + Add set
            </button>
            <button className="btn-ghost" onClick={() => removeLastSet(ei)}>
              −
            </button>
          </div>
        </div>
      ))}

      <button className="btn-wide" style={{ marginTop: 4 }} onClick={() => setPickerOpen(true)}>
        + Add exercise
      </button>
      <button className="btn-danger btn-wide" style={{ marginTop: 12 }} onClick={discard}>
        Discard workout
      </button>

      {pickerOpen && <ExercisePicker onSelect={addExercise} onClose={() => setPickerOpen(false)} />}
      {rest && (
        <RestTimer
          endsAt={rest.endsAt}
          totalSeconds={rest.total}
          onExtend={(s) => setRest({ endsAt: rest.endsAt + s * 1000, total: rest.total + s })}
          onClose={() => setRest(null)}
        />
      )}
    </>
  )
}
