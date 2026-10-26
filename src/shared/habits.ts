import type { Habit, HabitLog, Slot } from './model'
import { SLOT_LABEL } from './constants'
import { addDays, fromIso, toIso, weekday } from './dates'

export const countOf = (log: HabitLog, habitId: string, date: string): number => log[date]?.[habitId] ?? 0

export const isActiveOn = (h: Habit, date: string): boolean =>
  date >= h.createdAt && h.days.includes(weekday(fromIso(date)))

export const isComplete = (log: HabitLog, h: Habit, date: string): boolean => countOf(log, h.id, date) >= h.target

export interface Progress {
  done: number
  total: number
}

export function dayProgress(habits: readonly Habit[], log: HabitLog, date: string): Progress {
  let done = 0
  let total = 0
  for (const h of habits) {
    if (!isActiveOn(h, date)) continue
    total++
    if (isComplete(log, h, date)) done++
  }
  return { done, total }
}

/**
 * Consecutive scheduled days completed, ending today — or yesterday when today is still open,
 * so an unfinished morning doesn't reset the count.
 */
export function streak(h: Habit, log: HabitLog, today: string, maxDays = 366): number {
  let d = fromIso(today)
  if (isActiveOn(h, today) && !isComplete(log, h, today)) d = addDays(d, -1)
  let n = 0
  for (let i = 0; i < maxDays; i++) {
    const k = toIso(d)
    if (k < h.createdAt) break
    if (isActiveOn(h, k)) {
      if (!isComplete(log, h, k)) break
      n++
    }
    d = addDays(d, -1)
  }
  return n
}

export function habitMeta(h: Habit): string {
  return [h.dose, h.target > 1 ? `${h.target} ${h.unit || 'veces'}` : '', SLOT_LABEL[h.slot]].filter(Boolean).join(' · ')
}

/** Tap behaviour: count up to the target; tapping a finished habit takes one back. */
export const nextTapCount = (current: number, target: number): number => (current >= target ? target - 1 : current + 1)

export const SLOT_ORDER: readonly Slot[] = ['manana', 'mediodia', 'tarde', 'noche', 'cualquiera']

export interface HabitSuggestion {
  name: string
  kind: Habit['kind']
  dose?: string
  target?: number
  unit?: string
  slot: Slot
  color: Habit['color']
  days?: number[]
}

export const SUGGESTIONS: readonly HabitSuggestion[] = [
  { name: 'Creatina', kind: 'suplemento', dose: '5 g', slot: 'manana', color: 'cobalt' },
  { name: 'Vitamina D', kind: 'suplemento', dose: '2000 UI', slot: 'manana', color: 'amber' },
  { name: 'Omega 3', kind: 'suplemento', dose: '1 cápsula', slot: 'mediodia', color: 'vermilion' },
  { name: 'Magnesio', kind: 'suplemento', dose: '400 mg', slot: 'noche', color: 'violet' },
  { name: 'Proteína', kind: 'suplemento', dose: '1 scoop', slot: 'tarde', color: 'teal' },
  { name: 'Agua', kind: 'habito', target: 8, unit: 'vasos', slot: 'cualquiera', color: 'cobalt' },
  { name: 'Entrenar', kind: 'habito', dose: '45 min', slot: 'tarde', color: 'magenta', days: [0, 1, 2, 3, 4, 5] },
  { name: 'Leer', kind: 'habito', dose: '20 min', slot: 'noche', color: 'violet' },
  { name: 'Meditar', kind: 'habito', dose: '10 min', slot: 'manana', color: 'green' },
  { name: 'Dormir 8 h', kind: 'habito', slot: 'noche', color: 'teal' },
]
