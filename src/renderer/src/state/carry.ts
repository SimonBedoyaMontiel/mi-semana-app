import { useEffect } from 'react'
import type { CalendarEvent } from '@shared/model'
import { CARRY_DAYS } from '@shared/constants'
import { addDays, fromIso, toIso } from '@shared/dates'
import { useStore } from './store'

const KEY = 'mi-semana:carried'

/**
 * Untimed one-off tasks left undone on a past day move to today, once a day, with an undo.
 * Timed events are appointments and stay where they were; recurring ones belong to their series.
 */
export function carryOver(today: string): number {
  const st = useStore.getState()
  const data = st.data
  if (!data?.settings.carryOver) return 0
  const oldest = toIso(addDays(fromIso(today), -CARRY_DAYS))
  const late = data.events.filter(e => !e.repeat && !e.endDate && !e.start && !e.done && e.date < today && e.date >= oldest)
  if (!late.length) return 0
  const before: CalendarEvent[] = late.map(e => ({ ...e }))
  for (const e of late) st.dispatch({ type: 'event.upsert', event: { ...e, date: today, from: e.from ?? e.date } })
  st.notify(
    late.length === 1 ? `Pasé a hoy una tarea pendiente: ${late[0]!.text}` : `Pasé a hoy ${late.length} tareas pendientes.`,
    () => {
      for (const e of before) useStore.getState().dispatch({ type: 'event.upsert', event: e })
    },
  )
  return late.length
}

/** Runs the carry-over once per day on this device, after the data has loaded. */
export function useCarryOver(today: string, ready: boolean, enabled: boolean): void {
  useEffect(() => {
    if (!ready || !enabled) return
    let last = ''
    try {
      last = localStorage.getItem(KEY) ?? ''
    } catch { /* storage blocked */ }
    if (last === today) return
    // Let the first sync land first, so tasks done on another device are not moved by mistake.
    const t = window.setTimeout(() => {
      carryOver(today)
      try {
        localStorage.setItem(KEY, today)
      } catch { /* storage blocked */ }
    }, 4000)
    return () => window.clearTimeout(t)
  }, [today, ready, enabled])
}
