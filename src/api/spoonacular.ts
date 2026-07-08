import type { MacroSet } from '../types'

import { config } from '../config'

const BASE = config.spoonacularApiBase

/** An online recipe with computed nutrition (per serving). */
export interface SpoonRecipe {
  spoonId: number
  name: string
  imageUrl?: string
  sourceUrl?: string
  perPortion: MacroSet
}

function nutrient(nutrients: any[], name: string): number {
  const n = nutrients?.find((x) => x?.name === name)
  return Number.isFinite(n?.amount) ? Math.round(n.amount * 10) / 10 : 0
}

/**
 * Recipes of a given type with nutrition, roughly under a calorie cap.
 * types: 'breakfast' | 'main course' | 'snack'
 */
export async function searchRecipesWithNutrition(
  apiKey: string,
  type: string,
  maxKcal: number,
  number = 20,
): Promise<SpoonRecipe[]> {
  const url =
    `${BASE}/recipes/complexSearch?type=${encodeURIComponent(type)}` +
    `&maxCalories=${Math.round(maxKcal)}&minCalories=${Math.round(maxKcal * 0.3)}` +
    `&number=${number}&addRecipeNutrition=true&sort=random&apiKey=${encodeURIComponent(apiKey)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Spoonacular request failed (${res.status})`)
  const json = await res.json()
  const out: SpoonRecipe[] = []
  for (const r of json.results ?? []) {
    const nutrients = r?.nutrition?.nutrients ?? []
    const kcal = nutrient(nutrients, 'Calories')
    if (!r?.id || !r?.title || kcal <= 0) continue
    out.push({
      spoonId: r.id,
      name: r.title,
      imageUrl: r.image || undefined,
      sourceUrl: r.sourceUrl || (r.id ? `https://spoonacular.com/recipes/-${r.id}` : undefined),
      perPortion: {
        kcal: Math.round(kcal),
        protein: nutrient(nutrients, 'Protein'),
        carbs: nutrient(nutrients, 'Carbohydrates'),
        fat: nutrient(nutrients, 'Fat'),
      },
    })
  }
  return out
}
