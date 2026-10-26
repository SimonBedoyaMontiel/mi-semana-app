import type { AppData, Slot } from './model'
import { SLOT_LABEL } from './constants'
import { addDays, fromIso, fromMin, toIso, toMin } from './dates'
import { isActiveOn, isComplete } from './habits'

export interface Reminder {
  /** Stable identity, so a reminder never fires twice. */
  key: string
  at: number
  title: string
  body: string
  date: string
}

const TIMED_SLOTS: readonly Exclude<Slot, 'cualquiera'>[] = ['manana', 'mediodia', 'tarde', 'noche']

const at = (date: string, time: string): number => {
  const d = fromIso(date)
  d.setMinutes(toMin(time))
  return d.getTime()
}

/** Reminders whose fire time falls in (from, to]. */
export function remindersBetween(data: AppData, from: number, to: number): Reminder[] {
  const out: Reminder[] = []
  const { settings } = data
  const firstDay = toIso(new Date(from))
  const lastDay = toIso(addDays(new Date(to), 1))
  const inWindow = (t: number): boolean => t > from && t <= to

  if (settings.eventReminders) {
    for (const e of data.events) {
      if (!e.start || e.done || e.date < firstDay || e.date > lastDay) continue
      const lead = e.remind ?? settings.eventLeadMinutes
      if (lead < 0) continue
      const t = at(e.date, e.start) - lead * 60_000
      if (!inWindow(t)) continue
      out.push({
        key: `e:${e.id}:${e.date}:${e.start}:${lead}`,
        at: t,
        date: e.date,
        title: e.text,
        body: `${lead ? `Empieza en ${lead} min` : 'Empieza ahora'} · ${e.start}–${e.end}`,
      })
    }
  }

  if (settings.habitReminders && data.habits.length) {
    for (let d = fromIso(firstDay); toIso(d) <= lastDay; d = addDays(d, 1)) {
      const date = toIso(d)
      for (const slot of TIMED_SLOTS) {
        const time = settings.slotTimes[slot]
        const t = at(date, time)
        if (!inWindow(t)) continue
        const pending = data.habits.filter(h => h.slot === slot && isActiveOn(h, date) && !isComplete(data.habitLog, h, date))
        if (!pending.length) continue
        out.push({
          key: `h:${date}:${slot}:${fromMin(toMin(time))}`,
          at: t,
          date,
          title: `${SLOT_LABEL[slot]}: ${pending.length === 1 ? pending[0]!.name : `${pending.length} pendientes`}`,
          body: pending.map(h => (h.dose ? `${h.name} (${h.dose})` : h.name)).join(' · '),
        })
      }
    }
  }
  return out.sort((a, b) => a.at - b.at)
}
