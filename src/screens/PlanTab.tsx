import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId } from '../db'
import type { PlanMeal } from '../types'
import { PLAN_MEALS } from '../types'
import { addDays, formatDateKey, todayKey, weekStart } from '../lib/nutrition'

const MEAL_LABELS: Record<PlanMeal, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' }

export default function PlanTab() {
  const navigate = useNavigate()
  const [start, setStart] = useState(weekStart(todayKey()))
  const [slot, setSlot] = useState<{ date: string; meal: PlanMeal } | null>(null)

  const end = addDays(start, 6)
  const entries =
    useLiveQuery(() => db.planEntries.where('date').between(start, end, true, true).toArray(), [start, end]) ?? []
  const recipes = useLiveQuery(() => db.recipes.toArray(), []) ?? []
  const recipeById = new Map(recipes.map((r) => [r.id, r]))
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const today = todayKey()

  return (
    <>
      <div className="row-between" style={{ margin: '4px 0 12px' }}>
        <button className="btn-icon btn-ghost" onClick={() => setStart(addDays(start, -7))} aria-label="Previous week">
          ‹
        </button>
        <button className="btn-ghost" onClick={() => setStart(weekStart(todayKey()))}>
          {formatDateKey(start, { month: 'short', day: 'numeric' })} – {formatDateKey(end, { month: 'short', day: 'numeric' })}
        </button>
        <button className="btn-icon btn-ghost" onClick={() => setStart(addDays(start, 7))} aria-label="Next week">
          ›
        </button>
      </div>

      {days.map((date) => (
        <div className="card" key={date} style={date === today ? { borderColor: 'var(--accent)' } : undefined}>
          <strong className="small">{formatDateKey(date, { weekday: 'long', month: 'short', day: 'numeric' })}</strong>
          {PLAN_MEALS.map((meal) => {
            const entry = entries.find((e) => e.date === date && e.meal === meal)
            const recipe = entry?.recipeId ? recipeById.get(entry.recipeId) : undefined
            return (
              <div className="row" key={meal} style={{ marginTop: 8 }}>
                <span className="muted" style={{ width: 70, fontSize: 12 }}>
                  {MEAL_LABELS[meal]}
                </span>
                {entry ? (
                  <>
                    <button
                      className="grow row"
                      style={{ background: 'none', padding: 0, minHeight: 40, textAlign: 'left' }}
                      onClick={() => entry.recipeId && navigate(`/food/recipes/${entry.recipeId}`)}
                    >
                      {recipe?.imageUrl && (
                        <img
                          src={`${recipe.imageUrl}/preview`}
                          alt=""
                          style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }}
                        />
                      )}
                      <span className="small grow">{entry.title}</span>
                    </button>
                    <button className="btn-icon btn-ghost" onClick={() => db.planEntries.delete(entry.id)} aria-label="Remove">
                      ✕
                    </button>
                  </>
                ) : (
                  <button className="btn-ghost grow" style={{ minHeight: 40 }} onClick={() => setSlot({ date, meal })}>
                    +
                  </button>
                )}
              </div>
            )
          })}
        </div>
      ))}

      {slot && <SlotPicker date={slot.date} meal={slot.meal} onClose={() => setSlot(null)} />}
    </>
  )
}

function SlotPicker({ date, meal, onClose }: { date: string; meal: PlanMeal; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const cookbook = useLiveQuery(() => db.recipes.where('inCookbook').equals(1).toArray(), []) ?? []

  async function add(recipeId: string | undefined, entryTitle: string) {
    await db.planEntries.add({ id: newId(), date, meal, recipeId, title: entryTitle })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <strong>
            {MEAL_LABELS[meal]} · {formatDateKey(date)}
          </strong>
          <button className="btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <div className="row" style={{ marginBottom: 12 }}>
            <input
              autoFocus
              placeholder="Type a meal… e.g. Leftovers"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <button className="btn-primary" disabled={!title.trim()} onClick={() => add(undefined, title.trim())}>
              Add
            </button>
          </div>
          {cookbook.length > 0 && <p className="muted small">…or pick from your cookbook:</p>}
          {cookbook.map((r) => (
            <button key={r.id} className="list-item" onClick={() => add(r.id, r.name)}>
              {r.imageUrl && <img className="thumb" src={`${r.imageUrl}/preview`} alt="" loading="lazy" />}
              <div className="grow">
                <div>{r.name}</div>
                <div className="muted">{[r.category, r.area].filter(Boolean).join(' · ')}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
