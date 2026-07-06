import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId } from '../db'
import type { PlanMeal } from '../types'
import { PLAN_MEALS } from '../types'
import { lookupMeal } from '../api/mealdb'
import { addDays, formatDateKey, todayKey } from '../lib/nutrition'
import { IconCalendar, IconPlay, IconStar } from '../components/icons'

export default function RecipeDetailScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const recipe = useLiveQuery(() => db.recipes.get(id!), [id])
  const [planOpen, setPlanOpen] = useState(false)
  const [planDate, setPlanDate] = useState(todayKey())
  const [planMeal, setPlanMeal] = useState<PlanMeal>('dinner')
  const [added, setAdded] = useState(false)
  const [detailError, setDetailError] = useState(false)

  // auto-filled plan entries are saved as stubs — fetch full details on first open
  const needsDetails = !!recipe && recipe.source === 'mealdb' && !recipe.instructions && !!recipe.mealdbId
  useEffect(() => {
    if (!needsDetails || !recipe) return
    let cancelled = false
    lookupMeal(recipe.mealdbId!)
      .then((full) => {
        if (cancelled || !full) return
        db.recipes.update(recipe.id, {
          name: full.name,
          category: full.category || recipe.category,
          area: full.area,
          instructions: full.instructions,
          imageUrl: full.imageUrl ?? recipe.imageUrl,
          videoUrl: full.videoUrl,
          sourceUrl: full.sourceUrl,
          ingredients: full.ingredients,
        })
      })
      .catch(() => {
        if (!cancelled) setDetailError(true)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsDetails, recipe?.id])

  if (!recipe) return null
  const saved = recipe.inCookbook === 1

  async function addToPlan() {
    await db.planEntries.add({ id: newId(), date: planDate, meal: planMeal, recipeId: recipe!.id, title: recipe!.name })
    setPlanOpen(false)
    setAdded(true)
  }

  return (
    <>
      <div className="row" style={{ margin: '8px 0 12px' }}>
        <button className="btn-ghost" onClick={() => navigate(-1)}>
          ‹ Back
        </button>
      </div>
      <h1 style={{ margin: '0 0 12px' }}>{recipe.name}</h1>
      {recipe.imageUrl && (
        <img src={recipe.imageUrl} alt={recipe.name} style={{ width: '100%', borderRadius: 12 }} loading="lazy" />
      )}
      <div style={{ margin: '12px 0' }}>
        {[recipe.category, recipe.area].filter(Boolean).map((p) => (
          <span key={p} className="pill">
            {p}
          </span>
        ))}
      </div>

      <div className="row" style={{ marginBottom: 12 }}>
        <button
          className={`btn-flex grow ${saved ? 'btn-ghost' : 'btn-primary'}`}
          onClick={() => db.recipes.update(recipe.id, { inCookbook: saved ? 0 : 1, savedAt: Date.now() })}
        >
          <IconStar size={17} filled={saved} /> {saved ? 'Saved — remove' : 'Save to cookbook'}
        </button>
        <button className="btn-ghost btn-flex grow" onClick={() => setPlanOpen(!planOpen)}>
          <IconCalendar size={17} /> Add to plan
        </button>
      </div>
      {added && !planOpen && <p className="small" style={{ color: 'var(--good)' }}>Added to your meal plan ✔</p>}

      {planOpen && (
        <div className="card">
          <label className="field">
            <span>Day</span>
            <select value={planDate} onChange={(e) => setPlanDate(e.target.value)}>
              {Array.from({ length: 14 }, (_, i) => addDays(todayKey(), i)).map((d) => (
                <option key={d} value={d}>
                  {dayLabel(d)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Meal</span>
            <select value={planMeal} onChange={(e) => setPlanMeal(e.target.value as PlanMeal)}>
              {PLAN_MEALS.map((m) => (
                <option key={m} value={m}>
                  {m[0].toUpperCase() + m.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <button className="btn-primary btn-wide" onClick={addToPlan}>
            Confirm
          </button>
        </div>
      )}

      {needsDetails && !detailError && <p className="muted small">Loading recipe details…</p>}
      {needsDetails && detailError && (
        <p className="muted small">Couldn't load the full recipe — check your connection and reopen this page.</p>
      )}

      {recipe.ingredients.length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Ingredients</h2>
          {recipe.ingredients.map((ing, i) => (
            <div key={i} className="row-between small" style={{ padding: '4px 0' }}>
              <span className="ink2">{ing.name}</span>
              <span className="muted nowrap">{ing.measure}</span>
            </div>
          ))}
        </div>
      )}

      {recipe.instructions && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Instructions</h2>
          <p className="instructions" style={{ margin: 0 }}>
            {recipe.instructions}
          </p>
        </div>
      )}

      {recipe.videoUrl && (
        <a className="list-item" href={recipe.videoUrl} target="_blank" rel="noreferrer">
          <span style={{ color: 'var(--accent)' }}>
            <IconPlay size={22} />
          </span>
          <div className="grow">
            <div>Watch video</div>
            <div className="muted">Cooking video on YouTube</div>
          </div>
        </a>
      )}

      {recipe.source === 'mealdb' && <p className="muted small">Recipe from TheMealDB.com.</p>}
    </>
  )
}

function dayLabel(d: string): string {
  if (d === todayKey()) return `Today · ${formatDateKey(d)}`
  if (d === addDays(todayKey(), 1)) return `Tomorrow · ${formatDateKey(d)}`
  return formatDateKey(d, { weekday: 'long', month: 'short', day: 'numeric' })
}
