import type { Command } from './commands'
import type { AppData, CalendarEvent } from './model'

function upsertById<T extends { id: string }>(list: readonly T[], item: T, index?: number): T[] {
  const i = list.findIndex(x => x.id === item.id)
  if (i >= 0) return list.map((x, j) => (j === i ? item : x))
  const next = list.slice()
  next.splice(index ?? next.length, 0, item)
  return next
}

/**
 * Records a change for sync. The stamp never goes backwards for a key, so the same command
 * produces the same result in the renderer and in the main process.
 */
function stamp(data: AppData, key: string, at: number | undefined, deleted = false): Pick<AppData, 'stamps' | 'tombs'> {
  if (at === undefined) return { stamps: data.stamps, tombs: data.tombs }
  const t = Math.max(at, (data.stamps[key] ?? 0) + 1, (data.tombs[key] ?? 0) + 1)
  const stamps = { ...data.stamps }
  const tombs = { ...data.tombs }
  if (deleted) {
    delete stamps[key]
    tombs[key] = t
  } else {
    delete tombs[key]
    stamps[key] = t
  }
  return { stamps, tombs }
}

const toggleIn = (list: readonly string[] | undefined, value: string, on: boolean): string[] => {
  const set = new Set(list ?? [])
  if (on) set.add(value)
  else set.delete(value)
  return [...set].sort()
}

function occurrence(e: CalendarEvent, date: string, op: 'done' | 'undone' | 'skip'): CalendarEvent {
  if (op === 'skip') return { ...e, exceptions: toggleIn(e.exceptions, date, true), doneDates: toggleIn(e.doneDates, date, false) }
  return { ...e, doneDates: toggleIn(e.doneDates, date, op === 'done') }
}

/** Pure reducer: returns a new object, sharing untouched branches with the input. */
export function applyCommand(data: AppData, cmd: Command): AppData {
  switch (cmd.type) {
    case 'event.upsert':
      return { ...data, events: upsertById(data.events, cmd.event), ...stamp(data, `e:${cmd.event.id}`, cmd.at) }
    case 'event.delete':
      return { ...data, events: data.events.filter(e => e.id !== cmd.id), ...stamp(data, `e:${cmd.id}`, cmd.at, true) }
    case 'event.setDone':
      return {
        ...data,
        events: data.events.map(e => (e.id === cmd.id ? { ...e, done: cmd.done } : e)),
        ...stamp(data, `e:${cmd.id}`, cmd.at),
      }
    case 'event.occurrence':
      return {
        ...data,
        events: data.events.map(e => (e.id === cmd.id ? occurrence(e, cmd.date, cmd.op) : e)),
        ...stamp(data, `e:${cmd.id}`, cmd.at),
      }
    case 'habit.upsert':
      return { ...data, habits: upsertById(data.habits, cmd.habit, cmd.index), ...stamp(data, `h:${cmd.habit.id}`, cmd.at) }
    case 'habit.delete':
      return { ...data, habits: data.habits.filter(h => h.id !== cmd.id), ...stamp(data, `h:${cmd.id}`, cmd.at, true) }
    case 'habitLog.set': {
      const day = { ...(data.habitLog[cmd.date] ?? {}) }
      if (cmd.count > 0) day[cmd.habitId] = cmd.count
      else delete day[cmd.habitId]
      const habitLog = { ...data.habitLog }
      if (Object.keys(day).length) habitLog[cmd.date] = day
      else delete habitLog[cmd.date]
      return { ...data, habitLog, ...stamp(data, `l:${cmd.date}`, cmd.at) }
    }
    case 'note.set': {
      const notes = { ...data.notes }
      if (cmd.text.trim()) notes[cmd.date] = cmd.text
      else delete notes[cmd.date]
      return { ...data, notes, ...stamp(data, `n:${cmd.date}`, cmd.at) }
    }
    case 'settings.set':
      return { ...data, settings: cmd.settings }
  }
}
