import { db, newId } from '../db'
import type { PlanEntry, PlanMeal, Recipe } from '../types'
import { PLAN_MEALS } from '../types'
import { listCategory, type MealStub } from '../api/mealdb'
import { addDays } from './nutrition'

const MAIN_CATEGORIES = ['Chicken', 'Beef', 'Seafood', 'Pasta', 'Vegetarian', 'Pork', 'Lamb']

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Save a category stub as a local Recipe row (details load lazily on first open). */
async function stubToRecipe(stub: MealStub, category: string): Promise<Recipe> {
  const existing = await db.recipes.where('mealdbId').equals(stub.mealdbId).first()
  if (existing) return existing
  const recipe: Recipe = {
    id: newId(),
    name: stub.name,
    category,
    area: '',
    instructions: '', // fetched lazily when the recipe is opened
    imageUrl: stub.imageUrl,
    ingredients: [],
    source: 'mealdb',
    mealdbId: stub.mealdbId,
    inCookbook: 0,
    savedAt: Date.now(),
  }
  await db.recipes.add(recipe)
  return recipe
}

export interface FillResult {
  filled: number
  /** true when online picks failed and only the cookbook was used */
  offlineFallback: boolean
}

/**
 * Fill every EMPTY slot of the week starting at `start` (Monday, YYYY-MM-DD).
 * Breakfast slots come from TheMealDB's Breakfast category; lunch/dinner prefer
 * the user's cookbook (each recipe once per week) topped up from a couple of
 * random main-dish categories. Existing entries are never touched.
 */
export async function fillWeek(start: string): Promise<FillResult> {
  const end = addDays(start, 6)
  const existing = await db.planEntries.where('date').between(start, end, true, true).toArray()
  const taken = new Set(existing.map((e) => `${e.date}|${e.meal}`))
  const usedRecipeIds = new Set(existing.map((e) => e.recipeId).filter(Boolean) as string[])

  const emptySlots: { date: string; meal: PlanMeal }[] = []
  for (let d = 0; d < 7; d++) {
    const date = addDays(start, d)
    for (const meal of PLAN_MEALS) {
      if (!taken.has(`${date}|${meal}`)) emptySlots.push({ date, meal })
    }
  }
  if (emptySlots.length === 0) return { filled: 0, offlineFallback: false }

  // online pools (best-effort — cookbook still works offline)
  let offlineFallback = false
  let breakfastPool: MealStub[] = []
  let mainPool: MealStub[] = []
  try {
    const categories = shuffle(MAIN_CATEGORIES).slice(0, 3)
    const [breakfast, ...mains] = await Promise.all([
      listCategory('Breakfast'),
      ...categories.map((c) => listCategory(c).then((list) => ({ c, list }))),
    ])
    breakfastPool = shuffle(breakfast)
    mainPool = shuffle(mains.flatMap((m) => m.list.map((s) => ({ ...s, _cat: m.c }) as MealStub & { _cat: string })))
  } catch {
    offlineFallback = true
  }

  const cookbook = shuffle(await db.recipes.where('inCookbook').equals(1).toArray()).filter(
    (r) => !usedRecipeIds.has(r.id),
  )
  const usedMealdbIds = new Set<string>()
  for (const id of usedRecipeIds) {
    const r = await db.recipes.get(id)
    if (r?.mealdbId) usedMealdbIds.add(r.mealdbId)
  }

  const entries: PlanEntry[] = []

  async function takeStub(pool: MealStub[], category: string): Promise<Recipe | null> {
    while (pool.length > 0) {
      const stub = pool.shift()!
      if (usedMealdbIds.has(stub.mealdbId)) continue
      usedMealdbIds.add(stub.mealdbId)
      return stubToRecipe(stub, (stub as any)._cat ?? category)
    }
    return null
  }

  for (const slot of emptySlots) {
    let recipe: Recipe | null = null
    if (slot.meal === 'breakfast') {
      recipe = await takeStub(breakfastPool, 'Breakfast')
    } else {
      recipe = cookbook.shift() ?? (await takeStub(mainPool, 'Main'))
    }
    if (!recipe) continue // pools exhausted (e.g. offline with an empty cookbook)
    entries.push({ id: newId(), date: slot.date, meal: slot.meal, recipeId: recipe.id, title: recipe.name })
  }

  if (entries.length === 0) {
    throw new Error(
      offlineFallback
        ? 'No connection and no saved cookbook recipes — save a few recipes first or try again online.'
        : 'Nothing to fill.',
    )
  }
  await db.planEntries.bulkAdd(entries)
  return { filled: entries.length, offlineFallback }
}

/** Remove all plan entries in the week starting at `start`. */
export async function clearWeek(start: string): Promise<number> {
  const end = addDays(start, 6)
  const entries = await db.planEntries.where('date').between(start, end, true, true).toArray()
  await db.planEntries.bulkDelete(entries.map((e) => e.id))
  return entries.length
}
