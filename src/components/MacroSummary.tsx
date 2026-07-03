import type { MacroSet, Settings } from '../types'

interface Props {
  totals: MacroSet
  settings: Settings
}

function Meter({ label, value, target, unit }: { label: string; value: number; target?: number; unit: string }) {
  const frac = target && target > 0 ? Math.min(1, value / target) : 0
  const over = !!target && value > target
  return (
    <div style={{ marginBottom: 10 }}>
      <div className="row-between small" style={{ marginBottom: 4, flexWrap: 'wrap', rowGap: 0 }}>
        <span className="ink2">{label}</span>
        <span className="nowrap" style={{ color: over ? 'var(--danger)' : 'var(--muted)', fontSize: 12 }}>
          {Math.round(value).toLocaleString()}
          {target ? ` / ${Math.round(target).toLocaleString()}` : ''} {unit}
        </span>
      </div>
      <div className="meter">
        <div
          className="meter-fill"
          style={{ width: `${frac * 100}%`, background: over ? 'var(--danger)' : 'var(--accent)' }}
        />
      </div>
    </div>
  )
}

export default function MacroSummary({ totals, settings }: Props) {
  const hasTargets = !!settings.kcalTarget
  return (
    <div className="card">
      <Meter label="Calories" value={totals.kcal} target={settings.kcalTarget} unit="kcal" />
      <div className="row" style={{ gap: 14 }}>
        <div className="grow">
          <Meter label="Protein" value={totals.protein} target={settings.proteinTarget} unit="g" />
        </div>
        <div className="grow">
          <Meter label="Carbs" value={totals.carbs} target={settings.carbsTarget} unit="g" />
        </div>
        <div className="grow">
          <Meter label="Fat" value={totals.fat} target={settings.fatTarget} unit="g" />
        </div>
      </div>
      {!hasTargets && (
        <p className="muted small" style={{ margin: 0 }}>
          Set your calorie &amp; macro targets in Settings → Nutrition to track progress against a goal.
        </p>
      )}
    </div>
  )
}
