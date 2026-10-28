import type { AppData, Slot } from './model'
import { SLOT_LABEL } from './constants'
import { addDays, fromIso, fromMin, toIso, toMin } from './dates'
import { isActiveOn, isComplete } from './habits'
import { expandRange } from './events'
import { fmtMoney, paymentsBetween } from './money'

export interface Reminder {
  /** Stable identity, so a reminder never fires twice. */
  key: string
  at: number
  title: string
  body: string
  date: string
  /** Meeting link: clicking the notice opens it. */
  url?: string
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
    for (const e of expandRange(data.events, firstDay, lastDay)) {
      if (!e.start || e.done) continue
      const lead = e.remind ?? settings.eventLeadMinutes
      if (lead < 0) continue
      const t = at(e.date, e.start) - lead * 60_000
      if (!inWindow(t)) continue
      out.push({
        key: `e:${e.id}:${e.date}:${e.start}:${lead}`,
        at: t,
        date: e.date,
        title: e.text,
        body: `${lead ? `Empieza en ${lead} min` : 'Empieza ahora'} · ${e.start}–${e.end}${e.link ? ' · Toca para unirte' : e.location ? ` · ${e.location}` : ''}`,
        ...(e.link ? { url: e.link } : {}),
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
  // Subscriptions: a warning on the morning a few days before each payment.
  for (const sub of data.subscriptions) {
    if (!sub.active || sub.remindDays < 0) continue
    const payFrom = toIso(addDays(fromIso(firstDay), sub.remindDays))
    const payTo = toIso(addDays(fromIso(lastDay), sub.remindDays))
    for (const pay of paymentsBetween(sub, payFrom, payTo)) {
      const day = toIso(addDays(fromIso(pay), -sub.remindDays))
      const t = at(day, settings.slotTimes.manana)
      if (!inWindow(t)) continue
      const when = sub.remindDays === 0 ? 'Se cobra hoy' : sub.remindDays === 1 ? 'Se cobra mañana' : `Se cobra en ${sub.remindDays} días`
      out.push({
        key: `u:${sub.id}:${pay}:${sub.remindDays}`,
        at: t,
        date: pay,
        title: `${sub.name}: ${fmtMoney(sub.cents, settings.currency)}`,
        body: `${when} (${fromIso(pay).getDate()}/${fromIso(pay).getMonth() + 1}).`,
      })
    }
  }
  return out.sort((a, b) => a.at - b.at)
}
