import type { Command } from './commands'
import type { AppData } from './model'

function upsertById<T extends { id: string }>(list: readonly T[], item: T, index?: number): T[] {
  const i = list.findIndex(x => x.id === item.id)
  if (i >= 0) return list.map((x, j) => (j === i ? item : x))
  const next = list.slice()
  next.splice(index ?? next.length, 0, item)
  return next
}

/** Pure reducer: returns a new object, sharing untouched branches with the input. */
export function applyCommand(data: AppData, cmd: Command): AppData {
  switch (cmd.type) {
    case 'event.upsert':
      return { ...data, events: upsertById(data.events, cmd.event) }
    case 'event.delete':
      return { ...data, events: data.events.filter(e => e.id !== cmd.id) }
    case 'event.setDone':
      return { ...data, events: data.events.map(e => (e.id === cmd.id ? { ...e, done: cmd.done } : e)) }
    case 'habit.upsert':
      return { ...data, habits: upsertById(data.habits, cmd.habit, cmd.index) }
    case 'habit.delete':
      return { ...data, habits: data.habits.filter(h => h.id !== cmd.id) }
    case 'habitLog.set': {
      const day = { ...(data.habitLog[cmd.date] ?? {}) }
      if (cmd.count > 0) day[cmd.habitId] = cmd.count
      else delete day[cmd.habitId]
      const habitLog = { ...data.habitLog }
      if (Object.keys(day).length) habitLog[cmd.date] = day
      else delete habitLog[cmd.date]
      return { ...data, habitLog }
    }
    case 'note.set': {
      const notes = { ...data.notes }
      if (cmd.text.trim()) notes[cmd.date] = cmd.text
      else delete notes[cmd.date]
      return { ...data, notes }
    }
    case 'settings.set':
      return { ...data, settings: cmd.settings }
  }
}
