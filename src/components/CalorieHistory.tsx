import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { db } from '../db'
import { addDays, formatDateKey, todayKey } from '../lib/nutrition'

const ACCENT = '#3987e5'
const SURFACE = '#1a1a19'
const GRID = '#2c2c2a'
const MUTED = '#898781'

const DAYS = 14

function HistoryTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
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
      <div style={{ color: MUTED }}>{formatDateKey(p.date)}</div>
      <div style={{ color: '#fff', fontWeight: 600 }}>{p.kcal.toLocaleString()} kcal</div>
    </div>
  )
}

/** Last 14 days of calories vs target. Renders nothing until 2+ days have logs. */
export default function CalorieHistory({ target }: { target?: number }) {
  const start = addDays(todayKey(), -(DAYS - 1))
  const logs =
    useLiveQuery(() => db.foodLogs.where('date').between(start, todayKey(), true, true).toArray(), [start]) ?? []

  const data = useMemo(() => {
    const byDay = new Map<string, number>()
    for (const l of logs) byDay.set(l.date, (byDay.get(l.date) ?? 0) + l.kcal)
    return Array.from({ length: DAYS }, (_, i) => {
      const date = addDays(start, i)
      return { date, label: date.slice(8), kcal: Math.round(byDay.get(date) ?? 0) }
    })
  }, [logs, start])

  if (data.filter((d) => d.kcal > 0).length < 2) return null

  return (
    <div className="card chart-card">
      <div className="chart-title">Last {DAYS} days (kcal)</div>
      <ResponsiveContainer width="100%" height={170}>
        <BarChart data={data} margin={{ top: 14, right: 16, bottom: 0, left: -14 }}>
          <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
          <XAxis
            dataKey="label"
            tick={{ fill: MUTED, fontSize: 11 }}
            axisLine={{ stroke: '#383835' }}
            tickLine={false}
            interval={2}
          />
          <YAxis
            tick={{ fill: MUTED, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={52}
            tickFormatter={(v: number) => v.toLocaleString()}
          />
          <Tooltip content={<HistoryTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
          {target && (
            <ReferenceLine
              y={target}
              stroke={MUTED}
              strokeWidth={1}
              label={{ value: 'target', fill: MUTED, fontSize: 10, position: 'insideTopRight' }}
            />
          )}
          <Bar dataKey="kcal" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={16} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
