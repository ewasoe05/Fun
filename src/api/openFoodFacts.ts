import type { MacroSet } from '../types'

import { config } from '../config'

const SEARCH_URL = config.offSearchUrl
const PRODUCT_URL = config.offProductBase
const FIELDS = 'code,product_name,brands,nutriments,serving_quantity,image_front_small_url'

/** A food parsed from Open Food Facts but not yet saved to the local library. */
export interface FoodDraft {
  offCode: string
  name: string
  brand?: string
  per100g: MacroSet
  servingG?: number
  imageUrl?: string
}

/** The legacy OFF search endpoint 503s sporadically — retry a couple of times. */
async function fetchRetry(url: string, tries = 3): Promise<Response> {
  let lastErr: unknown
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) return res
      if (res.status !== 503 && res.status !== 429) return res
      lastErr = new Error(`HTTP ${res.status}`)
    } catch (err) {
      lastErr = err
    }
    await new Promise((r) => setTimeout(r, 700 * (i + 1)))
  }
  throw lastErr instanceof Error ? lastErr : new Error('request failed')
}

function parseProduct(p: any): FoodDraft | null {
  const n = p?.nutriments ?? {}
  const kcal = Number(n['energy-kcal_100g'])
  const name = (p?.product_name ?? '').trim()
  if (!name || !Number.isFinite(kcal) || kcal < 0) return null
  const num = (v: unknown) => {
    const x = Number(v)
    return Number.isFinite(x) && x >= 0 ? Math.round(x * 10) / 10 : 0
  }
  const serving = Number(p.serving_quantity)
  return {
    offCode: String(p.code ?? ''),
    name,
    brand: (p.brands ?? '').split(',')[0].trim() || undefined,
    per100g: {
      kcal: Math.round(kcal),
      protein: num(n['proteins_100g']),
      carbs: num(n['carbohydrates_100g']),
      fat: num(n['fat_100g']),
    },
    servingG: Number.isFinite(serving) && serving > 0 ? serving : undefined,
    imageUrl: p.image_front_small_url || undefined,
  }
}

/** Full-text food search on Open Food Facts. Requires network. */
export async function searchFoods(term: string): Promise<FoodDraft[]> {
  const url = `${SEARCH_URL}?search_terms=${encodeURIComponent(term)}&search_simple=1&action=process&json=1&page_size=20&fields=${FIELDS}`
  const res = await fetchRetry(url)
  if (!res.ok) throw new Error(`food search failed (${res.status})`)
  const json = await res.json()
  const seen = new Set<string>()
  const out: FoodDraft[] = []
  for (const p of json.products ?? []) {
    const draft = parseProduct(p)
    if (draft && draft.offCode && !seen.has(draft.offCode)) {
      seen.add(draft.offCode)
      out.push(draft)
    }
  }
  return out
}

/** Barcode lookup. Returns null when the product isn't in the database. */
export async function foodByBarcode(code: string): Promise<FoodDraft | null> {
  const clean = code.replace(/\D/g, '')
  if (!clean) return null
  const res = await fetchRetry(`${PRODUCT_URL}/${clean}?fields=${FIELDS}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`barcode lookup failed (${res.status})`)
  const json = await res.json()
  if (json.status !== 1 || !json.product) return null
  return parseProduct({ ...json.product, code: json.code ?? clean })
}
