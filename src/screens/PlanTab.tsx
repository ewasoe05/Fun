import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId } from '../db'
import type { PlanEntry, PlanMeal } from '../types'
import { PLAN_MEALS } from '../types'
import { useSettings } from '../hooks/useSettings'
import { useOnline } from '../hooks/useOnline'
import { addDays, formatDateKey, todayKey, weekStart } from '../lib/nutrition'
import { clearWeek, fillWeek } from '../lib/mealPlanner'
import { fillWeekMacros } from '../lib/macroPlanner'

const MEAL_LABELS: Record<PlanMeal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

export default function PlanTab() {
  const navigate = useNavigate()
  const settings = useSettings()
  const online = useOnline()
  const [start, setStart] = useState(weekStart(todayKey()))
  const [slot, setSlot] = useState<{ date: string; meal: PlanMeal } | null>(null)
  const [sheet, setSheet] = useState<PlanEntry | null>(null)
  const [chooserOpen, setChooserOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const end = addDays(start, 6)
  const entries =
    useLiveQuery(() => db.planEntries.where('date').between(start, end, true, true).toArray(), [start, end]) ?? []
  const recipes = useLiveQuery(() => db.recipes.toArray(), []) ?? []
  const recipeById = new Map(recipes.map((r) => [r.id, r]))
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const today = todayKey()

  async function autoFill(mode: 'macros' | 'recipes') {
    setChooserOpen(false)
    setBusy(true)
    setMessage('')
    try {
      if (mode === 'macros') {
        const result = await fillWeekMacros(start)
        setMessage(
          result.filled === 0
            ? 'The week is already full.'
            : `Filled ${result.filled} meals fitted to your daily targets${result.usedOnline ? ' (catalog + online recipes)' : ''}. Tap any meal for details or to log it.`,
        )
      } else {
        const result = await fillWeek(start)
        setMessage(
          result.filled === 0
            ? 'The week is already full.'
            : `Filled ${result.filled} meal${result.filled === 1 ? '' : 's'}${result.offlineFallback ? ' from your cookbook (offline)' : ''} — tap any meal to swap or remove it.`,
        )
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not fill the week.')
    } finally {
      setBusy(false)
    }
  }

  async function clear() {
    if (!confirm('Remove all planned meals for this week?')) return
    await clearWeek(start)
    setMessage('')
  }

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

      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn-primary grow" disabled={busy} onClick={() => setChooserOpen(true)}>
          {busy ? 'Filling…' : '✨ Fill week with meals'}
        </button>
        <button className="btn-ghost" disabled={busy || entries.length === 0} onClick={clear}>
          Clear
        </button>
      </div>
      {message && <p className="ink2 small" style={{ marginTop: -4 }}>{message}</p>}

      {days.map((date) => {
        const dayEntries = entries.filter((e) => e.date === date)
        const withMacros = dayEntries.filter((e) => e.macros)
        const dayKcal = withMacros.reduce((s, e) => s + e.macros!.kcal, 0)
        const dayP = withMacros.reduce((s, e) => s + e.macros!.protein, 0)
        return (
          <div className="card" key={date} style={date === today ? { borderColor: 'var(--accent)' } : undefined}>
            <strong className="small">{formatDateKey(date, { weekday: 'long', month: 'short', day: 'numeric' })}</strong>
            {PLAN_MEALS.map((meal) => {
              const entry = dayEntries.find((e) => e.meal === meal)
              const recipe = entry?.recipeId ? recipeById.get(entry.recipeId) : undefined
              return (
                <div className="row" key={meal} style={{ marginTop: 8 }}>
                  <span className="muted" style={{ width: 70, fontSize: 12, flexShrink: 0 }}>
                    {MEAL_LABELS[meal]}
                  </span>
                  {entry ? (
                    <>
                      <button
                        className="grow row"
                        style={{ background: 'none', padding: 0, minHeight: 40, textAlign: 'left' }}
                        onClick={() =>
                          entry.recipeId ? navigate(`/food/recipes/${entry.recipeId}`) : entry.macros && setSheet(entry)
                        }
                      >
                        {recipe?.imageUrl && (
                          <img
                            src={`${recipe.imageUrl}/preview`}
                            alt=""
                            style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }}
                          />
                        )}
                        <span className="grow">
                          <span className="small" style={{ display: 'block' }}>
                            {entry.title}
                          </span>
                          {entry.macros && (
                            <span className="muted" style={{ fontSize: 11 }}>
                              {entry.macros.kcal} kcal · P {Math.round(entry.macros.protein)}g
                            </span>
                          )}
                        </span>
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
            {withMacros.length > 0 && (
              <div
                className="small"
                style={{
                  marginTop: 10,
                  paddingTop: 8,
                  borderTop: '1px solid var(--border)',
                  color:
                    settings.kcalTarget && dayKcal > settings.kcalTarget * 1.05 ? 'var(--danger)' : 'var(--muted)',
                }}
              >
                Day: {dayKcal.toLocaleString()} kcal · P {Math.round(dayP)}g
                {settings.kcalTarget ? ` · target ${settings.kcalTarget.toLocaleString()} kcal / ${settings.proteinTarget ?? '—'}g` : ''}
              </div>
            )}
          </div>
        )
      })}

      {chooserOpen && (
        <div className="modal-overlay" onClick={() => setChooserOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="row-between">
              <strong>Fill the week</strong>
              <button className="btn-ghost" onClick={() => setChooserOpen(false)}>
                Close
              </button>
            </div>
            <div className="modal-body stack" style={{ paddingTop: 12 }}>
              <button className="card" style={{ textAlign: 'left', minHeight: 0 }} onClick={() => autoFill('macros')}>
                <div style={{ fontWeight: 600 }}>🎯 Fit my macros</div>
                <div className="muted small" style={{ marginTop: 4 }}>
                  Meals & snacks portioned to hit the daily calories, protein, carbs, and fat calculated from your
                  stats. Uses the built-in meal catalog
                  {settings.spoonacularKey && online ? ' plus online recipes' : ''} — works fully offline.
                </div>
              </button>
              <button className="card" style={{ textAlign: 'left', minHeight: 0 }} onClick={() => autoFill('recipes')}>
                <div style={{ fontWeight: 600 }}>🎲 Surprise recipes</div>
                <div className="muted small" style={{ marginTop: 4 }}>
                  {online
                    ? 'Real recipes with photos and instructions from TheMealDB (your cookbook first). No macro fitting.'
                    : 'Offline: fills from your saved cookbook only.'}
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {sheet && <EntrySheet entry={sheet} onClose={() => setSheet(null)} />}
      {slot && <SlotPicker date={slot.date} meal={slot.meal} onClose={() => setSlot(null)} />}
    </>
  )
}

function EntrySheet({ entry, onClose }: { entry: PlanEntry; onClose: () => void }) {
  const [logged, setLogged] = useState(false)
  const m = entry.macros!

  async function logToDiary() {
    await db.foodLogs.add({
      id: newId(),
      date: entry.date,
      meal: entry.meal,
      name: entry.title,
      grams: 0,
      kcal: m.kcal,
      protein: m.protein,
      carbs: m.carbs,
      fat: m.fat,
      loggedAt: Date.now(),
    })
    setLogged(true)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <strong>{entry.title}</strong>
          <button className="btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <p className="muted small" style={{ marginTop: 4 }}>
            {MEAL_LABELS[entry.meal]} · {formatDateKey(entry.date)}
            {entry.portionDesc ? ` · ${entry.portionDesc}` : ''}
          </p>
          <div className="card row" style={{ padding: 6 }}>
            <div className="stat-tile grow">
              <div className="value">{m.kcal}</div>
              <div className="label">kcal</div>
            </div>
            <div className="stat-tile grow">
              <div className="value">{Math.round(m.protein)}</div>
              <div className="label">protein g</div>
            </div>
            <div className="stat-tile grow">
              <div className="value">{Math.round(m.carbs)}</div>
              <div className="label">carbs g</div>
            </div>
            <div className="stat-tile grow">
              <div className="value">{Math.round(m.fat)}</div>
              <div className="label">fat g</div>
            </div>
          </div>
          {entry.sourceUrl && (
            <a className="list-item" href={entry.sourceUrl} target="_blank" rel="noreferrer">
              <div className="grow">View recipe ↗</div>
            </a>
          )}
          {logged ? (
            <p className="small" style={{ color: 'var(--good)' }}>
              Logged to the diary ✔
            </p>
          ) : (
            <button className="btn-primary btn-wide" onClick={logToDiary}>
              Log to diary ({formatDateKey(entry.date, { weekday: 'short' })} {MEAL_LABELS[entry.meal].toLowerCase()})
            </button>
          )}
          <button
            className="btn-danger btn-wide"
            style={{ marginTop: 10 }}
            onClick={async () => {
              await db.planEntries.delete(entry.id)
              onClose()
            }}
          >
            Remove from plan
          </button>
        </div>
      </div>
    </div>
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
