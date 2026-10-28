import type { CalendarEvent, Habit } from '@shared/model'
import type { EventItem } from '@shared/events'
import { evColor, occurrencesBefore } from '@shared/events'
import { countOf, dayProgress, nextTapCount } from '@shared/habits'
import { addDays, fromIso, longDate, toIso, todayIso } from '@shared/dates'
import { burst, celebrate, newId } from '@/lib/fx'
import { rawEvent, useStore } from './store'

const st = useStore.getState

/** For recurring events: change only this date, this date and the ones after it, or the whole series. */
export type Scope = 'one' | 'future' | 'all'

/** The stored event behind an item (itself for one-offs, the series for occurrences, the whole span for a day of it). */
export const stored = (e: EventItem): CalendarEvent | undefined => rawEvent(e.seriesId ?? e.spanOf ?? e.id)

/** A plain event carrying only the persisted fields (no occurrence metadata). */
function plain(e: EventItem): CalendarEvent {
  const { seriesId: _s, occurrence: _o, spanOf: _p, spanFirst: _f, spanLast: _l, ...rest } = e
  return rest
}

const dayBefore = (iso: string): string => toIso(addDays(fromIso(iso), -1))

/** The series cut so it ends the day before `date`. */
function endBefore(series: CalendarEvent, date: string): CalendarEvent {
  const until = dayBefore(date)
  const { count: _c, ...rule } = series.repeat!
  return {
    ...series,
    repeat: { ...rule, until },
    exceptions: series.exceptions?.filter(d => d < date),
    doneDates: series.doneDates?.filter(d => d < date),
  }
}

export function toggleEvent(e: EventItem, from?: Element | null): void {
  const done = !e.done
  if (done) burst(from ?? null, evColor(e))
  if (e.seriesId && e.occurrence) st().dispatch({ type: 'event.occurrence', id: e.seriesId, date: e.occurrence, op: done ? 'done' : 'undone' })
  else st().dispatch({ type: 'event.setDone', id: e.spanOf ?? e.id, done })
}

export function deleteEvent(e: EventItem, scope: Scope = 'all'): void {
  if (e.seriesId && e.occurrence && scope === 'one') {
    const series = stored(e)
    st().dispatch({ type: 'event.occurrence', id: e.seriesId, date: e.occurrence, op: 'skip' })
    st().notify(`Quitado este día: ${e.text}`, () => series && st().dispatch({ type: 'event.upsert', event: series }))
    return
  }
  if (e.seriesId && e.occurrence && scope === 'future') {
    const series = stored(e)
    if (series && e.occurrence > series.date) {
      st().dispatch({ type: 'event.upsert', event: endBefore(series, e.occurrence) })
      st().notify(`Borrado desde el ${longDate(e.occurrence)}: ${e.text}`, () => st().dispatch({ type: 'event.upsert', event: series }))
      return
    }
  }
  const original = stored(e)
  if (!original) return
  st().dispatch({ type: 'event.delete', id: original.id })
  st().notify(`Borrado: ${e.text}${original.repeat ? ' (toda la serie)' : ''}`, () => st().dispatch({ type: 'event.upsert', event: original }))
}

/**
 * Saves edits. For an occurrence edited "only this day", the date leaves the series and a
 * standalone copy takes its place; "from this day on" ends the series the day before and starts a
 * new one with the changes; "all" rewrites the series but keeps its first date.
 */
export function saveEvent(next: CalendarEvent, original: EventItem | undefined, scope: Scope = 'all'): void {
  if (original?.seriesId && original.occurrence) {
    const series = rawEvent(original.seriesId)
    if (!series) return
    const from = original.occurrence
    if (scope === 'one') {
      st().dispatch({ type: 'event.occurrence', id: series.id, date: from, op: 'skip' })
      const { repeat: _r, exceptions: _x, doneDates: _d, ...single } = next
      st().dispatch({ type: 'event.upsert', event: { ...single, id: newId(), createdAt: Date.now() } })
    } else if (scope === 'future' && from > series.date) {
      let repeat = next.repeat
      // An unchanged "N times" keeps counting: the new part only gets what was left.
      if (repeat?.count && series.repeat?.count === repeat.count) {
        const left = repeat.count - occurrencesBefore(series, from)
        repeat = left > 0 ? { ...repeat, count: left } : { ...repeat, count: 1 }
      }
      st().dispatch({ type: 'event.upsert', event: endBefore(series, from) })
      const fresh: CalendarEvent = {
        ...next,
        id: newId(),
        date: from,
        done: false,
        createdAt: Date.now(),
        ...(repeat ? { repeat, exceptions: series.exceptions?.filter(d => d >= from), doneDates: series.doneDates?.filter(d => d >= from) } : {}),
      }
      if (!repeat) {
        delete fresh.repeat
        delete fresh.exceptions
        delete fresh.doneDates
      }
      st().dispatch({ type: 'event.upsert', event: fresh })
      st().notify(`Cambiado desde el ${longDate(from)}`, () => {
        st().dispatch({ type: 'event.delete', id: fresh.id })
        st().dispatch({ type: 'event.upsert', event: series })
      })
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
  else if (e.spanOf) {
    // A day of a several-day event: the whole event moves by the same number of days.
    const whole = stored(e)
    if (!whole?.endDate) return
    const shift = Math.round((fromIso(change.date).getTime() - fromIso(e.date).getTime()) / 864e5)
    st().dispatch({ type: 'event.upsert', event: { ...whole, date: toIso(addDays(fromIso(whole.date), shift)), endDate: toIso(addDays(fromIso(whole.endDate), shift)) } })
  } else st().dispatch({ type: 'event.upsert', event: { ...plain(e), ...change } })
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
    burst(from ?? null, `var(--${h.color})`)
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
