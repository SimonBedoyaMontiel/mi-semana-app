import type { CalendarEvent, Habit } from '@shared/model'
import type { EventItem } from '@shared/events'
import { countOf, dayProgress, nextTapCount } from '@shared/habits'
import { fromIso, longDate, todayIso } from '@shared/dates'
import { celebrate, newId, ripple } from '@/lib/fx'
import { rawEvent, useStore } from './store'

const st = useStore.getState

/** For recurring events: change only this date, or the whole series. */
export type Scope = 'one' | 'all'

/** The stored event behind an item (itself for one-offs, the series for occurrences). */
const stored = (e: EventItem): CalendarEvent | undefined => (e.seriesId ? rawEvent(e.seriesId) : rawEvent(e.id))

/** A plain event carrying only the persisted fields (no occurrence metadata). */
function plain(e: EventItem): CalendarEvent {
  const { seriesId: _s, occurrence: _o, ...rest } = e
  return rest
}

export function toggleEvent(e: EventItem, from?: Element | null): void {
  const done = !e.done
  if (done) ripple(from ?? null, `var(--cat-${e.cat})`)
  if (e.seriesId && e.occurrence) st().dispatch({ type: 'event.occurrence', id: e.seriesId, date: e.occurrence, op: done ? 'done' : 'undone' })
  else st().dispatch({ type: 'event.setDone', id: e.id, done })
}

export function deleteEvent(e: EventItem, scope: Scope = 'all'): void {
  if (e.seriesId && e.occurrence && scope === 'one') {
    const series = stored(e)
    st().dispatch({ type: 'event.occurrence', id: e.seriesId, date: e.occurrence, op: 'skip' })
    st().notify(`Quitado este día: ${e.text}`, () => series && st().dispatch({ type: 'event.upsert', event: series }))
    return
  }
  const original = stored(e)
  if (!original) return
  st().dispatch({ type: 'event.delete', id: original.id })
  st().notify(`Borrado: ${e.text}${original.repeat ? ' (toda la serie)' : ''}`, () => st().dispatch({ type: 'event.upsert', event: original }))
}

/**
 * Saves edits. For an occurrence edited "only this day", the date leaves the series and a
 * standalone copy takes its place; "all" rewrites the series but keeps its first date.
 */
export function saveEvent(next: CalendarEvent, original: EventItem | undefined, scope: Scope = 'all'): void {
  if (original?.seriesId && original.occurrence) {
    const series = rawEvent(original.seriesId)
    if (!series) return
    if (scope === 'one') {
      st().dispatch({ type: 'event.occurrence', id: series.id, date: original.occurrence, op: 'skip' })
      const { repeat: _r, exceptions: _x, doneDates: _d, ...single } = next
      st().dispatch({ type: 'event.upsert', event: { ...single, id: newId(), createdAt: Date.now() } })
    } else {
      st().dispatch({
        type: 'event.upsert',
        event: { ...next, id: series.id, date: series.date, done: false, exceptions: series.exceptions, doneDates: series.doneDates, createdAt: series.createdAt },
      })
    }
  } else {
    st().dispatch({ type: 'event.upsert', event: next })
    if (!original && next.date !== st().date) st().notify(`Guardado para el ${longDate(next.date)}`)
  }
  st().setLastCat(next.cat)
}

/** Drag on the timeline. Moving one occurrence detaches it from its series. */
export function moveEvent(e: EventItem, change: Pick<CalendarEvent, 'date' | 'start' | 'end'>): void {
  if (e.seriesId) saveEvent({ ...plain(e), ...change }, e, 'one')
  else st().dispatch({ type: 'event.upsert', event: { ...plain(e), ...change } })
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
    ripple(from ?? null, `var(--${h.color})`)
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
