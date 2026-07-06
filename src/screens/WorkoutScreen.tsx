import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db'
import type { Exercise, SetLog, Settings, Workout } from '../types'
import { useSettings } from '../hooks/useSettings'
import { buildSets, formatDuration, lastSessionSets, startWorkout } from '../lib/workoutHelpers'
import { formatWeight, fromKg } from '../lib/units'
import { addDays, toDateKey, todayKey, weekStart } from '../lib/nutrition'
import { epley1RM } from '../lib/oneRepMax'
import { bestBefore, recentPRs } from '../lib/prs'
import { analyze } from '../lib/coach'
import { getActiveProfile } from '../lib/profiles'
import InsightCard from '../components/InsightCard'
import SetRow from '../components/SetRow'
import RestTimer from '../components/RestTimer'
import ExercisePicker from '../components/ExercisePicker'
import PlateCalculator from '../components/PlateCalculator'
import Confetti from '../components/Confetti'
import Heatmap from '../components/Heatmap'
import { IconClipboard, IconPlates, IconTrophy } from '../components/icons'

export default function WorkoutScreen() {
  // resolve to null (not undefined) so "no active workout" is distinguishable from "query loading"
  const active = useLiveQuery(async () => (await db.workouts.filter((w) => !w.finishedAt).first()) ?? null, [])
  const settings = useSettings()

  if (active === undefined) return null
  if (active) return <ActiveWorkout key={active.id} initial={active} settings={settings} />
  return <Dashboard settings={settings} />
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Night session?'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function Dashboard({ settings }: { settings: Settings }) {
  const routines = useLiveQuery(() => db.routines.orderBy('createdAt').toArray(), []) ?? []
  const workouts = useLiveQuery(() => db.workouts.toArray(), []) ?? []
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? []
  const foodLogs = useLiveQuery(() => db.foodLogs.toArray(), []) ?? []
  const bodyLogs = useLiveQuery(() => db.bodyLogs.toArray(), []) ?? []

  const insights = useMemo(() => {
    if (settings.coachEnabled === false || !workouts.some((w) => w.finishedAt)) return []
    return analyze({
      workouts,
      exercisesById: new Map(exercises.map((e) => [e.id, e])),
      foodLogs,
      bodyLogs,
      settings,
    }).slice(0, 3)
  }, [workouts, exercises, foodLogs, bodyLogs, settings])

  const { thisWeek, lastWeek, prs } = useMemo(() => {
    const finished = workouts.filter((w) => w.finishedAt)
    const startKey = weekStart(todayKey())
    const prevKey = addDays(startKey, -7)
    const stats = (from: string, to: string) => {
      const ws = finished.filter((w) => {
        const d = toDateKey(new Date(w.startedAt))
        return d >= from && d < to
      })
      const sets = ws.flatMap((w) => w.entries.flatMap((e) => e.sets.filter((s) => s.done)))
      return {
        workouts: ws.length,
        sets: sets.length,
        volumeKg: sets.reduce((sum, s) => sum + s.weightKg * s.reps, 0),
      }
    }
    return {
      thisWeek: stats(startKey, addDays(startKey, 7)),
      lastWeek: stats(prevKey, startKey),
      prs: recentPRs(workouts, 3),
    }
  }, [workouts])

  const compact = (n: number) =>
    new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n)
  const delta = thisWeek.workouts - lastWeek.workouts

  const profile = getActiveProfile()

  return (
    <>
      <div className="row-between">
        <div>
          <div className="greeting">
            {greeting()}, {profile.name}
          </div>
          <div className="muted small" style={{ marginBottom: 16 }}>
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>
        <Link to="/settings" aria-label="Profiles" style={{ textDecoration: 'none' }}>
          <span className="avatar" style={{ background: profile.color }}>
            {(profile.name[0] ?? '?').toUpperCase()}
          </span>
        </Link>
      </div>

      <button className="btn-primary btn-wide" style={{ minHeight: 52 }} onClick={() => startWorkout()}>
        Start empty workout
      </button>

      {routines.length > 0 && <h2>From a routine</h2>}
      {routines.map((r) => (
        <button key={r.id} className="list-item" onClick={() => startWorkout(r)}>
          <div className="grow">
            <div>{r.name}</div>
            <div className="muted">{r.entries.length} exercises</div>
          </div>
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Start</span>
        </button>
      ))}
      {routines.length === 0 && (
        <div className="empty">
          <div style={{ color: 'var(--muted)', marginBottom: 8 }}>
            <IconClipboard size={36} />
          </div>
          No routines yet.{' '}
          <Link className="text-link" to="/routines">
            Create one
          </Link>{' '}
          to pre-load your exercises.
        </div>
      )}

      {insights.length > 0 && (
        <>
          <div className="row-between" style={{ marginTop: 20, marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>Coach</h2>
            <Link className="text-link small" to="/coach">
              All insights ›
            </Link>
          </div>
          {insights.map((i) => (
            <InsightCard key={i.id} insight={i} />
          ))}
        </>
      )}

      <h2>This week</h2>
      <div className="stat-row">
        <div className="stat-tile">
          <div className="value">{thisWeek.workouts}</div>
          <div className="label">workouts</div>
          {lastWeek.workouts > 0 && delta !== 0 && (
            <div className={delta > 0 ? 'delta-up' : 'delta-down'}>
              {delta > 0 ? '▲' : '▼'} {Math.abs(delta)} vs last wk
            </div>
          )}
        </div>
        <div className="stat-tile">
          <div className="value">{thisWeek.sets}</div>
          <div className="label">sets</div>
        </div>
        <div className="stat-tile">
          <div className="value">{compact(Math.round(fromKg(thisWeek.volumeKg, settings.units)))}</div>
          <div className="label">volume ({settings.units})</div>
        </div>
      </div>

      {workouts.some((w) => w.finishedAt) && (
        <>
          <h2>Consistency</h2>
          <div className="card">
            <Heatmap workouts={workouts} />
          </div>
        </>
      )}

      {prs.length > 0 && (
        <>
          <h2>Recent PRs</h2>
          {prs.map((pr) => (
            <Link
              key={`${pr.exerciseId}-${pr.date}`}
              className="list-item"
              to={`/exercises/${pr.exerciseId}`}
              style={{ alignItems: 'center' }}
            >
              <span className="pr-flash">
                <IconTrophy size={24} />
              </span>
              <div className="grow">
                <div>{pr.exerciseName}</div>
                <div className="muted">
                  {formatWeight(pr.weightKg, settings.units)} {settings.units} × {pr.reps} ·{' '}
                  {new Date(pr.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>
              </div>
              <span className="muted small">
                est. 1RM {formatWeight(pr.oneRmKg, settings.units)} {settings.units}
              </span>
            </Link>
          ))}
        </>
      )}
    </>
  )
}

function ActiveWorkout({ initial, settings }: { initial: Workout; settings: Settings }) {
  const [workout, setWorkout] = useState(initial)
  const [rest, setRest] = useState<{ endsAt: number; total: number } | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [platesFor, setPlatesFor] = useState<number | null>(null)
  const [prKeys, setPrKeys] = useState<Set<string>>(new Set())
  const [confetti, setConfetti] = useState(false)
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

  async function updateSet(entryIdx: number, setIdx: number, set: SetLog) {
    const entry = workout.entries[entryIdx]
    const wasDone = entry.sets[setIdx].done
    const entries = workout.entries.map((e, i) =>
      i === entryIdx ? { ...e, sets: e.sets.map((s, j) => (j === setIdx ? set : s)) } : e,
    )
    update({ ...workout, entries })
    if (set.done && !wasDone) {
      setRest({ endsAt: Date.now() + settings.restSeconds * 1000, total: settings.restSeconds })
      // PR check against all previous finished sessions
      const all = await db.workouts.toArray()
      const best = bestBefore(all, entry.exerciseId, Date.now())
      if (best > 0 && epley1RM(set.weightKg, set.reps) > best) {
        setPrKeys((prev) => new Set(prev).add(`${entryIdx}-${setIdx}`))
        setConfetti(true)
        navigator.vibrate?.([100, 60, 100, 60, 250])
      }
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
    const built = await buildSets(ex.id, 3, 8)
    update({
      ...workout,
      entries: [
        ...workout.entries,
        { exerciseId: ex.id, exerciseName: ex.name, sets: built.sets, suggestion: built.suggestion },
      ],
    })
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

  function plateWeightFor(entryIdx: number): number {
    const kg = Math.max(0, ...workout.entries[entryIdx].sets.map((s) => s.weightKg))
    return kg > 0 ? Math.round(fromKg(kg, settings.units) * 10) / 10 : 0
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
            <button className="btn-icon btn-ghost" onClick={() => setPlatesFor(ei)} aria-label="Plate calculator">
              <IconPlates size={18} />
            </button>
            <button className="btn-icon btn-ghost" onClick={() => removeExercise(ei)} aria-label="Remove exercise">
              ✕
            </button>
          </div>
          {entry.suggestion && (
            <div
              className={`suggest-chip ${entry.suggestion.change === 'down' ? 'suggest-down' : 'suggest-up'}`}
              style={{ marginBottom: 10 }}
            >
              {entry.suggestion.change === 'down' ? '▼' : '▲'}{' '}
              {entry.suggestion.change === 'up'
                ? `+${entry.suggestion.deltaDisplay} ${settings.units}`
                : entry.suggestion.change === 'reps'
                  ? `+${entry.suggestion.deltaDisplay} rep`
                  : `−${entry.suggestion.deltaDisplay} ${settings.units}`}{' '}
              · {entry.suggestion.reason}
            </div>
          )}
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
                pr={prKeys.has(`${ei}-${si}`)}
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
      {platesFor !== null && (
        <PlateCalculator
          initialWeight={plateWeightFor(platesFor)}
          units={settings.units}
          onClose={() => setPlatesFor(null)}
        />
      )}
      {confetti && <Confetti onDone={() => setConfetti(false)} />}
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
