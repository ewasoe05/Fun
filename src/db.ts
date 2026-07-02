import Dexie, { type Table } from 'dexie'
import type { Exercise, Routine, Settings, Workout } from './types'
import { DEFAULT_SETTINGS } from './types'
import seedExercises from './data/seed-exercises.json'

class LiftLogDB extends Dexie {
  exercises!: Table<Exercise, string>
  routines!: Table<Routine, string>
  workouts!: Table<Workout, string>
  settings!: Table<Settings, string>

  constructor() {
    super('liftlog')
    this.version(1).stores({
      exercises: 'id, name, source, wgerId',
      routines: 'id, name, createdAt',
      workouts: 'id, startedAt',
      settings: 'id',
    })
  }
}

export const db = new LiftLogDB()

/** Seed the exercise library and default settings on first run. */
export async function initDB(): Promise<void> {
  await db.transaction('rw', db.exercises, db.settings, async () => {
    if ((await db.exercises.count()) === 0) {
      await db.exercises.bulkAdd(seedExercises as Exercise[])
    }
    if (!(await db.settings.get('main'))) {
      await db.settings.add(DEFAULT_SETTINGS)
    }
  })
}

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('main')) ?? DEFAULT_SETTINGS
}

export function newId(): string {
  return crypto.randomUUID()
}

interface BackupFile {
  app: 'liftlog'
  version: 1
  exportedAt: string
  exercises: Exercise[]
  routines: Routine[]
  workouts: Workout[]
  settings: Settings[]
}

export async function exportBackup(): Promise<string> {
  const backup: BackupFile = {
    app: 'liftlog',
    version: 1,
    exportedAt: new Date().toISOString(),
    exercises: await db.exercises.toArray(),
    routines: await db.routines.toArray(),
    workouts: await db.workouts.toArray(),
    settings: await db.settings.toArray(),
  }
  return JSON.stringify(backup, null, 2)
}

/** Replaces all local data with the backup's contents. */
export async function importBackup(json: string): Promise<void> {
  const backup = JSON.parse(json) as BackupFile
  if (backup.app !== 'liftlog' || !Array.isArray(backup.workouts)) {
    throw new Error('Not a Lift Log backup file')
  }
  await db.transaction('rw', db.exercises, db.routines, db.workouts, db.settings, async () => {
    await Promise.all([db.exercises.clear(), db.routines.clear(), db.workouts.clear(), db.settings.clear()])
    await db.exercises.bulkAdd(backup.exercises ?? [])
    await db.routines.bulkAdd(backup.routines ?? [])
    await db.workouts.bulkAdd(backup.workouts ?? [])
    await db.settings.bulkAdd(backup.settings ?? [DEFAULT_SETTINGS])
  })
}
