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

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive'
export type Goal = 'cut' | 'maintain' | 'bulk'

export interface Settings {
  id: 'main'
  units: Units
  sex: Sex
  bodyweightKg?: number
  restSeconds: number
  // nutrition
  heightCm?: number
  birthYear?: number
  activityLevel?: ActivityLevel
  goal?: Goal
  kcalTarget?: number
  proteinTarget?: number
  carbsTarget?: number
  fatTarget?: number
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  units: 'lb',
  sex: 'male',
  restSeconds: 120,
}

// ---- nutrition ----

export interface MacroSet {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']
export type PlanMeal = 'breakfast' | 'lunch' | 'dinner'
export const PLAN_MEALS: PlanMeal[] = ['breakfast', 'lunch', 'dinner']

export interface Food {
  id: string
  name: string
  brand?: string
  per100g: MacroSet
  /** grams in one serving, when known */
  servingG?: number
  imageUrl?: string
  source: 'off' | 'custom'
  offCode?: string
  favorite: 0 | 1
  lastUsedAt?: number
}

export interface FoodLog {
  id: string
  date: string // YYYY-MM-DD
  meal: MealSlot
  foodId?: string
  name: string
  /** 0 for quick-add entries without a weight */
  grams: number
  kcal: number
  protein: number
  carbs: number
  fat: number
  loggedAt: number
}

export interface RecipeIngredient {
  name: string
  measure: string
}

export interface Recipe {
  id: string
  name: string
  category: string
  area: string
  instructions: string
  imageUrl?: string
  videoUrl?: string
  sourceUrl?: string
  ingredients: RecipeIngredient[]
  source: 'mealdb' | 'custom'
  mealdbId?: string
  inCookbook: 0 | 1
  savedAt: number
}

export interface PlanEntry {
  id: string
  date: string // YYYY-MM-DD
  meal: PlanMeal
  recipeId?: string
  title: string
}
