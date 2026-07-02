import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId } from '../db'
import type { Exercise } from '../types'
import { importWgerExercise, searchWger, type WgerExercise } from '../api/wger'

interface Props {
  onSelect: (exercise: Exercise) => void
  autoFocus?: boolean
}

/** Local library search plus on-demand online search of the wger exercise database. */
export default function ExerciseSearch({ onSelect, autoFocus }: Props) {
  const [query, setQuery] = useState('')
  const [online, setOnline] = useState<WgerExercise[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [importing, setImporting] = useState<number | null>(null)
  const [error, setError] = useState('')

  const all = useLiveQuery(() => db.exercises.toArray(), []) ?? []
  const q = query.trim().toLowerCase()
  const local = useMemo(() => {
    const filtered = q ? all.filter((e) => e.name.toLowerCase().includes(q)) : all
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 60)
  }, [all, q])

  const localWgerIds = useMemo(() => new Set(all.map((e) => e.wgerId).filter(Boolean)), [all])

  async function searchOnline() {
    setSearching(true)
    setError('')
    try {
      const results = await searchWger(query.trim())
      setOnline(results.filter((r) => !localWgerIds.has(r.baseId)))
    } catch {
      setError('Online search failed — check your connection and try again.')
    } finally {
      setSearching(false)
    }
  }

  async function pickOnline(r: WgerExercise) {
    setImporting(r.baseId)
    setError('')
    try {
      onSelect(await importWgerExercise(r))
    } catch {
      setError('Could not save that exercise — try again.')
    } finally {
      setImporting(null)
    }
  }

  async function createCustom() {
    const ex: Exercise = {
      id: newId(),
      name: query.trim(),
      category: 'Custom',
      primaryMuscles: [],
      equipment: '',
      instructions: '',
      source: 'custom',
    }
    await db.exercises.add(ex)
    onSelect(ex)
  }

  return (
    <>
      <input
        autoFocus={autoFocus}
        placeholder="Search exercises…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOnline(null)
        }}
      />
      <div style={{ marginTop: 12 }}>
        {local.map((e) => (
          <button key={e.id} className="list-item" onClick={() => onSelect(e)}>
            {e.imageUrl && <img className="thumb" src={e.imageUrl} alt="" loading="lazy" />}
            <div className="grow">
              <div>{e.name}</div>
              <div className="muted">
                {[e.category, e.equipment].filter(Boolean).join(' · ')}
                {e.source === 'wger' ? ' · wger' : ''}
              </div>
            </div>
          </button>
        ))}
        {q.length >= 2 && (
          <>
            <button className="btn-ghost btn-wide" onClick={searchOnline} disabled={searching}>
              {searching ? 'Searching wger.de…' : `Search online for “${query.trim()}”`}
            </button>
            {error && <p className="small" style={{ color: 'var(--danger)' }}>{error}</p>}
            {online && online.length === 0 && <p className="empty">No new online results.</p>}
            {online?.map((r) => (
              <button
                key={r.baseId}
                className="list-item"
                disabled={importing !== null}
                onClick={() => pickOnline(r)}
              >
                {r.imageUrl && <img className="thumb" src={r.imageUrl} alt="" loading="lazy" />}
                <div className="grow">
                  <div>{r.name}</div>
                  <div className="muted">{r.category} · from wger.de</div>
                </div>
                {importing === r.baseId && <span className="muted">…</span>}
              </button>
            ))}
            <button className="btn-ghost btn-wide" style={{ marginTop: 8 }} onClick={createCustom}>
              Create custom exercise “{query.trim()}”
            </button>
          </>
        )}
      </div>
    </>
  )
}
