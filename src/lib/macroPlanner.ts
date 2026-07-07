import { db, getSettings, newId } from '../db'
import type { MacroSet, PlanEntry, PlanMeal, Settings } from '../types'
import { PLAN_MEALS } from '../types'
import { addDays, suggestTargets } from './nutrition'
import { searchRecipesWithNutrition, type SpoonRecipe } from '../api/spoonacular'
import templates from '../data/meal-templates.json'

interface Template {
  id: string
  name: string
  slots: PlanMeal[]
  kcal: number
  protein: number
  carbs: number
  fat: number
  portion: string
  minScale: number
  maxScale: number
}

/** unified candidate: a catalog template or an online recipe */
interface Candidate {
  key: string
  name: string
  perPortion: MacroSet
  portionText?: string
  sourceUrl?: string
  minScale: number
  maxScale: number
}

const CATALOG = templates as Template[]

/** share of the daily targets given to each slot */
const SLOT_SHARE: Record<PlanMeal, number> = { breakfast: 0.24, lunch: 0.29, dinner: 0.32, snack: 0.15 }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function scaleMacros(m: MacroSet, s: number): MacroSet {
  return {
    kcal: Math.round(m.kcal * s),
    protein: Math.round(m.protein * s * 10) / 10,
    carbs: Math.round(m.carbs * s * 10) / 10,
    fat: Math.round(m.fat * s * 10) / 10,
  }
}

/** weighted relative error vs a budget — protein matters most, calories next */
function fitError(m: MacroSet, budget: MacroSet): number {
  const rel = (a: number, b: number) => (b > 0 ? Math.abs(a - b) / b : 0)
  return rel(m.kcal, budget.kcal) + 2 * rel(m.protein, budget.protein) + 0.6 * rel(m.carbs, budget.carbs) + 0.6 * rel(m.fat, budget.fat)
}

/** best 0.25-step portion scale for a candidate against a slot budget */
function bestScale(c: Candidate, budget: MacroSet): number {
  const raw = budget.kcal / Math.max(1, c.perPortion.kcal)
  const snapped = Math.round(raw * 4) / 4
  return Math.min(c.maxScale, Math.max(c.minScale, snapped))
}

function pickForSlot(pool: Candidate[], budget: MacroSet, used: Set<string>): { c: Candidate; scale: number } | null {
  let best: { c: Candidate; scale: number; err: number } | null = null
  let tried = 0
  for (const c of pool) {
    if (used.has(c.key)) continue
    const scale = bestScale(c, budget)
    const err = fitError(scaleMacros(c.perPortion, scale), budget)
    if (!best || err < best.err) best = { c, scale, err }
    if (++tried >= 12 && best.err < 0.5) break // good enough — keeps picks varied
  }
  return best ? { c: best.c, scale: best.scale } : null
}

function candidatesFromCatalog(slot: PlanMeal): Candidate[] {
  return CATALOG.filter((t) => t.slots.includes(slot)).map((t) => ({
    key: `tpl-${t.id}`,
    name: t.name,
    perPortion: { kcal: t.kcal, protein: t.protein, carbs: t.carbs, fat: t.fat },
    portionText: t.portion,
    minScale: t.minScale,
    maxScale: t.maxScale,
  }))
}

function candidateFromSpoon(r: SpoonRecipe): Candidate {
  return {
    key: `spoon-${r.spoonId}`,
    name: r.name,
    perPortion: r.perPortion,
    sourceUrl: r.sourceUrl,
    minScale: 0.5,
    maxScale: 2,
  }
}

async function resolveTargets(settings: Settings): Promise<MacroSet> {
  if (settings.kcalTarget && settings.proteinTarget && settings.carbsTarget && settings.fatTarget) {
    return {
      kcal: settings.kcalTarget,
      protein: settings.proteinTarget,
      carbs: settings.carbsTarget,
      fat: settings.fatTarget,
    }
  }
  const computed = suggestTargets(settings)
  if (!computed) {
    throw new Error(
      'Set your height, weight, birth year, activity, and goal in Settings → Nutrition first — the plan is fitted to the targets calculated from them.',
    )
  }
  await db.settings.put({
    ...settings,
    kcalTarget: computed.kcal,
    proteinTarget: computed.protein,
    carbsTarget: computed.carbs,
    fatTarget: computed.fat,
  })
  return computed
}

export interface MacroFillResult {
  filled: number
  usedOnline: boolean
}

/**
 * Fill every EMPTY slot of the week with meals fitted to the user's daily
 * calorie/protein/carb/fat targets (computed from their stats). Uses the
 * built-in catalog, blended with Spoonacular recipes when a key is set.
 */
export async function fillWeekMacros(start: string): Promise<MacroFillResult> {
  const settings = await getSettings()
  const targets = await resolveTargets(settings)

  const end = addDays(start, 6)
  const existing = await db.planEntries.where('date').between(start, end, true, true).toArray()
  const taken = new Set(existing.map((e) => `${e.date}|${e.meal}`))

  // candidate pools per slot: catalog + optional online recipes
  const pools: Record<PlanMeal, Candidate[]> = {
    breakfast: candidatesFromCatalog('breakfast'),
    lunch: candidatesFromCatalog('lunch'),
    dinner: candidatesFromCatalog('dinner'),
    snack: candidatesFromCatalog('snack'),
  }
  let usedOnline = false
  if (settings.spoonacularKey && navigator.onLine !== false) {
    try {
      const key = settings.spoonacularKey
      const [breakfast, mains, snacks] = await Promise.all([
        searchRecipesWithNutrition(key, 'breakfast', targets.kcal * SLOT_SHARE.breakfast * 1.4),
        searchRecipesWithNutrition(key, 'main course', targets.kcal * SLOT_SHARE.dinner * 1.4),
        searchRecipesWithNutrition(key, 'snack', targets.kcal * SLOT_SHARE.snack * 1.6),
      ])
      pools.breakfast.push(...breakfast.map(candidateFromSpoon))
      pools.lunch.push(...mains.map(candidateFromSpoon))
      pools.dinner.push(...mains.map(candidateFromSpoon))
      pools.snack.push(...snacks.map(candidateFromSpoon))
      usedOnline = breakfast.length + mains.length + snacks.length > 0
    } catch {
      // key invalid / quota / offline — the catalog alone still fits macros
    }
  }
  for (const meal of PLAN_MEALS) pools[meal] = shuffle(pools[meal])

  const used = new Set<string>()
  const entries: PlanEntry[] = []

  for (let d = 0; d < 7; d++) {
    const date = addDays(start, d)
    const dayPicks: { meal: PlanMeal; c: Candidate; scale: number }[] = []
    for (const meal of PLAN_MEALS) {
      if (taken.has(`${date}|${meal}`)) continue
      const budget = scaleMacros(targets, SLOT_SHARE[meal])
      const pick = pickForSlot(pools[meal], budget, used)
      if (!pick) continue
      used.add(pick.c.key)
      dayPicks.push({ meal, ...pick })
    }
    // day repair: nudge the dinner portion to close the day's calorie gap
    if (dayPicks.length === PLAN_MEALS.length) {
      const dayKcal = dayPicks.reduce((s, p) => s + p.c.perPortion.kcal * p.scale, 0)
      const dinner = dayPicks.find((p) => p.meal === 'dinner')
      if (dinner) {
        const corrected = dinner.scale + (targets.kcal - dayKcal) / dinner.c.perPortion.kcal
        dinner.scale = Math.min(dinner.c.maxScale, Math.max(dinner.c.minScale, Math.round(corrected * 4) / 4))
      }
    }
    for (const p of dayPicks) {
      const macros = scaleMacros(p.c.perPortion, p.scale)
      entries.push({
        id: newId(),
        date,
        meal: p.meal,
        title: p.c.name,
        macros,
        portionDesc: `${p.scale === 1 ? '' : `${p.scale}× · `}${p.c.portionText ?? `${p.scale} serving${p.scale === 1 ? '' : 's'}`}`,
        sourceUrl: p.c.sourceUrl,
      })
    }
  }

  if (entries.length === 0) return { filled: 0, usedOnline }
  await db.planEntries.bulkAdd(entries)
  return { filled: entries.length, usedOnline }
}
