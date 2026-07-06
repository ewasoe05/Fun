import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db, newId } from '../db'
import type { Routine } from '../types'
import { IconClipboard } from '../components/icons'

export default function RoutinesScreen() {
  const navigate = useNavigate()
  const routines = useLiveQuery(() => db.routines.orderBy('createdAt').toArray(), [])

  async function createRoutine() {
    const routine: Routine = { id: newId(), name: 'New routine', entries: [], createdAt: Date.now() }
    await db.routines.add(routine)
    navigate(`/routines/${routine.id}`)
  }

  if (!routines) return null

  return (
    <>
      <h1>Routines</h1>
      <button className="btn-primary btn-wide" onClick={createRoutine}>
        + New routine
      </button>
      <div style={{ marginTop: 16 }}>
        {routines.length === 0 && (
          <div className="empty">
            <div style={{ color: 'var(--muted)', marginBottom: 8 }}>
              <IconClipboard size={36} />
            </div>
            Routines pre-load your workout with exercises and target sets — like Push, Pull, Legs.
          </div>
        )}
        {routines.map((r) => (
          <button key={r.id} className="list-item" onClick={() => navigate(`/routines/${r.id}`)}>
            <div className="grow">
              <div>{r.name}</div>
              <div className="muted">
                {r.entries.length === 0 ? 'No exercises yet' : `${r.entries.length} exercises`}
              </div>
            </div>
            <span className="muted">Edit ›</span>
          </button>
        ))}
      </div>
    </>
  )
}
