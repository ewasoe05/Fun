import type { BodyLog, Exercise, FoodLog, MacroSet, SetLog, Settings, Units, Workout } from '../types'
import { fromKg, toKg } from './units'
import { sessionStats } from './oneRepMax'
import { addDays, toDateKey, todayKey, weekStart } from './nutrition'

// ---------- auto-progression ----------

export interface Suggestion {
  change: 'up' | 'down' | 'reps'
  /** weight increment in display units for up/down, rep count for reps */
  deltaDisplay: number
  reason: string
}

export interface SuggestResult {
  sets: SetLog[]
  suggestion?: Suggestion
}

const LOWER_BODY = /squat|deadlift|leg press|hip thrust|lunge|calf/i

function incrementFor(exercise: Exercise | undefined, units: Units): number {
  const lower = exercise ? LOWER_BODY.test(exercise.name) || exercise.category === 'Legs' : false
  return units === 'lb' ? (lower ? 5 : 2.5) : (lower ? 2.5 : 1.25)
}

const emptySets = (n: number, reps: number): SetLog[] =>
  Array.from({ length: n }, () => ({ weightKg: 0, reps, done: false }))

/**
 * Coach progression for the next session of one exercise.
 * `sessions` = the exercise's previous sessions of DONE sets, most recent first.
 */
export function suggestNextSets(
  exercise: Exercise | undefined,
  sessions: SetLog[][],
  targetSets: number,
  targetReps: number,
  units: Units,
): SuggestResult {
  const last = sessions[0]
  if (!last || last.length === 0) return { sets: emptySets(targetSets, targetReps) }

  const allHit = last.every((s) => s.reps >= targetReps)
  const topKg = Math.max(...last.map((s) => s.weightKg))

  // bodyweight movement: progress by reps
  if (topKg === 0) {
    const maxReps = Math.max(...last.map((s) => s.reps))
    if (allHit) {
      return {
        sets: emptySets(targetSets, maxReps + 1),
        suggestion: { change: 'reps', deltaDisplay: 1, reason: 'hit all reps last time' },
      }
    }
    return { sets: emptySets(targetSets, targetReps) }
  }

  const incr = incrementFor(exercise, units)
  const grid = (display: number) => Math.round(display / incr) * incr
  const topDisplay = fromKg(topKg, units)

  if (allHit) {
    let next = grid(topDisplay + incr)
    if (next <= topDisplay) next += incr
    return {
      sets: Array.from({ length: targetSets }, () => ({ weightKg: toKg(next, units), reps: targetReps, done: false })),
      suggestion: { change: 'up', deltaDisplay: incr, reason: `hit all ${targetReps} reps last time` },
    }
  }

  // deload after two sessions in a row missing reps at the same top weight
  const prev = sessions[1]
  if (prev && prev.length > 0) {
    const prevTopDisplay = fromKg(Math.max(...prev.map((s) => s.weightKg)), units)
    const prevMissed = prev.some((s) => s.reps < targetReps)
    if (prevMissed && Math.abs(grid(prevTopDisplay) - grid(topDisplay)) < incr / 2) {
      let next = grid(topDisplay * 0.9)
      if (next >= topDisplay) next -= incr
      if (next > 0) {
        return {
          sets: Array.from({ length: targetSets }, () => ({
            weightKg: toKg(next, units),
            reps: targetReps,
            done: false,
          })),
          suggestion: { change: 'down', deltaDisplay: Math.round((topDisplay - next) * 10) / 10, reason: 'missed reps two sessions in a row — deload ~10%' },
        }
      }
    }
  }

  // otherwise repeat last session, set by set
  return {
    sets: Array.from({ length: targetSets }, (_, i) => {
      const p = last[i] ?? last[last.length - 1]
      return { weightKg: p.weightKg, reps: p.reps || targetReps, done: false }
    }),
  }
}

// ---------- insights ----------

export type InsightKind = 'trend' | 'stall' | 'balance' | 'consistency' | 'nutrition' | 'weight'

export interface Insight {
  id: string
  kind: InsightKind
  severity: 'good' | 'info' | 'action'
  title: string
  body: string
  action?: { label: string; patch: Partial<Settings> }
}

export interface CoachInput {
  workouts: Workout[]
  exercisesById: Map<string, Exercise>
  foodLogs: FoodLog[]
  bodyLogs: BodyLog[]
  settings: Settings
}

const SEV_RANK = { action: 0, info: 1, good: 2 } as const

export function analyze({ workouts, exercisesById, foodLogs, bodyLogs, settings }: CoachInput): Insight[] {
  const insights: Insight[] = []
  const finished = workouts.filter((w) => w.finishedAt)
  const units = settings.units

  // 1. lift trends + stalls
  const trained = new Map<string, number>()
  for (const w of finished) for (const e of w.entries) trained.set(e.exerciseId, (trained.get(e.exerciseId) ?? 0) + 1)
  let up = 0
  let total = 0
  let stallCards = 0
  for (const [exId, count] of trained) {
    if (count < 3) continue
    const stats = sessionStats(finished, exId)
    if (stats.length < 3) continue
    total++
    const window = stats.slice(-4)
    if (window[window.length - 1].best1RmKg > window[0].best1RmKg * 1.01) up++
    if (stats.length >= 4 && stallCards < 2) {
      const recent = stats.slice(-3)
      const before = Math.max(...stats.slice(0, -3).map((s) => s.best1RmKg))
      if (Math.max(...recent.map((s) => s.best1RmKg)) <= before) {
        stallCards++
        const name = exercisesById.get(exId)?.name ?? 'A lift'
        insights.push({
          id: `stall-${exId}`,
          kind: 'stall',
          severity: 'info',
          title: `${name} has stalled`,
          body: `No new estimated 1RM in your last 3 sessions. The coach will suggest a deload if reps drop; otherwise try adding a set, slowing the negatives, or a close variation for a few weeks.`,
        })
      }
    }
  }
  if (total >= 2) {
    insights.push({
      id: 'trend',
      kind: 'trend',
      severity: up >= total / 2 ? 'good' : 'info',
      title: `${up} of ${total} lifts trending up`,
      body:
        up >= total / 2
          ? 'Estimated 1RMs are climbing across most of your lifts. Keep riding the progression.'
          : 'More than half of your lifts are flat or down lately — check sleep, food, and rest times.',
    })
  }

  // 2. volume balance across muscle groups (last 14 days)
  const since = addDays(todayKey(), -13)
  const setsByCategory = new Map<string, number>()
  for (const w of finished) {
    if (toDateKey(new Date(w.startedAt)) < since) continue
    for (const e of w.entries) {
      const cat = exercisesById.get(e.exerciseId)?.category
      if (!cat) continue
      setsByCategory.set(cat, (setsByCategory.get(cat) ?? 0) + e.sets.filter((s) => s.done).length)
    }
  }
  const maxCat = Math.max(0, ...setsByCategory.values())
  if (maxCat >= 9) {
    for (const major of ['Legs', 'Back', 'Chest']) {
      const n = setsByCategory.get(major) ?? 0
      if (n < maxCat / 3) {
        const [busiest] = [...setsByCategory.entries()].sort((a, b) => b[1] - a[1])[0]
        insights.push({
          id: `balance-${major}`,
          kind: 'balance',
          severity: 'info',
          title: `${major} volume is lagging`,
          body: `Last 2 weeks: ${n} ${major.toLowerCase()} sets vs ${maxCat} for ${busiest.toLowerCase()}. Consider adding a ${major.toLowerCase()} day or a couple of sets per session.`,
        })
        break // one balance card is enough
      }
    }
  }

  // 3. consistency: this week vs 4-week average
  const thisWeekStart = weekStart(todayKey())
  const weekly: number[] = [0, 0, 0, 0]
  let thisWeek = 0
  for (const w of finished) {
    const d = toDateKey(new Date(w.startedAt))
    if (d >= thisWeekStart) thisWeek++
    else
      for (let k = 0; k < 4; k++) {
        const ws = addDays(thisWeekStart, -7 * (k + 1))
        if (d >= ws && d < addDays(ws, 7)) weekly[k]++
      }
  }
  const avg = weekly.reduce((a, b) => a + b, 0) / 4
  if (avg >= 1) {
    insights.push({
      id: 'consistency',
      kind: 'consistency',
      severity: thisWeek >= Math.round(avg) ? 'good' : 'info',
      title:
        thisWeek >= Math.round(avg)
          ? `On track: ${thisWeek} workout${thisWeek === 1 ? '' : 's'} this week`
          : `${thisWeek} workout${thisWeek === 1 ? '' : 's'} so far this week`,
      body: `Your 4-week average is ${avg.toFixed(1)} per week.`,
    })
  }

  // 4. nutrition adherence (last 14 days, logged days only)
  if (settings.kcalTarget) {
    const dayTotals = new Map<string, MacroSet>()
    for (const l of foodLogs) {
      if (l.date < since || l.date === todayKey()) continue // today is usually incomplete
      const t = dayTotals.get(l.date) ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 }
      t.kcal += l.kcal
      t.protein += l.protein
      dayTotals.set(l.date, t)
    }
    const days = [...dayTotals.values()]
    if (days.length >= 4) {
      const avgKcal = days.reduce((s, d) => s + d.kcal, 0) / days.length
      const dev = (avgKcal - settings.kcalTarget) / settings.kcalTarget
      if (Math.abs(dev) <= 0.05) {
        insights.push({
          id: 'kcal-adherence',
          kind: 'nutrition',
          severity: 'good',
          title: 'Calories on target',
          body: `Averaging ${Math.round(avgKcal).toLocaleString()} kcal on logged days vs a ${settings.kcalTarget.toLocaleString()} target. Dialed in.`,
        })
      } else if (Math.abs(dev) > 0.1) {
        insights.push({
          id: 'kcal-adherence',
          kind: 'nutrition',
          severity: 'info',
          title: `Eating ${dev > 0 ? 'over' : 'under'} target`,
          body: `Averaging ${Math.round(avgKcal).toLocaleString()} kcal vs a ${settings.kcalTarget.toLocaleString()} target (${dev > 0 ? '+' : ''}${Math.round(dev * 100)}%). If that's not intentional, tighten up portions${dev < 0 ? ' — or eat a bit more to fuel training' : ''}.`,
        })
      }
      if (settings.proteinTarget) {
        const avgProtein = days.reduce((s, d) => s + d.protein, 0) / days.length
        if (avgProtein < settings.proteinTarget * 0.8) {
          insights.push({
            id: 'protein',
            kind: 'nutrition',
            severity: 'info',
            title: 'Protein is coming up short',
            body: `Averaging ${Math.round(avgProtein)}g vs a ${settings.proteinTarget}g target. Lead meals with a protein source to protect muscle.`,
          })
        }
      }
    }
  }

  // 5. bodyweight trend vs goal → calorie-target action
  const logs = [...bodyLogs].sort((a, b) => a.date.localeCompare(b.date)).filter((l) => l.date >= addDays(todayKey(), -21))
  if (logs.length >= 3) {
    const t0 = new Date(logs[0].date).getTime()
    const pts = logs.map((l) => ({ x: (new Date(l.date).getTime() - t0) / (7 * 24 * 3600 * 1000), y: l.weightKg }))
    const spanWeeks = pts[pts.length - 1].x
    if (spanWeeks >= 1) {
      const n = pts.length
      const mx = pts.reduce((s, p) => s + p.x, 0) / n
      const my = pts.reduce((s, p) => s + p.y, 0) / n
      const denom = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0)
      const slope = denom > 0 ? pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / denom : 0 // kg per week
      const bw = settings.bodyweightKg ?? my
      const trendTxt = `${slope >= 0 ? '+' : ''}${(fromKg(Math.abs(slope), units) * Math.sign(slope)).toFixed(1)} ${units}/week over ${Math.round(spanWeeks * 7)} days`

      const propose = (deltaKcal: number, why: string): void => {
        if (!settings.kcalTarget) {
          insights.push({ id: 'weight-trend', kind: 'weight', severity: 'info', title: why, body: `Bodyweight trend: ${trendTxt}. Set calorie targets in Settings and the coach can adjust them for you.` })
          return
        }
        // a diet change needs ~a week to show up on the scale — don't stack adjustments
        const cooldownMs = 7 * 24 * 3600 * 1000
        if (settings.lastKcalAdjustAt && Date.now() - settings.lastKcalAdjustAt < cooldownMs) {
          const daysLeft = Math.ceil((settings.lastKcalAdjustAt + cooldownMs - Date.now()) / (24 * 3600 * 1000))
          insights.push({
            id: 'weight-trend',
            kind: 'weight',
            severity: 'info',
            title: 'Calorie target recently adjusted',
            body: `Bodyweight trend: ${trendTxt}. Give the new ${settings.kcalTarget.toLocaleString()} kcal target ~${daysLeft} more day${daysLeft === 1 ? '' : 's'} to show on the scale before adjusting again.`,
          })
          return
        }
        const newKcal = settings.kcalTarget + deltaKcal
        const patch: Partial<Settings> = { kcalTarget: newKcal, lastKcalAdjustAt: Date.now() }
        if (settings.carbsTarget) patch.carbsTarget = Math.max(0, settings.carbsTarget + Math.round(deltaKcal / 4))
        insights.push({
          id: 'weight-trend',
          kind: 'weight',
          severity: 'action',
          title: why,
          body: `Bodyweight trend: ${trendTxt}. Adjusting calories by ${deltaKcal > 0 ? '+' : ''}${deltaKcal} should put you back on pace (carbs absorb the change).`,
          action: { label: `Set target to ${newKcal.toLocaleString()} kcal`, patch },
        })
      }

      if (settings.goal === 'cut') {
        if (slope > -0.1) propose(-200, 'Cutting, but weight isn’t moving')
        else if (slope < -bw * 0.01) propose(200, 'Losing faster than ~1%/week')
        else insights.push({ id: 'weight-trend', kind: 'weight', severity: 'good', title: 'Cut is on pace', body: `Bodyweight trend: ${trendTxt} — a sustainable rate that spares muscle.` })
      } else if (settings.goal === 'bulk') {
        if (slope < 0.1) propose(200, 'Bulking, but weight isn’t climbing')
        else if (slope > 0.45) propose(-150, 'Gaining a bit fast')
        else insights.push({ id: 'weight-trend', kind: 'weight', severity: 'good', title: 'Lean bulk on pace', body: `Bodyweight trend: ${trendTxt}.` })
      } else if (settings.goal === 'maintain' && Math.abs(slope) > 0.3) {
        propose(slope > 0 ? -200 : 200, 'Weight drifting while maintaining')
      }
    }
  }

  if (insights.length === 0) {
    insights.push({
      id: 'need-data',
      kind: 'consistency',
      severity: 'info',
      title: 'The coach needs a bit more data',
      body: 'Log a few workouts, meals, and weigh-ins and analysis will appear here automatically.',
    })
  }

  return insights.sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity])
}
