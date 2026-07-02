export type Units = 'kg' | 'lb'
export type Sex = 'male' | 'female'
export type ExerciseSource = 'seed' | 'wger' | 'custom'

export interface Exercise {
  id: string
  name: string
  category: string
  primaryMuscles: string[]
  equipment: string
  instructions: string
  imageUrl?: string
  videoUrl?: string
  source: ExerciseSource
  wgerId?: number
}

export interface RoutineEntry {
  exerciseId: string
  targetSets: number
  targetReps: number
}

export interface Routine {
  id: string
  name: string
  entries: RoutineEntry[]
  createdAt: number
}

export interface SetLog {
  weightKg: number
  reps: number
  done: boolean
  completedAt?: number
}

export interface WorkoutEntry {
  exerciseId: string
  exerciseName: string
  sets: SetLog[]
}

export interface Workout {
  id: string
  startedAt: number
  finishedAt?: number
  routineId?: string
  routineName?: string
  entries: WorkoutEntry[]
}

export interface Settings {
  id: 'main'
  units: Units
  sex: Sex
  bodyweightKg?: number
  restSeconds: number
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  units: 'lb',
  sex: 'male',
  restSeconds: 120,
}
