import type { RecipeIngredient } from '../types'

const BASE = 'https://www.themealdb.com/api/json/v1/1'

/** A recipe parsed from TheMealDB but not yet saved locally. */
export interface MealDraft {
  mealdbId: string
  name: string
  category: string
  area: string
  instructions: string
  imageUrl?: string
  videoUrl?: string
  sourceUrl?: string
  ingredients: RecipeIngredient[]
}

function parseMeal(m: any): MealDraft | null {
  if (!m?.idMeal || !m?.strMeal) return null
  const ingredients: RecipeIngredient[] = []
  for (let i = 1; i <= 20; i++) {
    const name = (m[`strIngredient${i}`] ?? '').trim()
    if (!name) continue
    ingredients.push({ name, measure: (m[`strMeasure${i}`] ?? '').trim() })
  }
  return {
    mealdbId: String(m.idMeal),
    name: m.strMeal,
    category: m.strCategory ?? '',
    area: m.strArea ?? '',
    instructions: (m.strInstructions ?? '').trim(),
    imageUrl: m.strMealThumb || undefined,
    videoUrl: m.strYoutube || undefined,
    sourceUrl: m.strSource || undefined,
    ingredients,
  }
}

/** Search TheMealDB's free recipe database by name. Requires network. */
export async function searchMeals(term: string): Promise<MealDraft[]> {
  const res = await fetch(`${BASE}/search.php?s=${encodeURIComponent(term)}`)
  if (!res.ok) throw new Error(`recipe search failed (${res.status})`)
  const json = await res.json()
  return ((json.meals ?? []) as any[]).map(parseMeal).filter((m): m is MealDraft => m !== null)
}

/** A random recipe for inspiration. */
export async function randomMeal(): Promise<MealDraft | null> {
  const res = await fetch(`${BASE}/random.php`)
  if (!res.ok) throw new Error(`random recipe failed (${res.status})`)
  const json = await res.json()
  return parseMeal(json.meals?.[0])
}
