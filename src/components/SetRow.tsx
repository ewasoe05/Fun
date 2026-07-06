import { useState } from 'react'
import type { SetLog, Units } from '../types'
import { formatWeight, toKg } from '../lib/units'
import { IconTrophy } from './icons'

interface Props {
  index: number
  set: SetLog
  prevHint?: string
  units: Units
  pr?: boolean
  onChange: (set: SetLog) => void
}

export default function SetRow({ index, set, prevHint, units, pr, onChange }: Props) {
  const [weightStr, setWeightStr] = useState(set.weightKg > 0 ? formatWeight(set.weightKg, units) : '')
  const [repsStr, setRepsStr] = useState(set.reps > 0 ? String(set.reps) : '')

  function changeWeight(v: string) {
    setWeightStr(v)
    const parsed = parseFloat(v)
    onChange({ ...set, weightKg: Number.isFinite(parsed) && parsed > 0 ? toKg(parsed, units) : 0 })
  }

  function changeReps(v: string) {
    setRepsStr(v)
    const parsed = parseInt(v, 10)
    onChange({ ...set, reps: Number.isFinite(parsed) && parsed > 0 ? parsed : 0 })
  }

  function toggleDone() {
    onChange(set.done ? { ...set, done: false, completedAt: undefined } : { ...set, done: true, completedAt: Date.now() })
  }

  return (
    <div className={`set-grid ${set.done ? 'set-row-done' : ''}`}>
      <div className="set-num">
        {pr ? (
          <span className="pr-flash" title="New PR!">
            <IconTrophy size={16} />
          </span>
        ) : (
          index + 1
        )}
      </div>
      <div className="prev-hint">{prevHint ?? '—'}</div>
      <input inputMode="decimal" placeholder="0" value={weightStr} onChange={(e) => changeWeight(e.target.value)} />
      <input inputMode="numeric" placeholder="0" value={repsStr} onChange={(e) => changeReps(e.target.value)} />
      <button className={`set-done-btn ${set.done ? 'done' : ''}`} onClick={toggleDone} aria-label="Set done">
        ✓
      </button>
    </div>
  )
}
