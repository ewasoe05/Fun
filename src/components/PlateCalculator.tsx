import { useState } from 'react'
import type { Units } from '../types'
import { BAR_OPTIONS, PLATE_SIZES, platesPerSide } from '../lib/plates'

interface Props {
  initialWeight: number // display units
  units: Units
  onClose: () => void
}

export default function PlateCalculator({ initialWeight, units, onClose }: Props) {
  const [weightStr, setWeightStr] = useState(initialWeight > 0 ? String(initialWeight) : '')
  const [bar, setBar] = useState(BAR_OPTIONS[units][0])

  const weight = parseFloat(weightStr)
  const valid = Number.isFinite(weight) && weight > 0
  const result = valid ? platesPerSide(weight, bar, units) : null
  const maxPlate = PLATE_SIZES[units][0]

  const counts = new Map<number, number>()
  for (const p of result?.perSide ?? []) counts.set(p, (counts.get(p) ?? 0) + 1)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <strong>Plate calculator</strong>
          <button className="btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <div className="row">
            <label className="field grow">
              <span>Target weight ({units})</span>
              <input inputMode="decimal" autoFocus value={weightStr} onChange={(e) => setWeightStr(e.target.value)} />
            </label>
            <label className="field grow">
              <span>Bar ({units})</span>
              <select value={bar} onChange={(e) => setBar(Number(e.target.value))}>
                {BAR_OPTIONS[units].map((b) => (
                  <option key={b} value={b}>
                    {b} {units} bar
                  </option>
                ))}
              </select>
            </label>
          </div>

          {result && !result.belowBar && (
            <>
              <div className="bar-diagram">
                <div className="bar-sleeve" />
                {result.perSide.map((p, i) => (
                  <div
                    key={i}
                    className="plate-rect"
                    style={{ height: 28 + (p / maxPlate) * 52, width: p >= maxPlate * 0.5 ? 13 : 9 }}
                    title={`${p} ${units}`}
                  />
                ))}
                <div className="bar-sleeve" style={{ maxWidth: 26 }} />
              </div>
              {result.perSide.length === 0 ? (
                <p className="ink2">Empty bar — no plates needed.</p>
              ) : (
                <div className="card" style={{ marginBottom: 8 }}>
                  <div className="muted small" style={{ marginBottom: 6 }}>
                    Per side:
                  </div>
                  {[...counts.entries()].map(([plate, n]) => (
                    <div key={plate} className="row-between" style={{ padding: '3px 0' }}>
                      <span className="ink2">
                        {plate} {units} plate
                      </span>
                      <span style={{ fontWeight: 600 }}>× {n}</span>
                    </div>
                  ))}
                </div>
              )}
              {result.remainder > 0 && (
                <p className="muted small">
                  {result.remainder} {units} can't be loaded with standard plates — closest is{' '}
                  {Math.round((weight - result.remainder) * 100) / 100} {units}.
                </p>
              )}
            </>
          )}
          {result?.belowBar && (
            <p className="muted">
              Target is lighter than the {bar} {units} bar.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
