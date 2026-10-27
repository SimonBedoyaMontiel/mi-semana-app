import { useEffect, useMemo, useState } from 'react'
import type { AppData } from '@shared/model'
import { expandRange, indexByDate } from '@shared/events'
import type { EventIndex } from '@shared/events'
import { addDays, fromIso, toIso, todayIso } from '@shared/dates'
import { useStore } from './store'

/** Only rendered once data is loaded (App gates on it). */
export const useData = (): AppData => useStore(s => s.data!)

/**
 * Events and recurring occurrences for the visible window: the month around the selected date
 * plus a margin (covers every view), widened to include today for the "Hoy" panel.
 */
export function useEventIndex(): EventIndex {
  const events = useStore(s => s.data!.events)
  const month = useStore(s => s.date.slice(0, 7))
  const today = todayIso()
  return useMemo(() => {
    const first = fromIso(`${month}-01`)
    const from = [toIso(addDays(first, -14)), toIso(addDays(fromIso(today), -1))].sort()[0]!
    const to = [toIso(addDays(first, 52)), toIso(addDays(fromIso(today), 1))].sort()[1]!
    return indexByDate(expandRange(events, from, to))
  }, [events, month, today])
}

/** Re-renders on each minute boundary; cheap enough for "now" lines and countdowns. */
export function useMinute(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let t: number
    const schedule = (): void => {
      t = window.setTimeout(() => {
        setNow(Date.now())
        schedule()
      }, 60_000 - (Date.now() % 60_000) + 50)
    }
    schedule()
    return () => window.clearTimeout(t)
  }, [])
  return now
}

/** Today's ISO date, refreshed at midnight and when the window wakes up. */
export function useToday(): string {
  const minute = useMinute()
  const [today, setToday] = useState(todayIso)
  useEffect(() => {
    const check = (): void => setToday(todayIso())
    check()
    window.addEventListener('focus', check)
    return () => window.removeEventListener('focus', check)
  }, [minute])
  return today
}

/** Phone-sized layout (the web app on a phone). The desktop window never gets this narrow. */
export function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => matchMedia('(max-width: 720px)').matches)
  useEffect(() => {
    const mq = matchMedia('(max-width: 720px)')
    const on = (): void => setNarrow(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return narrow
}
