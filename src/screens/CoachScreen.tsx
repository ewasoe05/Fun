import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db'
import { useSettings } from '../hooks/useSettings'
import { analyze } from '../lib/coach'
import InsightCard from '../components/InsightCard'

export default function CoachScreen() {
  const navigate = useNavigate()
  const settings = useSettings()
  const workouts = useLiveQuery(() => db.workouts.toArray(), []) ?? []
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? []
  const foodLogs = useLiveQuery(() => db.foodLogs.toArray(), []) ?? []
  const bodyLogs = useLiveQuery(() => db.bodyLogs.toArray(), []) ?? []

  const insights = useMemo(
    () =>
      analyze({
        workouts,
        exercisesById: new Map(exercises.map((e) => [e.id, e])),
        foodLogs,
        bodyLogs,
        settings,
      }),
    [workouts, exercises, foodLogs, bodyLogs, settings],
  )

  return (
    <>
      <div className="row" style={{ margin: '8px 0 12px' }}>
        <button className="btn-ghost" onClick={() => navigate(-1)}>
          ‹ Back
        </button>
      </div>
      <h1 style={{ margin: '0 0 12px' }}>Coach</h1>

      {insights.map((i) => (
        <InsightCard key={i.id} insight={i} />
      ))}

      <h2>How the coach thinks</h2>
      <div className="card muted small" style={{ lineHeight: 1.6 }}>
        Everything is computed on your phone from your own logs — nothing leaves the device.
        <br />• <strong className="ink2">Weights</strong>: hit every target rep and the next session pre-fills a small
        increase (bigger for squats/deadlifts). Miss reps two sessions in a row at the same weight and it pre-fills a
        ~10% deload. Bodyweight moves progress by reps.
        <br />• <strong className="ink2">Stalls</strong>: three sessions without a new estimated 1RM get flagged.
        <br />• <strong className="ink2">Balance & consistency</strong>: two-week muscle-group volume and your weekly
        workout rate vs your own average.
        <br />• <strong className="ink2">Nutrition & weight</strong>: average calories/protein on logged days vs your
        targets, and your bodyweight trend vs your goal — with one-tap calorie adjustments when the trend drifts.
        <br />
        You can turn all of this off in Settings.
      </div>
    </>
  )
}
