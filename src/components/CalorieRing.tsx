interface Props {
  value: number
  target?: number
  size?: number
}

/** Circular kcal progress: consumed vs target, remaining in the center. */
export default function CalorieRing({ value, target, size = 130 }: Props) {
  const stroke = 11
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const frac = target && target > 0 ? Math.min(1, value / target) : 0
  const over = !!target && value > target

  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle
          className={`ring-fill ${over ? 'over' : ''}`}
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
        />
      </svg>
      <div className="ring-center">
        {target ? (
          <>
            <div className="big" style={over ? { color: 'var(--danger)' } : undefined}>
              {Math.abs(Math.round(target - value)).toLocaleString()}
            </div>
            <div className="muted" style={{ fontSize: 11 }}>
              kcal {over ? 'over' : 'left'}
            </div>
          </>
        ) : (
          <>
            <div className="big">{Math.round(value).toLocaleString()}</div>
            <div className="muted" style={{ fontSize: 11 }}>
              kcal
            </div>
          </>
        )}
      </div>
    </div>
  )
}
