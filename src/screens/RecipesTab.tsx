import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId } from '../db'
import type { Recipe } from '../types'
import { randomMeal, searchMeals, type MealDraft } from '../api/mealdb'
import { IconDice } from '../components/icons'

/** Upsert a TheMealDB draft locally (not yet in the cookbook) and return its id. */
async function draftToRecipe(d: MealDraft): Promise<string> {
  const existing = await db.recipes.where('mealdbId').equals(d.mealdbId).first()
  if (existing) return existing.id
  const recipe: Recipe = {
    id: newId(),
    name: d.name,
    category: d.category,
    area: d.area,
    instructions: d.instructions,
    imageUrl: d.imageUrl,
    videoUrl: d.videoUrl,
    sourceUrl: d.sourceUrl,
    ingredients: d.ingredients,
    source: 'mealdb',
    mealdbId: d.mealdbId,
    inCookbook: 0,
    savedAt: Date.now(),
  }
  await db.recipes.add(recipe)
  return recipe.id
}

export default function RecipesTab() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MealDraft[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const cookbook = useLiveQuery(() => db.recipes.where('inCookbook').equals(1).toArray(), []) ?? []

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch {
      setError('Recipe search failed — check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const search = () => run(async () => setResults(await searchMeals(query.trim())))
  const surprise = () =>
    run(async () => {
      const meal = await randomMeal()
      if (meal) navigate(`/food/recipes/${await draftToRecipe(meal)}`)
    })

  async function open(d: MealDraft) {
    navigate(`/food/recipes/${await draftToRecipe(d)}`)
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 10 }}>
        <input
          placeholder="Search recipes… e.g. chicken curry"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setResults(null)
          }}
          onKeyDown={(e) => e.key === 'Enter' && query.trim() && search()}
        />
        <button className="btn-primary" disabled={busy || !query.trim()} onClick={search}>
          Search
        </button>
      </div>
      <button className="btn-ghost btn-flex btn-wide" disabled={busy} onClick={surprise}>
        <IconDice size={17} /> Surprise me with a random recipe
      </button>
      {error && <p className="small" style={{ color: 'var(--danger)' }}>{error}</p>}
      {busy && <p className="muted small">Searching TheMealDB…</p>}

      {results && (
        <>
          <h2>Results</h2>
          {results.length === 0 && <p className="empty">No recipes found — try a broader search.</p>}
          <div className="recipe-grid">
            {results.map((d) => (
              <button key={d.mealdbId} className="recipe-card" onClick={() => open(d)}>
                {d.imageUrl && <img src={`${d.imageUrl}/preview`} alt="" loading="lazy" />}
                <div className="recipe-card-body">
                  <div className="small">{d.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {[d.category, d.area].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <h2>My cookbook</h2>
      {cookbook.length === 0 ? (
        <p className="muted small">
          Recipes you save show up here. Search above — results come from the free TheMealDB database with photos,
          ingredients, and video links.
        </p>
      ) : (
        <div className="recipe-grid">
          {cookbook.map((r) => (
            <button key={r.id} className="recipe-card" onClick={() => navigate(`/food/recipes/${r.id}`)}>
              {r.imageUrl && <img src={`${r.imageUrl}/preview`} alt="" loading="lazy" />}
              <div className="recipe-card-body">
                <div className="small">{r.name}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {[r.category, r.area].filter(Boolean).join(' · ')}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  )
}
