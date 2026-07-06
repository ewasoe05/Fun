import { useRef, useState } from 'react'
import { db, exportBackup, importBackup } from '../db'
import { useSettings } from '../hooks/useSettings'
import { formatWeight, toKg } from '../lib/units'
import { ACTIVITY_LABELS, GOAL_LABELS, suggestTargets } from '../lib/nutrition'
import type { ActivityLevel, Goal, Settings } from '../types'

export default function SettingsScreen() {
  const settings = useSettings()
  const fileRef = useRef<HTMLInputElement>(null)
  const [bwStr, setBwStr] = useState<string | null>(null)
  const [restStr, setRestStr] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  function save(patch: Partial<Settings>) {
    db.settings.put({ ...settings, ...patch })
  }

  const bwDisplay = bwStr ?? (settings.bodyweightKg ? formatWeight(settings.bodyweightKg, settings.units) : '')

  async function doExport() {
    const json = await exportBackup()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `liftlog-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMessage('Backup downloaded.')
  }

  async function doImport(file: File) {
    if (!confirm('Importing replaces ALL current data with the backup. Continue?')) return
    try {
      await importBackup(await file.text())
      setMessage('Backup imported ✔')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Import failed')
    }
  }

  return (
    <>
      <h1>Settings</h1>

      <label className="field">
        <span>Units</span>
        <select value={settings.units} onChange={(e) => save({ units: e.target.value as Settings['units'] })}>
          <option value="lb">Pounds (lb)</option>
          <option value="kg">Kilograms (kg)</option>
        </select>
      </label>

      <label className="field">
        <span>Bodyweight ({settings.units}) — used for strength standards</span>
        <input
          inputMode="decimal"
          placeholder="e.g. 180"
          value={bwDisplay}
          onChange={(e) => {
            setBwStr(e.target.value)
            const parsed = parseFloat(e.target.value)
            if (Number.isFinite(parsed) && parsed > 0) save({ bodyweightKg: toKg(parsed, settings.units) })
          }}
          onBlur={() => setBwStr(null)}
        />
      </label>

      <label className="field">
        <span>Sex — used for strength standards</span>
        <select value={settings.sex} onChange={(e) => save({ sex: e.target.value as Settings['sex'] })}>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </label>

      <label className="field">
        <span>Default rest between sets (seconds)</span>
        <input
          inputMode="numeric"
          value={restStr ?? String(settings.restSeconds)}
          onChange={(e) => {
            setRestStr(e.target.value)
            const parsed = parseInt(e.target.value, 10)
            if (Number.isFinite(parsed) && parsed > 0) save({ restSeconds: parsed })
          }}
          onBlur={() => setRestStr(null)}
        />
      </label>

      <label className="field">
        <span>Coach & auto-progression</span>
        <select
          value={settings.coachEnabled === false ? 'off' : 'on'}
          onChange={(e) => save({ coachEnabled: e.target.value === 'on' })}
        >
          <option value="on">On — auto-adjust next workout's weights & show insights</option>
          <option value="off">Off — always pre-fill last session's numbers</option>
        </select>
      </label>

      <h2>Nutrition</h2>
      <NumSetting
        label="Height (cm)"
        value={settings.heightCm}
        onChange={(v) => save({ heightCm: v })}
        placeholder="e.g. 178"
      />
      <NumSetting
        label="Birth year"
        value={settings.birthYear}
        onChange={(v) => save({ birthYear: v })}
        placeholder="e.g. 1995"
      />
      <label className="field">
        <span>Activity level</span>
        <select
          value={settings.activityLevel ?? ''}
          onChange={(e) => save({ activityLevel: (e.target.value || undefined) as ActivityLevel | undefined })}
        >
          <option value="">Choose…</option>
          {Object.entries(ACTIVITY_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Goal</span>
        <select
          value={settings.goal ?? ''}
          onChange={(e) => save({ goal: (e.target.value || undefined) as Goal | undefined })}
        >
          <option value="">Choose…</option>
          {Object.entries(GOAL_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <button
        className="btn-ghost btn-wide"
        onClick={() => {
          const t = suggestTargets(settings)
          if (!t) {
            setMessage('Fill in bodyweight (above), height, birth year, activity, and goal first.')
          } else {
            save({ kcalTarget: t.kcal, proteinTarget: t.protein, carbsTarget: t.carbs, fatTarget: t.fat })
            setMessage(`Suggested: ${t.kcal} kcal · P ${t.protein}g · C ${t.carbs}g · F ${t.fat}g — tweak below.`)
          }
        }}
      >
        Calculate suggested targets
      </button>
      <p className="muted small">
        Uses the Mifflin-St Jeor formula with your bodyweight, height, age, activity, and goal. Edit the results
        freely:
      </p>
      <div className="row">
        <NumSetting label="kcal target" value={settings.kcalTarget} onChange={(v) => save({ kcalTarget: v })} grow />
        <NumSetting label="Protein g" value={settings.proteinTarget} onChange={(v) => save({ proteinTarget: v })} grow />
      </div>
      <div className="row">
        <NumSetting label="Carbs g" value={settings.carbsTarget} onChange={(v) => save({ carbsTarget: v })} grow />
        <NumSetting label="Fat g" value={settings.fatTarget} onChange={(v) => save({ fatTarget: v })} grow />
      </div>

      {typeof Notification !== 'undefined' && Notification.permission === 'default' && (
        <button className="btn-ghost btn-wide" onClick={() => Notification.requestPermission()}>
          Enable rest-timer notifications
        </button>
      )}

      <h2>Backup</h2>
      <p className="muted small">
        Your data lives only on this device. Export a backup file now and then — you can restore it here or move it to
        a new phone.
      </p>
      <div className="row">
        <button className="btn-primary grow" onClick={doExport}>
          Export data
        </button>
        <button className="btn-ghost grow" onClick={() => fileRef.current?.click()}>
          Import data
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) doImport(f)
          e.target.value = ''
        }}
      />
      {message && <p className="ink2 small">{message}</p>}

      <h2>About</h2>
      <p className="muted small">
        Lift Log — a local-first workout tracker. Exercise data from the free{' '}
        <a className="text-link" href="https://wger.de" target="_blank" rel="noreferrer">
          wger.de
        </a>{' '}
        database (CC-BY-SA). Food data from{' '}
        <a className="text-link" href="https://openfoodfacts.org" target="_blank" rel="noreferrer">
          Open Food Facts
        </a>
        ; recipes from{' '}
        <a className="text-link" href="https://www.themealdb.com" target="_blank" rel="noreferrer">
          TheMealDB
        </a>
        . Cloud sync across devices isn't built in yet; use Export/Import to move your data.
      </p>
    </>
  )
}

function NumSetting({
  label,
  value,
  onChange,
  placeholder,
  grow,
}: {
  label: string
  value?: number
  onChange: (v: number | undefined) => void
  placeholder?: string
  grow?: boolean
}) {
  const [str, setStr] = useState<string | null>(null)
  return (
    <label className={`field ${grow ? 'grow' : ''}`}>
      <span>{label}</span>
      <input
        inputMode="numeric"
        placeholder={placeholder}
        value={str ?? (value != null ? String(value) : '')}
        onChange={(e) => {
          setStr(e.target.value)
          const parsed = parseFloat(e.target.value)
          onChange(Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined)
        }}
        onBlur={() => setStr(null)}
      />
    </label>
  )
}
