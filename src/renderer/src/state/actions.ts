import type { CalendarEvent, Habit } from '@shared/model'
import { countOf, dayProgress, nextTapCount } from '@shared/habits'
import { fromIso, longDate, todayIso } from '@shared/dates'
import { burstFrom, celebrate } from '@/lib/fx'
import { useStore } from './store'

const st = useStore.getState

export function toggleEvent(e: CalendarEvent, from?: Element | null): void {
  const done = !e.done
  if (done) burstFrom(from ?? null, [`var(--cat-${e.cat})`, 'var(--amber)', 'var(--cobalt)'], 12, 52)
  st().dispatch({ type: 'event.setDone', id: e.id, done })
}

export function deleteEvent(e: CalendarEvent): void {
  st().dispatch({ type: 'event.delete', id: e.id })
  st().notify(`Borrado: ${e.text}`, () => st().dispatch({ type: 'event.upsert', event: e }))
}

export function saveEvent(e: CalendarEvent, isNew: boolean): void {
  st().dispatch({ type: 'event.upsert', event: e })
  st().setLastCat(e.cat)
  if (isNew && e.date !== st().date) st().notify(`Guardado para el ${longDate(e.date)}`)
}

/** Count up to the target, celebrate completions, and the whole day when it's the last one. */
export function tapHabit(h: Habit, date: string, from?: Element | null, delta?: number): void {
  const data = st().data
  if (!data || date > todayIso()) return
  const n = countOf(data.habitLog, h.id, date)
  const next = delta === undefined ? nextTapCount(n, h.target) : Math.max(0, Math.min(99, n + delta))
  const before = dayProgress(data.habits, data.habitLog, date)
  st().dispatch({ type: 'habitLog.set', date, habitId: h.id, count: next })
  if (next >= h.target && n < h.target) {
    burstFrom(from ?? null, [`var(--${h.color})`, 'var(--amber)', 'var(--cobalt)'], 14, 60)
    const after = dayProgress(st().data!.habits, st().data!.habitLog, date)
    if (after.total > 1 && after.done === after.total && before.done < before.total) {
      window.setTimeout(() => {
        celebrate()
        st().notify(date === todayIso() ? 'Día completo. Cumpliste todos tus hábitos.' : `Completaste el ${longDate(date)}.`)
      }, 280)
    }
  }
}

export function deleteHabit(h: Habit): void {
  const index = st().data?.habits.findIndex(x => x.id === h.id) ?? 0
  st().dispatch({ type: 'habit.delete', id: h.id })
  st().notify(`Borrado: ${h.name}`, () => st().dispatch({ type: 'habit.upsert', habit: h, index: Math.max(0, index) }))
}

export const isPast = (date: string): boolean => fromIso(date) < fromIso(todayIso())
