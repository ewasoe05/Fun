import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../db'
import { useSettings } from '../hooks/useSettings'
import { sessionStats } from '../lib/oneRepMax'
import { formatWeightWithUnit, formatWeight, fromKg } from '../lib/units'
import { youtubeFormSearchUrl } from '../api/wger'
import ProgressChart from '../components/ProgressChart'
import { IconPlay } from '../components/icons'

export default function ExerciseDetailScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const settings = useSettings()
  const exercise = useLiveQuery(() => db.exercises.get(id!), [id])
  const workouts = useLiveQuery(() => db.workouts.toArray(), []) ?? []

  const stats = useMemo(() => (id ? sessionStats(workouts, id) : []), [workouts, id])
  const chartData = useMemo(
    () => stats.map((s) => ({ date: s.date, value: Math.round(fromKg(s.best1RmKg, settings.units) * 10) / 10 })),
    [stats, settings.units],
  )

  if (!exercise) return null
  const best = stats.length ? Math.max(...stats.map((s) => s.best1RmKg)) : 0

  return (
    <>
      <div className="row" style={{ margin: '8px 0 12px' }}>
        <button className="btn-ghost" onClick={() => navigate(-1)}>
          ‹ Back
        </button>
      </div>
      <h1 style={{ margin: '0 0 12px' }}>{exercise.name}</h1>

      {exercise.imageUrl && <img className="exercise-img" src={exercise.imageUrl} alt={exercise.name} />}

      <div style={{ margin: '12px 0' }}>
        {[...new Set([exercise.category, exercise.equipment, ...exercise.primaryMuscles].filter(Boolean))].map((p) => (
          <span key={p} className="pill">
            {p}
          </span>
        ))}
      </div>

      {exercise.instructions && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>How to do it</h2>
          <p className="instructions" style={{ margin: 0 }}>
            {exercise.instructions}
          </p>
        </div>
      )}

      {exercise.videoUrl && (
        <a className="list-item" href={exercise.videoUrl} target="_blank" rel="noreferrer">
          <span style={{ color: 'var(--accent)' }}>
            <IconPlay size={22} />
          </span>
          <div className="grow">
            <div>Watch demo video</div>
            <div className="muted">From the wger.de exercise database</div>
          </div>
        </a>
      )}
      <a
        className="list-item"
        href={youtubeFormSearchUrl(exercise.name)}
        target="_blank"
        rel="noreferrer"
      >
        <span style={{ color: 'var(--accent)' }}>
          <IconPlay size={22} />
        </span>
        <div className="grow">
          <div>Watch form videos</div>
          <div className="muted">Opens a YouTube search for “{exercise.name} proper form”</div>
        </div>
      </a>

      {stats.length > 0 && (
        <div className="card chart-card">
          <div className="chart-title">Estimated 1RM ({settings.units})</div>
          <ProgressChart data={chartData} unitLabel={settings.units} />
        </div>
      )}

      {best > 0 && (
        <p className="muted">
          Best estimated 1RM: <strong className="ink2">{formatWeightWithUnit(best, settings.units)}</strong> across{' '}
          {stats.length} session{stats.length === 1 ? '' : 's'}.
        </p>
      )}

      {stats.length > 0 && (
        <>
          <h2>Recent sessions</h2>
          {[...stats].reverse().slice(0, 8).map((s) => (
            <div className="card" key={s.date}>
              <div className="row-between">
                <span className="ink2 small">
                  {new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="muted small">top {formatWeightWithUnit(s.topSetKg, settings.units)}</span>
              </div>
              <div className="muted small" style={{ marginTop: 6 }}>
                {s.sets.map((set) => `${formatWeight(set.weightKg, settings.units)}×${set.reps}`).join('  ·  ')}
              </div>
            </div>
          ))}
        </>
      )}

      {exercise.source === 'wger' && (
        <p className="muted small">Exercise data from wger.de (CC-BY-SA).</p>
      )}
    </>
  )
}
