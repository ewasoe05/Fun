import type { MacroSet, Settings } from '../types'
import CalorieRing from './CalorieRing'

interface Props {
  totals: MacroSet
  settings: Settings
}

function MacroBar({ label, value, target }: { label: string; value: number; target?: number }) {
  const frac = target && target > 0 ? Math.min(1, value / target) : 0
  const over = !!target && value > target
  return (
    <div style={{ marginBottom: 9 }}>
      <div className="row-between" style={{ marginBottom: 3 }}>
        <span className="ink2" style={{ fontSize: 12 }}>{label}</span>
        <span className="nowrap" style={{ color: over ? 'var(--danger)' : 'var(--muted)', fontSize: 12 }}>
          {Math.round(value)}
          {target ? ` / ${Math.round(target)}` : ''} g
        </span>
      </div>
      <div className="meter" style={{ height: 6 }}>
        <div
          className="meter-fill"
          style={{
            width: `${frac * 100}%`,
            background: over ? 'var(--danger)' : 'var(--accent)',
            transition: 'width 0.5s ease',
          }}
        />
      </div>
    </div>
  )
}

export default function MacroSummary({ totals, settings }: Props) {
  return (
    <div className="card">
      <div className="row" style={{ gap: 18, alignItems: 'center' }}>
        <CalorieRing value={totals.kcal} target={settings.kcalTarget} />
        <div className="grow">
          {settings.kcalTarget && (
            <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
              {Math.round(totals.kcal).toLocaleString()} / {settings.kcalTarget.toLocaleString()} kcal
            </div>
          )}
          <MacroBar label="Protein" value={totals.protein} target={settings.proteinTarget} />
          <MacroBar label="Carbs" value={totals.carbs} target={settings.carbsTarget} />
          <MacroBar label="Fat" value={totals.fat} target={settings.fatTarget} />
        </div>
      </div>
      {!settings.kcalTarget && (
        <p className="muted small" style={{ margin: '10px 0 0' }}>
          Set your calorie &amp; macro targets in Settings → Nutrition to track progress against a goal.
        </p>
      )}
    </div>
  )
}
