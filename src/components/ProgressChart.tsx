import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export interface ChartPoint {
  date: number
  value: number
}

interface Props {
  data: ChartPoint[]
  /** e.g. "lb" or "kg × reps" — shown in the tooltip */
  unitLabel: string
  valueFormatter?: (v: number) => string
}

const ACCENT = '#3987e5' // series-1 blue (dark step)
const SURFACE = '#1a1a19'
const GRID = '#2c2c2a'
const MUTED = '#898781'
const INK = '#ffffff'

const dateFmt = (t: number) =>
  new Date(t).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })

function ChartTooltip({ active, payload, unitLabel, valueFormatter }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload as ChartPoint
  const v = valueFormatter ? valueFormatter(p.value) : String(Math.round(p.value * 10) / 10)
  return (
    <div
      style={{
        background: SURFACE,
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: '6px 10px',
        fontSize: 13,
      }}
    >
      <div style={{ color: MUTED }}>
        {new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
      </div>
      <div style={{ color: INK, fontWeight: 600 }}>
        {v} {unitLabel}
      </div>
    </div>
  )
}

export default function ProgressChart({ data, unitLabel, valueFormatter }: Props) {
  if (data.length === 0) return null
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 12, right: 16, bottom: 0, left: -12 }}>
        <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
        <XAxis
          dataKey="date"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          tickFormatter={dateFmt}
          tick={{ fill: MUTED, fontSize: 11 }}
          axisLine={{ stroke: '#383835' }}
          tickLine={false}
          minTickGap={32}
        />
        <YAxis
          tick={{ fill: MUTED, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={52}
          domain={['auto', 'auto']}
          tickFormatter={(v: number) => v.toLocaleString()}
        />
        <Tooltip
          content={<ChartTooltip unitLabel={unitLabel} valueFormatter={valueFormatter} />}
          cursor={{ stroke: MUTED, strokeWidth: 1 }}
        />
        <Area type="monotone" dataKey="value" stroke="none" fill={ACCENT} fillOpacity={0.1} isAnimationActive={false} />
        <Line
          type="monotone"
          dataKey="value"
          stroke={ACCENT}
          strokeWidth={2}
          strokeLinecap="round"
          isAnimationActive={false}
          dot={{ r: 4, fill: ACCENT, stroke: SURFACE, strokeWidth: 2 }}
          activeDot={{ r: 5, fill: ACCENT, stroke: SURFACE, strokeWidth: 2 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
