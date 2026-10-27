import type { AppData } from './model'
import { CalendarEventSchema, DEFAULT_SETTINGS, HabitLogSchema, HabitSchema, NotesSchema, SettingsSchema } from './model'
import { ensureStamps } from './sync'

/** Lenient load: one bad row never costs the whole file. New settings fields get defaults. */
export function sanitize(raw: unknown): AppData {
  if (!raw || typeof raw !== 'object') throw new Error('not an object')
  const r = raw as Record<string, unknown>
  const keep = <T>(list: unknown, parse: (v: unknown) => { success: boolean; data?: T }): T[] =>
    (Array.isArray(list) ? list : []).flatMap(v => {
      const p = parse(v)
      return p.success ? [p.data as T] : []
    })
  const s = (r.settings ?? {}) as Record<string, unknown>
  const settings = SettingsSchema.safeParse({
    ...DEFAULT_SETTINGS,
    ...s,
    slotTimes: { ...DEFAULT_SETTINGS.slotTimes, ...((s.slotTimes as object) ?? {}) },
  })
  const habitLog = HabitLogSchema.safeParse(r.habitLog ?? {})
  const notes = NotesSchema.safeParse(r.notes ?? {})
  const times = (v: unknown): Record<string, number> =>
    Object.fromEntries(Object.entries(v && typeof v === 'object' ? v : {}).filter(([, t]) => Number.isFinite(t)) as Array<[string, number]>)
  return ensureStamps({
    schema: 1,
    events: keep(r.events, v => CalendarEventSchema.safeParse(v)),
    habits: keep(r.habits, v => HabitSchema.safeParse(v)),
    habitLog: habitLog.success ? habitLog.data : {},
    notes: notes.success ? notes.data : {},
    settings: settings.success ? settings.data : structuredClone(DEFAULT_SETTINGS),
    stamps: times(r.stamps),
    tombs: times(r.tombs),
  })
}
