import { useMemo } from 'react'
import type { Workout } from '../types'
import { addDays, toDateKey, todayKey, weekStart } from '../lib/nutrition'

const WEEKS = 15

/** GitHub-style consistency grid of training days, colored by sets done. */
export default function Heatmap({ workouts }: { workouts: Workout[] }) {
  const { cols, monthMarks } = useMemo(() => {
    const setsByDay = new Map<string, number>()
    for (const w of workouts) {
      if (!w.finishedAt) continue
      const key = toDateKey(new Date(w.startedAt))
      const sets = w.entries.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0)
      setsByDay.set(key, (setsByDay.get(key) ?? 0) + sets)
    }
    const start = addDays(weekStart(todayKey()), -(WEEKS - 1) * 7)
    const today = todayKey()
    const cols: { date: string; level: number }[][] = []
    const monthMarks: (string | null)[] = []
    let lastMonth = ''
    for (let wk = 0; wk < WEEKS; wk++) {
      const col: { date: string; level: number }[] = []
      for (let d = 0; d < 7; d++) {
        const date = addDays(start, wk * 7 + d)
        const sets = setsByDay.get(date) ?? 0
        const level = date > today ? -1 : sets === 0 ? 0 : sets < 10 ? 1 : sets < 20 ? 2 : 3
        col.push({ date, level })
      }
      const month = col[0].date.slice(0, 7)
      monthMarks.push(month !== lastMonth && wk > 0 ? formatMonth(col[0].date) : null)
      lastMonth = month
      cols.push(col)
    }
    return { cols, monthMarks }
  }, [workouts])

  return (
    <>
      <div className="heatmap" role="img" aria-label="Training days, last 15 weeks">
        {cols.map((col, i) => (
          <div className="heatmap-col grow" key={i}>
            {col.map((cell) => (
              <div
                key={cell.date}
                className={`heatmap-cell ${cell.level > 0 ? `l${cell.level}` : ''}`}
                style={cell.level === -1 ? { opacity: 0.25 } : undefined}
                title={`${cell.date}${cell.level > 0 ? ' · trained' : ''}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="row-between" style={{ marginTop: 6 }}>
        <span className="muted" style={{ fontSize: 11 }}>
          {monthMarks.filter(Boolean).slice(0, 3).join(' · ')}
        </span>
        <span className="row muted" style={{ fontSize: 11, gap: 3 }}>
          less
          {[0, 1, 2, 3].map((l) => (
            <span key={l} className={`heatmap-cell ${l > 0 ? `l${l}` : ''}`} style={{ width: 9, height: 9 }} />
          ))}
          more
        </span>
      </div>
    </>
  )
}

function formatMonth(dateKey: string): string {
  const [y, m] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short' })
}
