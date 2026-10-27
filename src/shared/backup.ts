import { z } from 'zod'
import type { AppData, CalendarEvent, Habit, HabitLog, Ink, Notes } from './model'
import {
  AppDataSchema, CATEGORIES, CalendarEventSchema, HabitSchema, INKS, ISO_DATE, SLOTS, TIME,
} from './model'
import { fromMin, toIso, toMin } from './dates'

export interface BackupPayload {
  events: CalendarEvent[]
  habits: Habit[]
  habitLog: HabitLog
  notes: Notes
  /** Absent in backups made before the journal and productivity features. */
  journal?: AppData['journal']
  priorities?: AppData['priorities']
  inbox?: AppData['inbox']
  focus?: AppData['focus']
  reviews?: AppData['reviews']
  accounts?: AppData['accounts']
  transactions?: AppData['transactions']
  subscriptions?: AppData['subscriptions']
  goals?: AppData['goals']
  budgets?: AppData['budgets']
}

export interface MergeResult {
  data: AppData
  added: { events: number; habits: number; days: number }
}

export const BACKUP_APP_ID = 'mi-semana'
export const WEB_EXPORT_ID = 'mi-semana-web'

export function toBackupFile(data: AppData, now = new Date()): string {
  const { events, habits, habitLog, notes, journal, priorities, inbox, focus, reviews, accounts, transactions, subscriptions, goals, budgets } = data
  return JSON.stringify(
    {
      app: BACKUP_APP_ID, schema: 1, exportedAt: now.toISOString(),
      data: { events, habits, habitLog, notes, journal, priorities, inbox, focus, reviews, accounts, transactions, subscriptions, goals, budgets },
    },
    null,
    2,
  )
}

const WEB_INK: Record<string, Ink> = {
  pink: 'magenta', blue: 'cobalt', yellow: 'amber', green: 'green', orange: 'vermilion', violet: 'violet',
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)

/** The web version stored loosely typed rows; keep every row that can be repaired, drop the rest. */
function fromWeb(raw: Record<string, unknown>): BackupPayload {
  const events: CalendarEvent[] = []
  for (const r of Array.isArray(raw.events) ? raw.events : []) {
    const e = obj(r)
    let start = TIME.test(str(e.start)) ? str(e.start) : ''
    let end = start && TIME.test(str(e.end)) ? str(e.end) : ''
    if (start && (!end || end <= start)) end = fromMin(Math.min(toMin(start) + 60, 23 * 60 + 59))
    if (start && end <= start) start = end = ''
    const parsed = CalendarEventSchema.safeParse({
      id: str(e.id) || crypto.randomUUID(),
      date: str(e.date),
      start,
      end,
      text: str(e.text).slice(0, 200),
      cat: (CATEGORIES as readonly string[]).includes(str(e.cat)) ? e.cat : 'otro',
      done: e.done === true,
      createdAt: Number.isFinite(e.t) ? Math.max(0, Math.trunc(e.t as number)) : 0,
    })
    if (parsed.success) events.push(parsed.data)
  }

  const habits: Habit[] = []
  for (const r of Array.isArray(raw.habits) ? raw.habits : []) {
    const h = obj(r)
    const parsed = HabitSchema.safeParse({
      id: str(h.id) || crypto.randomUUID(),
      name: str(h.name).slice(0, 60),
      kind: h.kind === 'suplemento' ? 'suplemento' : 'habito',
      dose: str(h.dose).slice(0, 40),
      target: Math.min(30, Math.max(1, Math.trunc(Number(h.target) || 1))),
      unit: str(h.unit).slice(0, 16),
      slot: (SLOTS as readonly string[]).includes(str(h.slot)) ? h.slot : 'cualquiera',
      days: Array.isArray(h.days) && h.days.length ? [...new Set(h.days.map(Number).filter(n => n >= 0 && n <= 6))] : [0, 1, 2, 3, 4, 5, 6],
      color: WEB_INK[str(h.color)] ?? ((INKS as readonly string[]).includes(str(h.color)) ? h.color : 'cobalt'),
      createdAt: ISO_DATE.test(str(h.created)) ? h.created : ISO_DATE.test(str(h.createdAt)) ? h.createdAt : toIso(new Date()),
    })
    if (parsed.success) habits.push(parsed.data)
  }

  const habitLog: HabitLog = {}
  for (const [day, counts] of Object.entries(obj(raw.habitLog))) {
    if (!ISO_DATE.test(day)) continue
    const clean: Record<string, number> = {}
    for (const [hid, n] of Object.entries(obj(counts))) {
      const v = Math.trunc(Number(n))
      if (v > 0 && v <= 99) clean[hid] = v
    }
    if (Object.keys(clean).length) habitLog[day] = clean
  }

  const notes: Notes = {}
  for (const [day, text] of Object.entries(obj(raw.notes))) {
    if (ISO_DATE.test(day) && typeof text === 'string' && text.trim()) notes[day] = text.slice(0, 4000)
  }
  return { events, habits, habitLog, notes }
}

const NativeBackup = z.object({
  app: z.literal(BACKUP_APP_ID),
  schema: z.literal(1),
  data: AppDataSchema.pick({ events: true, habits: true, habitLog: true, notes: true }).extend(
    AppDataSchema.pick({
      journal: true, priorities: true, inbox: true, focus: true, reviews: true,
      accounts: true, transactions: true, subscriptions: true, goals: true, budgets: true,
    }).partial().shape,
  ),
})

/** Accepts this app's backups and exports from the web version. Throws with a readable message. */
export function parseBackup(text: string): BackupPayload {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('El archivo no es un JSON válido.')
  }
  const app = obj(raw).app
  if (app === BACKUP_APP_ID) {
    const parsed = NativeBackup.safeParse(raw)
    if (!parsed.success) throw new Error('La copia de seguridad está dañada o es de otra versión.')
    return parsed.data.data
  }
  if (app === WEB_EXPORT_ID) return fromWeb(obj(raw))
  throw new Error('Este archivo no es una exportación de Mi Semana.')
}

/** Additive merge: nothing already in the app is overwritten; habit counts keep the higher value. */
export function mergeBackup(base: AppData, inc: BackupPayload, at = Date.now()): MergeResult {
  const eventIds = new Set(base.events.map(e => e.id))
  const habitIds = new Set(base.habits.map(h => h.id))
  const newEvents = inc.events.filter(e => !eventIds.has(e.id))
  const newHabits = inc.habits.filter(h => !habitIds.has(h.id))

  const habitLog: HabitLog = { ...base.habitLog }
  let days = 0
  for (const [day, counts] of Object.entries(inc.habitLog)) {
    const cur = { ...(habitLog[day] ?? {}) }
    let changed = false
    for (const [hid, n] of Object.entries(counts)) {
      if ((cur[hid] ?? 0) < n) {
        cur[hid] = n
        changed = true
      }
    }
    if (changed) {
      habitLog[day] = cur
      days++
    }
  }

  const notes: Notes = { ...base.notes }
  const stamps = { ...base.stamps }
  for (const [day, text] of Object.entries(inc.notes)) {
    if (notes[day]) continue
    notes[day] = text
    stamps[`n:${day}`] = at
  }
  // Journal, priorities, focus and reviews: a day the app already has is kept as it is.
  const days_ = <T>(field: 'journal' | 'priorities' | 'focus' | 'reviews', kind: string): Record<string, T> => {
    const map = { ...(base[field] as Record<string, T>) }
    for (const [day, v] of Object.entries((inc[field] ?? {}) as Record<string, T>)) {
      if (map[day] !== undefined) continue
      map[day] = v
      stamps[`${kind}:${day}`] = at
    }
    return map
  }
  const journal = days_<AppData['journal'][string]>('journal', 'j')
  const priorities = days_<AppData['priorities'][string]>('priorities', 'p')
  const focus = days_<AppData['focus'][string]>('focus', 'f')
  const reviews = days_<AppData['reviews'][string]>('reviews', 'r')
  const inboxIds = new Set(base.inbox.map(i => i.id))
  const newInbox = (inc.inbox ?? []).filter(i => !inboxIds.has(i.id))
  for (const i of newInbox) stamps[`i:${i.id}`] = at
  // Finance lists: only records the app does not have yet.
  const addNew = <T extends { id: string }>(have: readonly T[], inc: readonly T[] | undefined, kind: string): T[] => {
    const ids = new Set(have.map(x => x.id))
    const fresh = (inc ?? []).filter(x => !ids.has(x.id))
    for (const x of fresh) stamps[`${kind}:${x.id}`] = at
    return [...have, ...fresh]
  }
  const accounts = addNew(base.accounts, inc.accounts, 'a')
  const transactions = addNew(base.transactions, inc.transactions, 't')
  const subscriptions = addNew(base.subscriptions, inc.subscriptions, 'u')
  const goals = addNew(base.goals, inc.goals, 'g')
  const budgets = Object.keys(base.budgets).length || !inc.budgets ? base.budgets : inc.budgets
  if (budgets !== base.budgets) stamps['b:budgets'] = at

  for (const e of newEvents) stamps[`e:${e.id}`] = at
  for (const h of newHabits) stamps[`h:${h.id}`] = at
  for (const day of Object.keys(habitLog)) if (habitLog[day] !== base.habitLog[day]) stamps[`l:${day}`] = at

  return {
    data: {
      ...base, events: [...base.events, ...newEvents], habits: [...base.habits, ...newHabits], habitLog, notes,
      journal, priorities, focus, reviews, inbox: [...base.inbox, ...newInbox], accounts, transactions, subscriptions, goals, budgets, stamps,
    },
    added: { events: newEvents.length, habits: newHabits.length, days },
  }
}
