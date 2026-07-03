import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId } from '../db'
import type { Food, MacroSet } from '../types'
import { foodByBarcode, searchFoods, type FoodDraft } from '../api/openFoodFacts'
import { scalePer100g } from '../lib/nutrition'
import BarcodeScanner from './BarcodeScanner'

/** A diary entry draft — the caller adds id/date/meal/loggedAt. */
export interface PendingLog extends MacroSet {
  foodId?: string
  name: string
  grams: number
}

interface Props {
  onAdd: (entry: PendingLog) => void
  onClose: () => void
}

type View =
  | { kind: 'browse' }
  | { kind: 'portion'; food: Food }
  | { kind: 'quick' }
  | { kind: 'custom' }
  | { kind: 'scan' }

async function saveDraft(d: FoodDraft): Promise<Food> {
  const existing = d.offCode ? await db.foods.where('offCode').equals(d.offCode).first() : undefined
  if (existing) return existing
  const food: Food = {
    id: `off-${d.offCode}`,
    name: d.name,
    brand: d.brand,
    per100g: d.per100g,
    servingG: d.servingG,
    imageUrl: d.imageUrl,
    source: 'off',
    offCode: d.offCode,
    favorite: 0,
  }
  await db.foods.put(food)
  return food
}

export default function FoodPicker({ onAdd, onClose }: Props) {
  const [view, setView] = useState<View>({ kind: 'browse' })
  const [query, setQuery] = useState('')
  const [online, setOnline] = useState<FoodDraft[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const foods = useLiveQuery(() => db.foods.toArray(), []) ?? []
  const q = query.trim().toLowerCase()

  const shown = useMemo(() => {
    if (q) {
      return foods
        .filter((f) => f.name.toLowerCase().includes(q) || f.brand?.toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 40)
    }
    // no query: favorites first, then most recently used
    return [...foods]
      .sort((a, b) => b.favorite - a.favorite || (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0))
      .filter((f) => f.favorite === 1 || f.lastUsedAt)
      .slice(0, 20)
  }, [foods, q])

  async function searchOnline() {
    setBusy(true)
    setError('')
    try {
      setOnline(await searchFoods(query.trim()))
    } catch {
      setError('Food search failed — check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  async function pickDraft(d: FoodDraft) {
    setView({ kind: 'portion', food: await saveDraft(d) })
  }

  async function scanned(code: string) {
    setView({ kind: 'browse' })
    setBusy(true)
    setError('')
    try {
      const draft = await foodByBarcode(code)
      if (!draft) setError(`Barcode ${code} isn't in Open Food Facts — try searching by name.`)
      else await pickDraft(draft)
    } catch {
      setError('Barcode lookup failed — check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <strong>
            {view.kind === 'portion' ? 'How much?' : view.kind === 'quick' ? 'Quick add' : view.kind === 'custom' ? 'New food' : 'Add food'}
          </strong>
          <button className="btn-ghost" onClick={view.kind === 'browse' ? onClose : () => setView({ kind: 'browse' })}>
            {view.kind === 'browse' ? 'Close' : '‹ Back'}
          </button>
        </div>
        <div className="modal-body">
          {view.kind === 'browse' && (
            <>
              <div className="row" style={{ marginBottom: 10 }}>
                <button className="btn-ghost grow" onClick={() => setView({ kind: 'scan' })}>
                  📷 Scan
                </button>
                <button className="btn-ghost grow" onClick={() => setView({ kind: 'quick' })}>
                  ⚡ Quick add
                </button>
                <button className="btn-ghost grow" onClick={() => setView({ kind: 'custom' })}>
                  + New food
                </button>
              </div>
              <input
                autoFocus
                placeholder="Search foods…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setOnline(null)
                }}
              />
              {error && <p className="small" style={{ color: 'var(--danger)' }}>{error}</p>}
              {busy && !online && <p className="muted small">Looking up…</p>}
              <div style={{ marginTop: 10 }}>
                {!q && shown.length === 0 && (
                  <p className="empty">Foods you log will show up here for one-tap re-adding.</p>
                )}
                {shown.map((f) => (
                  <button key={f.id} className="list-item" onClick={() => setView({ kind: 'portion', food: f })}>
                    {f.imageUrl && <img className="thumb" src={f.imageUrl} alt="" loading="lazy" />}
                    <div className="grow">
                      <div>
                        {f.favorite === 1 ? '★ ' : ''}
                        {f.name}
                      </div>
                      <div className="muted">
                        {[f.brand, `${f.per100g.kcal} kcal/100g`].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  </button>
                ))}
                {q.length >= 2 && (
                  <>
                    <button className="btn-ghost btn-wide" onClick={searchOnline} disabled={busy}>
                      {busy ? 'Searching Open Food Facts…' : `Search online for “${query.trim()}”`}
                    </button>
                    {online && online.length === 0 && <p className="empty">No online results.</p>}
                    {online?.map((d) => (
                      <button key={d.offCode} className="list-item" onClick={() => pickDraft(d)}>
                        {d.imageUrl && <img className="thumb" src={d.imageUrl} alt="" loading="lazy" />}
                        <div className="grow">
                          <div>{d.name}</div>
                          <div className="muted">
                            {[d.brand, `${d.per100g.kcal} kcal/100g`, 'Open Food Facts'].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </div>
            </>
          )}

          {view.kind === 'portion' && <PortionStep food={view.food} onAdd={onAdd} />}
          {view.kind === 'quick' && <QuickAdd onAdd={onAdd} />}
          {view.kind === 'custom' && <CustomFood onCreated={(f) => setView({ kind: 'portion', food: f })} />}
        </div>
      </div>
      {view.kind === 'scan' && (
        <BarcodeScanner onDetected={scanned} onClose={() => setView({ kind: 'browse' })} />
      )}
    </div>
  )
}

function PortionStep({ food, onAdd }: { food: Food; onAdd: (entry: PendingLog) => void }) {
  const [fav, setFav] = useState(food.favorite === 1)
  const [gramsStr, setGramsStr] = useState(String(food.servingG ?? 100))
  const grams = parseFloat(gramsStr)
  const valid = Number.isFinite(grams) && grams > 0
  const macros = valid ? scalePer100g(food.per100g, grams) : null

  function add() {
    if (!macros || !valid) return
    db.foods.update(food.id, { lastUsedAt: Date.now(), favorite: fav ? 1 : 0 })
    onAdd({
      foodId: food.id,
      name: food.brand ? `${food.name} (${food.brand})` : food.name,
      grams: Math.round(grams),
      ...macros,
    })
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        {food.imageUrl && <img className="thumb" src={food.imageUrl} alt="" />}
        <div className="grow">
          <div>{food.name}</div>
          <div className="muted small">
            {[food.brand, `${food.per100g.kcal} kcal / 100g`].filter(Boolean).join(' · ')}
          </div>
        </div>
        <button className="btn-icon btn-ghost" onClick={() => setFav(!fav)} aria-label="Favorite">
          {fav ? '★' : '☆'}
        </button>
      </div>
      <label className="field">
        <span>Amount (grams)</span>
        <input inputMode="decimal" autoFocus value={gramsStr} onChange={(e) => setGramsStr(e.target.value)} />
      </label>
      {food.servingG && (
        <div className="row" style={{ marginBottom: 12 }}>
          {[0.5, 1, 2].map((mult) => (
            <button key={mult} className="btn-ghost grow" onClick={() => setGramsStr(String(Math.round(food.servingG! * mult)))}>
              {mult === 0.5 ? '½' : mult} serving{mult === 2 ? 's' : ''}
            </button>
          ))}
        </div>
      )}
      <p className="ink2" style={{ margin: '4px 0 12px' }}>
        {macros
          ? `${macros.kcal} kcal · P ${macros.protein}g · C ${macros.carbs}g · F ${macros.fat}g`
          : 'Enter an amount'}
      </p>
      <button className="btn-primary btn-wide" disabled={!valid} onClick={add}>
        Add to diary
      </button>
    </>
  )
}

function QuickAdd({ onAdd }: { onAdd: (entry: PendingLog) => void }) {
  const [name, setName] = useState('')
  const [vals, setVals] = useState({ kcal: '', protein: '', carbs: '', fat: '' })
  const kcal = parseFloat(vals.kcal)
  const num = (s: string) => {
    const v = parseFloat(s)
    return Number.isFinite(v) && v > 0 ? Math.round(v * 10) / 10 : 0
  }
  return (
    <>
      <label className="field">
        <span>Name (optional)</span>
        <input placeholder="Quick add" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span>Calories (kcal)</span>
        <input inputMode="numeric" autoFocus value={vals.kcal} onChange={(e) => setVals({ ...vals, kcal: e.target.value })} />
      </label>
      <div className="row">
        {(['protein', 'carbs', 'fat'] as const).map((k) => (
          <label key={k} className="field grow" style={{ marginBottom: 12 }}>
            <span>{k[0].toUpperCase() + k.slice(1)} (g)</span>
            <input inputMode="decimal" value={vals[k]} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} />
          </label>
        ))}
      </div>
      <button
        className="btn-primary btn-wide"
        disabled={!Number.isFinite(kcal) || kcal <= 0}
        onClick={() =>
          onAdd({
            name: name.trim() || 'Quick add',
            grams: 0,
            kcal: Math.round(kcal),
            protein: num(vals.protein),
            carbs: num(vals.carbs),
            fat: num(vals.fat),
          })
        }
      >
        Add to diary
      </button>
    </>
  )
}

function CustomFood({ onCreated }: { onCreated: (food: Food) => void }) {
  const [name, setName] = useState('')
  const [vals, setVals] = useState({ kcal: '', protein: '', carbs: '', fat: '', servingG: '' })
  const kcal = parseFloat(vals.kcal)
  const valid = name.trim().length > 0 && Number.isFinite(kcal) && kcal >= 0
  const num = (s: string) => {
    const v = parseFloat(s)
    return Number.isFinite(v) && v > 0 ? Math.round(v * 10) / 10 : 0
  }
  async function create() {
    const serving = parseFloat(vals.servingG)
    const food: Food = {
      id: newId(),
      name: name.trim(),
      per100g: { kcal: Math.round(kcal), protein: num(vals.protein), carbs: num(vals.carbs), fat: num(vals.fat) },
      servingG: Number.isFinite(serving) && serving > 0 ? Math.round(serving) : undefined,
      source: 'custom',
      favorite: 0,
    }
    await db.foods.add(food)
    onCreated(food)
  }
  return (
    <>
      <label className="field">
        <span>Name</span>
        <input autoFocus placeholder="e.g. Homemade granola" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <p className="muted small" style={{ marginTop: -6 }}>
        Nutrition per 100 g:
      </p>
      <div className="row">
        <label className="field grow">
          <span>kcal</span>
          <input inputMode="numeric" value={vals.kcal} onChange={(e) => setVals({ ...vals, kcal: e.target.value })} />
        </label>
        {(['protein', 'carbs', 'fat'] as const).map((k) => (
          <label key={k} className="field grow">
            <span>{k[0].toUpperCase() + k.slice(1, 4)} g</span>
            <input inputMode="decimal" value={vals[k]} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} />
          </label>
        ))}
      </div>
      <label className="field">
        <span>Serving size in grams (optional)</span>
        <input inputMode="numeric" value={vals.servingG} onChange={(e) => setVals({ ...vals, servingG: e.target.value })} />
      </label>
      <button className="btn-primary btn-wide" disabled={!valid} onClick={create}>
        Save food
      </button>
    </>
  )
}
