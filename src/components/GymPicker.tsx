import { useState } from 'react'
import { db, newId } from '../db'
import type { EquipKey, GymProfile, Settings } from '../types'
import { EQUIPMENT_OPTIONS } from '../lib/equipment'

interface Props {
  settings: Settings
  onClose: () => void
}

export default function GymPicker({ settings, onClose }: Props) {
  const [editing, setEditing] = useState<GymProfile | null>(null)
  const gyms = settings.gyms ?? []

  function save(patch: Partial<Settings>) {
    db.settings.put({ ...settings, ...patch })
  }

  function selectGym(id: string | undefined) {
    save({ activeGymId: id })
    onClose()
  }

  function deleteGym(gym: GymProfile) {
    if (!confirm(`Delete gym “${gym.name}”?`)) return
    save({
      gyms: gyms.filter((g) => g.id !== gym.id),
      activeGymId: settings.activeGymId === gym.id ? undefined : settings.activeGymId,
    })
  }

  if (editing) {
    return (
      <GymEditor
        gym={editing}
        onSave={(gym) => {
          const exists = gyms.some((g) => g.id === gym.id)
          save({ gyms: exists ? gyms.map((g) => (g.id === gym.id ? gym : g)) : [...gyms, gym], activeGymId: gym.id })
          setEditing(null)
          onClose()
        }}
        onCancel={() => setEditing(null)}
      />
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <strong>Where are you training?</strong>
          <button className="btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <p className="muted small" style={{ marginTop: 4 }}>
            Pick a location and routines automatically swap exercises to match its equipment.
          </p>
          <button className="list-item" onClick={() => selectGym(undefined)}>
            <div className="grow">
              <div>Full gym</div>
              <div className="muted">All equipment — no adjustments</div>
            </div>
            {!settings.activeGymId && <span className="small" style={{ color: 'var(--accent)', fontWeight: 600 }}>Active</span>}
          </button>
          {gyms.map((g) => (
            <div className="list-item" key={g.id} style={{ cursor: 'default' }}>
              <button
                className="grow"
                style={{ background: 'none', padding: 0, textAlign: 'left', minHeight: 40 }}
                onClick={() => selectGym(g.id)}
              >
                <div>{g.name}</div>
                <div className="muted small">
                  {g.equipment.length === 0
                    ? 'Bodyweight only'
                    : EQUIPMENT_OPTIONS.filter((o) => g.equipment.includes(o.key))
                        .map((o) => o.label)
                        .join(', ')}
                </div>
              </button>
              {settings.activeGymId === g.id && (
                <span className="small" style={{ color: 'var(--accent)', fontWeight: 600 }}>Active</span>
              )}
              <button className="btn-icon btn-ghost" onClick={() => setEditing(g)} aria-label={`Edit ${g.name}`}>
                ✎
              </button>
              <button className="btn-icon btn-ghost" onClick={() => deleteGym(g)} aria-label={`Delete ${g.name}`}>
                ✕
              </button>
            </div>
          ))}
          <button
            className="btn-ghost btn-wide"
            onClick={() => setEditing({ id: newId(), name: '', equipment: ['dumbbell'] })}
          >
            + Add a gym
          </button>
        </div>
      </div>
    </div>
  )
}

function GymEditor({
  gym,
  onSave,
  onCancel,
}: {
  gym: GymProfile
  onSave: (gym: GymProfile) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(gym.name)
  const [equipment, setEquipment] = useState<EquipKey[]>(gym.equipment)

  function toggle(key: EquipKey) {
    setEquipment((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <strong>{gym.name ? `Edit ${gym.name}` : 'New gym'}</strong>
          <button className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
        <div className="modal-body">
          <label className="field">
            <span>Name</span>
            <input autoFocus placeholder="e.g. Hotel gym" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <p className="muted small">Available equipment (bodyweight is always assumed):</p>
          {EQUIPMENT_OPTIONS.map((o) => (
            <label key={o.key} className="row" style={{ padding: '8px 2px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={equipment.includes(o.key)}
                onChange={() => toggle(o.key)}
                style={{ width: 20, minHeight: 20 }}
              />
              <span className="ink2">{o.label}</span>
            </label>
          ))}
          <button
            className="btn-primary btn-wide"
            style={{ marginTop: 12 }}
            disabled={!name.trim()}
            onClick={() => onSave({ ...gym, name: name.trim(), equipment })}
          >
            Save & use this gym
          </button>
        </div>
      </div>
    </div>
  )
}
