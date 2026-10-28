import type { z } from 'zod'
import type { AppData } from './model'
import {
  AccountSchema, BudgetsSchema, TemplateSchema, CalendarEventSchema, DEFAULT_SETTINGS, GoalSchema, SubscriptionSchema, TransactionSchema, FocusSessionSchema, HabitLogSchema, HabitSchema, ISO_DATE, InboxItemSchema, JournalSchema,
  LookSchema, NotesSchema, ReviewSchema, SettingsSchema, TopSchema,
} from './model'
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
  /** Date-keyed map: each day is checked on its own. */
  const keepDays = <S extends z.ZodType>(map: unknown, schema: S): Record<string, z.infer<S>> =>
    Object.fromEntries(
      Object.entries(map && typeof map === 'object' && !Array.isArray(map) ? map : {}).flatMap(([day, v]) => {
        const p = schema.safeParse(v)
        return ISO_DATE.test(day) && p.success ? [[day, p.data]] : []
      }),
    )
  const s = (r.settings ?? {}) as Record<string, unknown>
  const look = LookSchema.safeParse({ ...DEFAULT_SETTINGS.look, ...((s.look as object) ?? {}) })
  const settings = SettingsSchema.safeParse({
    ...DEFAULT_SETTINGS,
    ...s,
    slotTimes: { ...DEFAULT_SETTINGS.slotTimes, ...((s.slotTimes as object) ?? {}) },
    look: look.success ? look.data : DEFAULT_SETTINGS.look,
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
    journal: keepDays(r.journal, JournalSchema),
    priorities: keepDays(r.priorities, TopSchema.array().max(3)),
    inbox: keep(r.inbox, v => InboxItemSchema.safeParse(v)),
    focus: keepDays(r.focus, FocusSessionSchema.array().max(50)),
    reviews: keepDays(r.reviews, ReviewSchema),
    accounts: keep(r.accounts, v => AccountSchema.safeParse(v)),
    transactions: keep(r.transactions, v => TransactionSchema.safeParse(v)),
    subscriptions: keep(r.subscriptions, v => SubscriptionSchema.safeParse(v)),
    goals: keep(r.goals, v => GoalSchema.safeParse(v)),
    templates: keep(r.templates, v => TemplateSchema.safeParse(v)),
    budgets: BudgetsSchema.safeParse(r.budgets ?? {}).data ?? {},
    settings: settings.success ? settings.data : structuredClone(DEFAULT_SETTINGS),
    stamps: times(r.stamps),
    tombs: times(r.tombs),
  })
}
