import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db, newId } from '../db'
import type { Settings } from '../types'
import { useSettings } from '../hooks/useSettings'
import { sessionStats } from '../lib/oneRepMax'
import { assessLifts } from '../lib/standards'
import { formatWeight, formatWeightWithUnit, fromKg, toKg } from '../lib/units'
import { todayKey } from '../lib/nutrition'
import ProgressChart from '../components/ProgressChart'
import { IconScale, IconTrendingUp } from '../components/icons'

type Metric = '1rm' | 'top' | 'volume'

const METRICS: { key: Metric; label: string }[] = [
  { key: '1rm', label: 'Est. 1RM' },
  { key: 'top', label: 'Top set' },
  { key: 'volume', label: 'Volume' },
]

export default function ProgressScreen() {
  const settings = useSettings()
  const workouts = useLiveQuery(() => db.workouts.toArray(), []) ?? []
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? []
  const [selectedId, setSelectedId] = useState<string>('')
  const [metric, setMetric] = useState<Metric>('1rm')

  const finished = useMemo(
    () => workouts.filter((w) => w.finishedAt).sort((a, b) => b.startedAt - a.startedAt),
    [workouts],
  )
  const exercisesById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])

  // exercises that have logged data, most-trained first
  const trained = useMemo(() => {
    const counts = new Map<string, number>()
    for (const w of finished) {
      for (const e of w.entries) counts.set(e.exerciseId, (counts.get(e.exerciseId) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([exerciseId]) => ({
        id: exerciseId,
        name: exercisesById.get(exerciseId)?.name ?? 'Unknown exercise',
      }))
  }, [finished, exercisesById])

  const currentId = selectedId || trained[0]?.id || ''
  const stats = useMemo(() => sessionStats(finished, currentId), [finished, currentId])

  const chartData = useMemo(
    () =>
      stats.map((s) => {
        const kg = metric === '1rm' ? s.best1RmKg : metric === 'top' ? s.topSetKg : s.volumeKg
        return { date: s.date, value: Math.round(fromKg(kg, settings.units) * 10) / 10 }
      }),
    [stats, metric, settings.units],
  )

  const assessments = useMemo(
    () =>
      settings.bodyweightKg
        ? assessLifts(finished, exercisesById, settings.sex, settings.bodyweightKg)
        : [],
    [finished, exercisesById, settings],
  )

  async function deleteWorkout(id: string) {
    if (confirm('Delete this workout from your history?')) await db.workouts.delete(id)
  }

  if (finished.length === 0) {
    return (
      <div className="empty">
        <div style={{ color: 'var(--muted)', marginBottom: 8 }}>
          <IconTrendingUp size={36} />
        </div>
        Finish your first workout and your progress charts will show up here.
      </div>
    )
  }

  const best = stats.length ? Math.max(...stats.map((s) => s.best1RmKg)) : 0

  return (
    <>
      <h1>Progress</h1>

      <label className="field">
        <span>Exercise</span>
        <select value={currentId} onChange={(e) => setSelectedId(e.target.value)}>
          {trained.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <div className="metric-tabs">
        {METRICS.map((m) => (
          <button key={m.key} className={metric === m.key ? 'active' : ''} onClick={() => setMetric(m.key)}>
            {m.label}
          </button>
        ))}
      </div>

      {chartData.length >= 2 ? (
        <div className="card chart-card">
          <div className="chart-title">
            {METRICS.find((m) => m.key === metric)!.label} ({settings.units}
            {metric === 'volume' ? ' × reps' : ''})
          </div>
          <ProgressChart data={chartData} unitLabel={metric === 'volume' ? `${settings.units} volume` : settings.units} />
        </div>
      ) : (
        <p className="muted">Log this exercise in at least two workouts to draw a trend line.</p>
      )}

      <div className="card row" style={{ padding: 6 }}>
        <div className="stat-tile grow">
          <div className="value">{best > 0 ? formatWeight(best, settings.units) : '—'}</div>
          <div className="label">best est. 1RM ({settings.units})</div>
        </div>
        <div className="stat-tile grow">
          <div className="value">{stats.length}</div>
          <div className="label">sessions</div>
        </div>
        <div className="stat-tile grow">
          <div className="value">{finished.length}</div>
          <div className="label">total workouts</div>
        </div>
      </div>

      <h2>Strength standards</h2>
      {!settings.bodyweightKg ? (
        <p className="muted">
          Set your bodyweight in{' '}
          <Link className="text-link" to="/settings">
            Settings
          </Link>{' '}
          to compare your lifts against strength standards.
        </p>
      ) : assessments.length === 0 ? (
        <p className="muted">
          Log a barbell squat, bench press, deadlift, overhead press, or row and you'll see how you stack up here.
        </p>
      ) : (
        assessments.map((a) => (
          <div className="card" key={a.lift.key}>
            <div className="row-between">
              <strong>{a.lift.label}</strong>
              <span className="ink2 small">
                {formatWeightWithUnit(a.best1RmKg, settings.units)} · {a.level}
              </span>
            </div>
            <div className="meter" style={{ margin: '10px 0 6px' }}>
              <div className="meter-fill" style={{ width: `${Math.max(4, a.progressToNext * 100)}%` }} />
            </div>
            <div className="muted small">
              {a.nextLevel && a.next1RmKg
                ? `${formatWeightWithUnit(a.next1RmKg, settings.units)} est. 1RM reaches ${a.nextLevel}`
                : 'Elite — top of the standards table 🏆'}
            </div>
          </div>
        ))
      )}
      <p className="muted small">
        Levels compare your best estimated 1RM to bodyweight-ratio standards (Untrained → Elite).
      </p>

      <BodyweightSection settings={settings} />

      <h2>History</h2>
      {finished.map((w) => {
        const sets = w.entries.flatMap((e) => e.sets)
        const volume = sets.reduce((sum, s) => sum + s.weightKg * s.reps, 0)
        return (
          <div className="card" key={w.id}>
            <div className="row-between">
              <div className="grow">
                <div>{w.routineName ?? 'Workout'}</div>
                <div className="muted small">
                  {new Date(w.startedAt).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                  {' · '}
                  {w.entries.length} exercises · {sets.length} sets · {formatWeight(volume, settings.units)}{' '}
                  {settings.units} volume
                </div>
              </div>
              <button className="btn-icon btn-ghost" onClick={() => deleteWorkout(w.id)} aria-label="Delete workout">
                ✕
              </button>
            </div>
            <div className="muted small" style={{ marginTop: 6 }}>
              {w.entries.map((e) => e.exerciseName).join(' · ')}
            </div>
          </div>
        )
      })}
    </>
  )
}

function BodyweightSection({ settings }: { settings: Settings }) {
  const [logOpen, setLogOpen] = useState(false)
  const [weightStr, setWeightStr] = useState('')
  const logs = useLiveQuery(() => db.bodyLogs.orderBy('date').toArray(), []) ?? []

  const chartData = useMemo(
    () =>
      logs.map((l) => {
        const [y, m, d] = l.date.split('-').map(Number)
        return { date: new Date(y, m - 1, d).getTime(), value: Math.round(fromKg(l.weightKg, settings.units) * 10) / 10 }
      }),
    [logs, settings.units],
  )

  async function logWeight() {
    const parsed = parseFloat(weightStr)
    if (!Number.isFinite(parsed) || parsed <= 0) return
    const weightKg = toKg(parsed, settings.units)
    const today = todayKey()
    const existing = await db.bodyLogs.where('date').equals(today).first()
    if (existing) await db.bodyLogs.update(existing.id, { weightKg, loggedAt: Date.now() })
    else await db.bodyLogs.add({ id: newId(), date: today, weightKg, loggedAt: Date.now() })
    // keep strength standards + TDEE in sync with the newest weigh-in
    await db.settings.put({ ...settings, bodyweightKg: weightKg })
    setLogOpen(false)
    setWeightStr('')
  }

  const latest = logs[logs.length - 1]

  return (
    <>
      <h2>Bodyweight</h2>
      <div className="card">
        <div className="row-between">
          <div className="row" style={{ color: 'var(--ink-2)' }}>
            <IconScale size={20} />
            <span>
              {latest
                ? `${formatWeightWithUnit(latest.weightKg, settings.units)}`
                : settings.bodyweightKg
                  ? `${formatWeightWithUnit(settings.bodyweightKg, settings.units)} (from Settings)`
                  : 'Not set'}
            </span>
          </div>
          <button className="btn-ghost" onClick={() => {
            setWeightStr(
              latest || settings.bodyweightKg
                ? formatWeight((latest?.weightKg ?? settings.bodyweightKg)!, settings.units)
                : '',
            )
            setLogOpen(true)
          }}>
            Log weight
          </button>
        </div>
        {chartData.length >= 2 && (
          <div style={{ marginTop: 8 }}>
            <ProgressChart data={chartData} unitLabel={settings.units} />
          </div>
        )}
        {chartData.length < 2 && (
          <p className="muted small" style={{ marginBottom: 0 }}>
            Log your weight regularly to see a trend line. Weigh-ins also keep your strength standards and calorie
            targets accurate.
          </p>
        )}
      </div>

      {logOpen && (
        <div className="modal-overlay" onClick={() => setLogOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="row-between">
              <strong>Log bodyweight</strong>
              <button className="btn-ghost" onClick={() => setLogOpen(false)}>
                Close
              </button>
            </div>
            <div className="modal-body">
              <label className="field">
                <span>Today's weight ({settings.units})</span>
                <input inputMode="decimal" autoFocus value={weightStr} onChange={(e) => setWeightStr(e.target.value)} />
              </label>
              <button className="btn-primary btn-wide" disabled={!(parseFloat(weightStr) > 0)} onClick={logWeight}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
