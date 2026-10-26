import { useEffect, useMemo, useState } from 'react'
import type { AppData } from '@shared/model'
import { indexByDate } from '@shared/events'
import type { EventIndex } from '@shared/events'
import { todayIso } from '@shared/dates'
import { useStore } from './store'

/** Only rendered once data is loaded (App gates on it). */
export const useData = (): AppData => useStore(s => s.data!)

export function useEventIndex(): EventIndex {
  const events = useStore(s => s.data!.events)
  return useMemo(() => indexByDate(events), [events])
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
