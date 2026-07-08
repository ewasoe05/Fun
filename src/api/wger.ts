import { db } from '../db'
import type { Exercise } from '../types'
import { config } from '../config'

const BASE = config.wgerApiBase
const ENGLISH = 2 // wger language id for English

/** A wger exercise parsed from the API but not yet saved to the local library. */
export interface WgerExercise {
  baseId: number
  name: string
  category: string
  primaryMuscles: string[]
  equipment: string
  instructions: string
  imageUrl?: string
  videoUrl?: string
}

function htmlToText(html: string): string {
  const withBreaks = html
    .replace(/<\/(p|li|ol|ul|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<br\s*\/?>/gi, '\n')
  const doc = new DOMParser().parseFromString(withBreaks, 'text/html')
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim()
}

function parseInfo(info: any): WgerExercise | null {
  if (typeof info?.id !== 'number') return null
  const translations: any[] = info.translations ?? []
  const en = translations.find((t) => Number(t.language) === ENGLISH) ?? translations[0]
  if (!en?.name) return null
  const muscles = [...(info.muscles ?? []), ...(info.muscles_secondary ?? [])]
    .map((m: any) => m.name_en || m.name)
    .filter(Boolean)
  return {
    baseId: info.id,
    name: en.name,
    category: info.category?.name ?? '',
    primaryMuscles: [...new Set<string>(muscles)],
    equipment: (info.equipment ?? []).map((e: any) => e.name).join(', '),
    instructions: en.description ? htmlToText(en.description) : '',
    imageUrl: info.images?.[0]?.image ?? undefined,
    videoUrl: info.videos?.[0]?.video ?? undefined,
  }
}

/** Full-text search of the free wger exercise database. Requires network. */
export async function searchWger(term: string): Promise<WgerExercise[]> {
  const url = `${BASE}/exerciseinfo/?format=json&limit=25&name__search=${encodeURIComponent(term)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`wger search failed (${res.status})`)
  const json = await res.json()
  const parsed = ((json.results ?? []) as any[])
    .map(parseInfo)
    .filter((e): e is WgerExercise => e !== null)
  // closest name matches first
  const q = term.trim().toLowerCase()
  return parsed.sort((a, b) => Number(b.name.toLowerCase().includes(q)) - Number(a.name.toLowerCase().includes(q)))
}

/** Save a wger search result into the local library (cached copy wins if it exists). */
export async function importWgerExercise(ex: WgerExercise): Promise<Exercise> {
  const cached = await db.exercises.where('wgerId').equals(ex.baseId).first()
  if (cached) return cached
  const exercise: Exercise = {
    id: `wger-${ex.baseId}`,
    wgerId: ex.baseId,
    source: 'wger',
    name: ex.name,
    category: ex.category,
    primaryMuscles: ex.primaryMuscles,
    equipment: ex.equipment,
    instructions: ex.instructions,
    imageUrl: ex.imageUrl,
    videoUrl: ex.videoUrl,
  }
  await db.exercises.put(exercise)
  return exercise
}

export function youtubeFormSearchUrl(exerciseName: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(exerciseName + ' proper form')}`
}
