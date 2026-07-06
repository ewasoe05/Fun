import Dexie, { type Table } from 'dexie'
import type { BodyLog, Exercise, Food, FoodLog, PlanEntry, Recipe, Routine, Settings, Workout } from './types'
import { DEFAULT_SETTINGS } from './types'
import seedExercises from './data/seed-exercises.json'

class LiftLogDB extends Dexie {
  exercises!: Table<Exercise, string>
  routines!: Table<Routine, string>
  workouts!: Table<Workout, string>
  settings!: Table<Settings, string>
  foods!: Table<Food, string>
  foodLogs!: Table<FoodLog, string>
  recipes!: Table<Recipe, string>
  planEntries!: Table<PlanEntry, string>
  bodyLogs!: Table<BodyLog, string>

  constructor() {
    super('liftlog')
    this.version(1).stores({
      exercises: 'id, name, source, wgerId',
      routines: 'id, name, createdAt',
      workouts: 'id, startedAt',
      settings: 'id',
    })
    this.version(2).stores({
      foods: 'id, name, source, offCode, lastUsedAt',
      foodLogs: 'id, date, meal',
      recipes: 'id, name, mealdbId, inCookbook',
      planEntries: 'id, date, [date+meal]',
    })
    this.version(3).stores({
      bodyLogs: 'id, date',
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
  version: 1 | 2
  exportedAt: string
  exercises: Exercise[]
  routines: Routine[]
  workouts: Workout[]
  settings: Settings[]
  foods?: Food[]
  foodLogs?: FoodLog[]
  recipes?: Recipe[]
  planEntries?: PlanEntry[]
  bodyLogs?: BodyLog[]
}

export async function exportBackup(): Promise<string> {
  const backup: BackupFile = {
    app: 'liftlog',
    version: 2,
    exportedAt: new Date().toISOString(),
    exercises: await db.exercises.toArray(),
    routines: await db.routines.toArray(),
    workouts: await db.workouts.toArray(),
    settings: await db.settings.toArray(),
    foods: await db.foods.toArray(),
    foodLogs: await db.foodLogs.toArray(),
    recipes: await db.recipes.toArray(),
    planEntries: await db.planEntries.toArray(),
    bodyLogs: await db.bodyLogs.toArray(),
  }
  return JSON.stringify(backup, null, 2)
}

/** Replaces all local data with the backup's contents (v1 backups lack the food tables). */
export async function importBackup(json: string): Promise<void> {
  const backup = JSON.parse(json) as BackupFile
  if (backup.app !== 'liftlog' || !Array.isArray(backup.workouts)) {
    throw new Error('Not a Lift Log backup file')
  }
  const tables = [
    db.exercises,
    db.routines,
    db.workouts,
    db.settings,
    db.foods,
    db.foodLogs,
    db.recipes,
    db.planEntries,
    db.bodyLogs,
  ]
  await db.transaction('rw', tables, async () => {
    await Promise.all(tables.map((t) => t.clear()))
    await db.exercises.bulkAdd(backup.exercises ?? [])
    await db.routines.bulkAdd(backup.routines ?? [])
    await db.workouts.bulkAdd(backup.workouts ?? [])
    await db.settings.bulkAdd(backup.settings ?? [DEFAULT_SETTINGS])
    await db.foods.bulkAdd(backup.foods ?? [])
    await db.foodLogs.bulkAdd(backup.foodLogs ?? [])
    await db.recipes.bulkAdd(backup.recipes ?? [])
    await db.planEntries.bulkAdd(backup.planEntries ?? [])
    await db.bodyLogs.bulkAdd(backup.bodyLogs ?? [])
  })
}
