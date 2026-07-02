import { useRef, useState } from 'react'
import { db, exportBackup, importBackup } from '../db'
import { useSettings } from '../hooks/useSettings'
import { formatWeight, toKg } from '../lib/units'
import type { Settings } from '../types'

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
        database (CC-BY-SA). Cloud sync across devices isn't built in yet; use Export/Import to move your data.
      </p>
    </>
  )
}
