import type { Command } from './commands'
import type { AppData, CalendarEvent } from './model'

export const PREFS_KEY = 's:prefs'
export const BUDGETS_KEY = 'b:budgets'

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

/** Sets or (with null) removes one day's entry of a date-keyed map. */
function setDay<T>(map: Record<string, T>, date: string, value: T | null): Record<string, T> {
  const next = { ...map }
  if (value === null) delete next[date]
  else next[date] = value
  return next
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
    case 'journal.set':
      return { ...data, journal: setDay(data.journal, cmd.date, cmd.entry), ...stamp(data, `j:${cmd.date}`, cmd.at) }
    case 'priorities.set':
      return { ...data, priorities: setDay(data.priorities, cmd.date, cmd.items.length ? cmd.items : null), ...stamp(data, `p:${cmd.date}`, cmd.at) }
    case 'inbox.upsert':
      return { ...data, inbox: upsertById(data.inbox, cmd.item), ...stamp(data, `i:${cmd.item.id}`, cmd.at) }
    case 'inbox.delete':
      return { ...data, inbox: data.inbox.filter(i => i.id !== cmd.id), ...stamp(data, `i:${cmd.id}`, cmd.at, true) }
    case 'focus.add': {
      const day = data.focus[cmd.date] ?? []
      if (day.some(s => s.id === cmd.session.id)) return data
      return { ...data, focus: { ...data.focus, [cmd.date]: [...day, cmd.session].slice(-50) }, ...stamp(data, `f:${cmd.date}`, cmd.at) }
    }
    case 'review.set':
      return { ...data, reviews: setDay(data.reviews, cmd.week, cmd.review), ...stamp(data, `r:${cmd.week}`, cmd.at) }
    case 'tx.upsert':
      return { ...data, transactions: upsertById(data.transactions, cmd.item), ...stamp(data, `t:${cmd.item.id}`, cmd.at) }
    case 'tx.delete':
      return { ...data, transactions: data.transactions.filter(x => x.id !== cmd.id), ...stamp(data, `t:${cmd.id}`, cmd.at, true) }
    case 'sub.upsert':
      return { ...data, subscriptions: upsertById(data.subscriptions, cmd.item), ...stamp(data, `u:${cmd.item.id}`, cmd.at) }
    case 'sub.delete':
      return { ...data, subscriptions: data.subscriptions.filter(x => x.id !== cmd.id), ...stamp(data, `u:${cmd.id}`, cmd.at, true) }
    case 'account.upsert':
      return { ...data, accounts: upsertById(data.accounts, cmd.item), ...stamp(data, `a:${cmd.item.id}`, cmd.at) }
    case 'account.delete':
      return { ...data, accounts: data.accounts.filter(x => x.id !== cmd.id), ...stamp(data, `a:${cmd.id}`, cmd.at, true) }
    case 'goal.upsert':
      return { ...data, goals: upsertById(data.goals, cmd.item), ...stamp(data, `g:${cmd.item.id}`, cmd.at) }
    case 'goal.delete':
      return { ...data, goals: data.goals.filter(x => x.id !== cmd.id), ...stamp(data, `g:${cmd.id}`, cmd.at, true) }
    case 'template.upsert':
      return { ...data, templates: upsertById(data.templates, cmd.item), ...stamp(data, `x:${cmd.item.id}`, cmd.at) }
    case 'template.delete':
      return { ...data, templates: data.templates.filter(x => x.id !== cmd.id), ...stamp(data, `x:${cmd.id}`, cmd.at, true) }
    case 'budgets.set':
      return { ...data, budgets: cmd.budgets, ...stamp(data, BUDGETS_KEY, cmd.at) }
    case 'settings.set': {
      // Only the look and the holiday calendar follow the account; the rest belongs to this device.
      const prefsChanged =
        JSON.stringify([data.settings.look, data.settings.holidays, data.settings.currency]) !==
        JSON.stringify([cmd.settings.look, cmd.settings.holidays, cmd.settings.currency])
      return { ...data, settings: cmd.settings, ...(prefsChanged ? stamp(data, PREFS_KEY, cmd.at) : {}) }
    }
  }
}
