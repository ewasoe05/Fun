import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId } from '../db'
import type { FoodLog, MealSlot } from '../types'
import { MEAL_SLOTS } from '../types'
import { useSettings } from '../hooks/useSettings'
import { addDays, formatDateKey, sumMacros, todayKey } from '../lib/nutrition'
import MacroSummary from '../components/MacroSummary'
import CalorieHistory from '../components/CalorieHistory'
import FoodPicker, { type PendingLog } from '../components/FoodPicker'
import RecipesTab from './RecipesTab'
import PlanTab from './PlanTab'

const TABS = [
  { key: 'diary', label: 'Diary' },
  { key: 'recipes', label: 'Recipes' },
  { key: 'plan', label: 'Plan' },
] as const

const MEAL_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
}

export default function FoodScreen() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'diary'
  return (
    <>
      <div className="metric-tabs" style={{ marginTop: 8 }}>
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setParams({ tab: t.key })}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'diary' && <DiaryTab />}
      {tab === 'recipes' && <RecipesTab />}
      {tab === 'plan' && <PlanTab />}
    </>
  )
}

function DiaryTab() {
  const settings = useSettings()
  const [date, setDate] = useState(todayKey())
  const [pickerMeal, setPickerMeal] = useState<MealSlot | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editGrams, setEditGrams] = useState('')

  const logs = useLiveQuery(() => db.foodLogs.where('date').equals(date).toArray(), [date]) ?? []
  const totals = sumMacros(logs)
  const isToday = date === todayKey()

  function addEntry(entry: PendingLog) {
    if (!pickerMeal) return
    db.foodLogs.add({ ...entry, id: newId(), date, meal: pickerMeal, loggedAt: Date.now() })
    setPickerMeal(null)
  }

  function saveGrams(log: FoodLog) {
    const grams = parseFloat(editGrams)
    setEditingId(null)
    if (!Number.isFinite(grams) || grams <= 0 || log.grams <= 0 || grams === log.grams) return
    const f = grams / log.grams
    db.foodLogs.update(log.id, {
      grams: Math.round(grams),
      kcal: Math.round(log.kcal * f),
      protein: Math.round(log.protein * f * 10) / 10,
      carbs: Math.round(log.carbs * f * 10) / 10,
      fat: Math.round(log.fat * f * 10) / 10,
    })
  }

  return (
    <>
      <div className="row-between" style={{ margin: '4px 0 12px' }}>
        <button className="btn-icon btn-ghost" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
          ‹
        </button>
        <button className="btn-ghost" onClick={() => setDate(todayKey())}>
          {isToday ? 'Today' : formatDateKey(date)}
        </button>
        <button
          className="btn-icon btn-ghost"
          onClick={() => setDate(addDays(date, 1))}
          disabled={isToday}
          aria-label="Next day"
        >
          ›
        </button>
      </div>

      <MacroSummary totals={totals} settings={settings} />

      {MEAL_SLOTS.map((meal) => {
        const entries = logs.filter((l) => l.meal === meal).sort((a, b) => a.loggedAt - b.loggedAt)
        const kcal = entries.reduce((s, e) => s + e.kcal, 0)
        return (
          <div className="card" key={meal}>
            <div className="row-between" style={{ marginBottom: entries.length ? 8 : 0 }}>
              <strong>{MEAL_LABELS[meal]}</strong>
              <span className="muted small">{kcal > 0 ? `${kcal.toLocaleString()} kcal` : ''}</span>
            </div>
            {entries.map((e) => (
              <div className="row" key={e.id} style={{ padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                {editingId === e.id ? (
                  <>
                    <div className="grow small ink2">{e.name}</div>
                    <input
                      style={{ width: 80, textAlign: 'center' }}
                      inputMode="decimal"
                      autoFocus
                      value={editGrams}
                      onChange={(ev) => setEditGrams(ev.target.value)}
                    />
                    <button className="btn-icon btn-primary" onClick={() => saveGrams(e)} aria-label="Save amount">
                      ✓
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="grow"
                      style={{ background: 'none', textAlign: 'left', padding: 0, minHeight: 36 }}
                      onClick={() => {
                        if (e.grams > 0) {
                          setEditingId(e.id)
                          setEditGrams(String(e.grams))
                        }
                      }}
                    >
                      <div className="small">
                        {e.name}
                        {e.grams > 0 && <span className="muted"> · {e.grams}g</span>}
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {e.kcal} kcal · P {e.protein} · C {e.carbs} · F {e.fat}
                      </div>
                    </button>
                    <button className="btn-icon btn-ghost" onClick={() => db.foodLogs.delete(e.id)} aria-label="Delete entry">
                      ✕
                    </button>
                  </>
                )}
              </div>
            ))}
            <button className="btn-ghost btn-wide" style={{ marginTop: 8 }} onClick={() => setPickerMeal(meal)}>
              + Add food
            </button>
          </div>
        )
      })}

      <CalorieHistory target={settings.kcalTarget} />

      {pickerMeal && <FoodPicker onAdd={addEntry} onClose={() => setPickerMeal(null)} />}
    </>
  )
}
