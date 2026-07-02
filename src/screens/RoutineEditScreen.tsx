import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../db'
import type { Exercise, Routine, RoutineEntry } from '../types'
import ExercisePicker from '../components/ExercisePicker'

export default function RoutineEditScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const routine = useLiveQuery(() => db.routines.get(id!), [id])
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? []
  const [pickerOpen, setPickerOpen] = useState(false)

  if (!routine) return null
  const exName = (exId: string) => exercises.find((e) => e.id === exId)?.name ?? 'Unknown exercise'

  function save(next: Routine) {
    db.routines.put(next)
  }

  function updateEntry(idx: number, patch: Partial<RoutineEntry>) {
    save({ ...routine!, entries: routine!.entries.map((e, i) => (i === idx ? { ...e, ...patch } : e)) })
  }

  function move(idx: number, dir: -1 | 1) {
    const entries = [...routine!.entries]
    const target = idx + dir
    if (target < 0 || target >= entries.length) return
    ;[entries[idx], entries[target]] = [entries[target], entries[idx]]
    save({ ...routine!, entries })
  }

  function addExercise(ex: Exercise) {
    setPickerOpen(false)
    save({ ...routine!, entries: [...routine!.entries, { exerciseId: ex.id, targetSets: 3, targetReps: 8 }] })
  }

  async function remove() {
    if (confirm(`Delete routine “${routine!.name}”?`)) {
      await db.routines.delete(routine!.id)
      navigate('/routines')
    }
  }

  return (
    <>
      <div className="row" style={{ margin: '8px 0 16px' }}>
        <button className="btn-ghost" onClick={() => navigate('/routines')}>
          ‹ Back
        </button>
      </div>
      <label className="field">
        <span>Routine name</span>
        <input value={routine.name} onChange={(e) => save({ ...routine, name: e.target.value })} />
      </label>

      {routine.entries.map((entry, i) => (
        <div className="card" key={`${entry.exerciseId}-${i}`}>
          <div className="row-between">
            <strong className="grow">{exName(entry.exerciseId)}</strong>
            <button className="btn-icon btn-ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
              ↑
            </button>
            <button
              className="btn-icon btn-ghost"
              onClick={() => move(i, 1)}
              disabled={i === routine.entries.length - 1}
              aria-label="Move down"
            >
              ↓
            </button>
            <button
              className="btn-icon btn-ghost"
              onClick={() => save({ ...routine, entries: routine.entries.filter((_, j) => j !== i) })}
              aria-label="Remove"
            >
              ✕
            </button>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <NumberField label="Sets" value={entry.targetSets} min={1} onChange={(v) => updateEntry(i, { targetSets: v })} />
            <NumberField label="Reps" value={entry.targetReps} min={1} onChange={(v) => updateEntry(i, { targetReps: v })} />
          </div>
        </div>
      ))}

      <button className="btn-primary btn-wide" onClick={() => setPickerOpen(true)}>
        + Add exercise
      </button>
      <button className="btn-danger btn-wide" style={{ marginTop: 12 }} onClick={remove}>
        Delete routine
      </button>

      {pickerOpen && <ExercisePicker onSelect={addExercise} onClose={() => setPickerOpen(false)} />}
    </>
  )
}

function NumberField({
  label,
  value,
  min,
  onChange,
}: {
  label: string
  value: number
  min: number
  onChange: (v: number) => void
}) {
  const [str, setStr] = useState(String(value))
  return (
    <label className="field grow" style={{ marginBottom: 0 }}>
      <span>{label}</span>
      <input
        inputMode="numeric"
        value={str}
        onChange={(e) => {
          setStr(e.target.value)
          const parsed = parseInt(e.target.value, 10)
          if (Number.isFinite(parsed) && parsed >= min) onChange(parsed)
        }}
        onBlur={() => setStr(String(value))}
      />
    </label>
  )
}
