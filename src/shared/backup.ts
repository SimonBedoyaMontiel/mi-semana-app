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
}

export interface MergeResult {
  data: AppData
  added: { events: number; habits: number; days: number }
}

export const BACKUP_APP_ID = 'mi-semana'
export const WEB_EXPORT_ID = 'mi-semana-web'

export function toBackupFile(data: AppData, now = new Date()): string {
  const { events, habits, habitLog, notes } = data
  return JSON.stringify({ app: BACKUP_APP_ID, schema: 1, exportedAt: now.toISOString(), data: { events, habits, habitLog, notes } }, null, 2)
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
  data: AppDataSchema.pick({ events: true, habits: true, habitLog: true, notes: true }),
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
export function mergeBackup(base: AppData, inc: BackupPayload): MergeResult {
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
  for (const [day, text] of Object.entries(inc.notes)) if (!notes[day]) notes[day] = text

  return {
    data: { ...base, events: [...base.events, ...newEvents], habits: [...base.habits, ...newHabits], habitLog, notes },
    added: { events: newEvents.length, habits: newHabits.length, days },
  }
}
