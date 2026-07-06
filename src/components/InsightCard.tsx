import { useState } from 'react'
import { db, getSettings } from '../db'
import type { Insight } from '../lib/coach'
import { IconApple, IconBarbell, IconCalendar, IconFlame, IconScale, IconTrendingUp } from './icons'

const KIND_ICONS = {
  trend: IconTrendingUp,
  stall: IconFlame,
  balance: IconBarbell,
  consistency: IconCalendar,
  nutrition: IconApple,
  weight: IconScale,
}

const SEV_COLOR = { good: 'var(--good)', info: 'var(--muted)', action: 'var(--accent)' }

export default function InsightCard({ insight }: { insight: Insight }) {
  const [applied, setApplied] = useState(false)
  const Icon = KIND_ICONS[insight.kind]

  async function apply() {
    const settings = await getSettings()
    await db.settings.put({ ...settings, ...insight.action!.patch })
    setApplied(true)
  }

  return (
    <div className="card">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <span style={{ color: SEV_COLOR[insight.severity], flexShrink: 0, marginTop: 2 }}>
          <Icon size={20} />
        </span>
        <div className="grow">
          <div style={{ fontWeight: 600 }}>{insight.title}</div>
          <div className="muted small" style={{ marginTop: 3 }}>
            {insight.body}
          </div>
          {insight.action &&
            (applied ? (
              <p className="small" style={{ color: 'var(--good)', margin: '10px 0 0' }}>
                Applied ✔
              </p>
            ) : (
              <button className="btn-primary" style={{ marginTop: 10, minHeight: 38 }} onClick={apply}>
                {insight.action.label}
              </button>
            ))}
        </div>
      </div>
    </div>
  )
}
