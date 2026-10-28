import { z } from 'zod'
import {
  ACCOUNT_KINDS, BACKDROPS, FIN_ICONS, CATEGORIES, CURRENCIES, CYCLES, DEFAULT_SETTINGS, ENERGY, FIN_CATS, TX_KINDS, HABIT_KINDS, HEX, HOLIDAY_COUNTRIES, INKS, ISO_DATE, PALETTES, PRIORITIES, REPEAT_FREQS, SLOTS, TIME,
} from './constants'

export * from './constants'

const isoDate = z.string().regex(ISO_DATE)
const time = z.string().regex(TIME)
const optionalTime = z.union([time, z.literal('')])

export const RepeatSchema = z.object({
  freq: z.enum(REPEAT_FREQS),
  interval: z.number().int().min(1).max(30),
  /** Weekly only: Monday = 0 … Sunday = 6. Defaults to the weekday of the first date. */
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
  until: isoDate.optional(),
  /** Ends after this many occurrences (removed days still count, as in other calendars). */
  count: z.number().int().min(1).max(999).optional(),
  /** Monthly only: the nth weekday of the first date (1–4), or -1 for the last one in the month. */
  pos: z.union([z.literal(-1), z.number().int().min(1).max(4)]).optional(),
})

export const SubtaskSchema = z.object({
  id: z.string().min(1).max(64),
  text: z.string().trim().min(1).max(200),
  done: z.boolean(),
})

/** Optional details shared by events and templates. */
const eventDetails = {
  /** Video call or any web address; opens with «Unirse». */
  link: z.string().trim().url().max(500).refine(u => /^https?:\/\//i.test(u)).optional(),
  location: z.string().trim().min(1).max(200).optional(),
  notes: z.string().max(5000).optional(),
  tasks: z.array(SubtaskSchema).max(50).optional(),
  guests: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
}

export const CalendarEventSchema = z
  .object({
    id: z.string().min(1).max(64),
    date: isoDate,
    start: optionalTime,
    end: optionalTime,
    text: z.string().trim().min(1).max(200),
    cat: z.enum(CATEGORIES),
    /** Overrides the category colour. */
    color: z.enum(INKS).optional(),
    priority: z.enum(PRIORITIES).optional(),
    done: z.boolean(),
    createdAt: z.number().int().nonnegative(),
    remind: z.number().int().min(-1).max(24 * 60).optional(),
    repeat: RepeatSchema.optional(),
    /** Recurring only: dates removed from the series. */
    exceptions: z.array(isoDate).max(2000).optional(),
    /** Recurring only: occurrences marked as done. */
    doneDates: z.array(isoDate).max(5000).optional(),
    /** Untimed task moved forward because it was not done: the day it was first planned for. */
    from: isoDate.optional(),
    /** All-day events that last several days: the last day. */
    endDate: isoDate.optional(),
    ...eventDetails,
  })
  .refine(e => (e.start === '' ? e.end === '' : e.end !== '' && e.end > e.start), {
    message: 'La hora de fin tiene que ser posterior a la de inicio',
    path: ['end'],
  })
  .refine(e => !e.endDate || (e.endDate > e.date && !e.start && !e.repeat), {
    message: 'Un evento de varios días va sin hora, no se repite y termina después de empezar',
    path: ['endDate'],
  })

/** A saved event to reuse: everything but the date. */
export const TemplateSchema = z.object({
  id: z.string().min(1).max(64),
  text: z.string().trim().min(1).max(200),
  /** Minutes from midnight and length; 0 length means no time. */
  startMin: z.number().int().min(0).max(24 * 60 - 1),
  minutes: z.number().int().min(0).max(24 * 60),
  cat: z.enum(CATEGORIES),
  color: z.enum(INKS).optional(),
  priority: z.enum(PRIORITIES).optional(),
  remind: z.number().int().min(-1).max(24 * 60).optional(),
  ...eventDetails,
  createdAt: z.number().int().nonnegative(),
})

export const HabitSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(60),
  kind: z.enum(HABIT_KINDS),
  dose: z.string().max(40),
  target: z.number().int().min(1).max(30),
  unit: z.string().max(16),
  slot: z.enum(SLOTS),
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  color: z.enum(INKS),
  createdAt: isoDate,
})

export const HabitLogSchema = z.record(isoDate, z.record(z.string(), z.number().int().min(0).max(99)))
export const NotesSchema = z.record(isoDate, z.string().max(4000))

/** One day's journal, next to the free-text note (notes). */
export const JournalSchema = z.object({
  mood: z.number().int().min(1).max(5).optional(),
  energy: z.enum(ENERGY).optional(),
  gratitude: z.array(z.string().max(140)).max(3),
  /** Answer to the day's question. */
  answer: z.string().max(1000),
})

/** One of the day's three priorities. */
export const TopSchema = z.object({ id: z.string().min(1).max(64), text: z.string().trim().min(1).max(120), done: z.boolean() })

/** Something to do with no date yet. */
export const InboxItemSchema = z.object({
  id: z.string().min(1).max(64),
  text: z.string().trim().min(1).max(200),
  createdAt: z.number().int().nonnegative(),
  priority: z.enum(PRIORITIES).optional(),
  cat: z.enum(CATEGORIES).optional(),
})

/** A finished focus block. */
export const FocusSessionSchema = z.object({
  id: z.string().min(1).max(64),
  /** Start time (ms). */
  start: z.number().int().nonnegative(),
  minutes: z.number().int().min(1).max(180),
  label: z.string().max(200),
  eventId: z.string().max(80).optional(),
})

/** Weekly review, keyed by the week's Monday. */
export const ReviewSchema = z.object({
  good: z.string().max(1000),
  improve: z.string().max(1000),
  next: z.string().max(1000),
})

/** Money is kept as integer hundredths of the unit (cents), never as floating point. */
const cents = z.number().int().min(0).max(1e13)
const finId = z.string().min(1).max(64)

export const AccountSchema = z.object({
  id: finId,
  name: z.string().trim().min(1).max(60),
  kind: z.enum(ACCOUNT_KINDS),
  color: z.enum(INKS),
  icon: z.enum(FIN_ICONS).optional(),
  /** Balance before the first movement recorded here (credit cards: debt as a negative number). */
  initial: z.number().int().min(-1e13).max(1e13),
  createdAt: z.number().int().nonnegative(),
})

export const TransactionSchema = z.object({
  id: finId,
  date: isoDate,
  kind: z.enum(TX_KINDS),
  cents,
  cat: z.enum(FIN_CATS),
  /** Overrides the category's icon. */
  icon: z.enum(FIN_ICONS).optional(),
  accountId: z.string().max(64).optional(),
  note: z.string().max(200),
  /** Set when a subscription logged this payment by itself. */
  subId: z.string().max(64).optional(),
  createdAt: z.number().int().nonnegative(),
})

export const SubscriptionSchema = z.object({
  id: finId,
  name: z.string().trim().min(1).max(60),
  cents,
  cycle: z.enum(CYCLES),
  /** A payment date; the rest follow from it by the cycle. */
  anchor: isoDate,
  accountId: z.string().max(64).optional(),
  color: z.enum(INKS),
  /** Without one, the first letter of the name is shown. */
  icon: z.enum(FIN_ICONS).optional(),
  /** Days before the payment to warn; -1 for no warning. */
  remindDays: z.number().int().min(-1).max(14),
  /** Record each payment as an expense on its day. */
  autoLog: z.boolean(),
  active: z.boolean(),
  /** Last date whose payment was already recorded. */
  loggedThrough: isoDate.optional(),
  createdAt: z.number().int().nonnegative(),
})

export const GoalSchema = z.object({
  id: finId,
  name: z.string().trim().min(1).max(60),
  target: cents,
  saved: cents,
  color: z.enum(INKS),
  icon: z.enum(FIN_ICONS).optional(),
  deadline: isoDate.optional(),
  createdAt: z.number().int().nonnegative(),
})

/** Monthly limit per expense category (cents). */
export const BudgetsSchema = z.partialRecord(z.enum(FIN_CATS), cents)

export const JournalMapSchema = z.record(isoDate, JournalSchema)
export const PrioritiesSchema = z.record(isoDate, z.array(TopSchema).max(3))
export const FocusLogSchema = z.record(isoDate, z.array(FocusSessionSchema).max(50))
export const ReviewsSchema = z.record(isoDate, ReviewSchema)

export const LookSchema = z.object({
  palette: z.enum(PALETTES),
  /** '' follows the palette; otherwise #rrggbb. */
  accent: z.union([z.literal(''), z.string().regex(HEX)]),
  backdrop: z.enum(BACKDROPS),
  /** Backdrop strength, 0–100. */
  glow: z.number().int().min(0).max(100),
  /** Backdrop drifts slowly. */
  moving: z.boolean(),
})

export const SettingsSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']),
  eventReminders: z.boolean(),
  eventLeadMinutes: z.number().int().min(0).max(120),
  habitReminders: z.boolean(),
  slotTimes: z.object({ manana: time, mediodia: time, tarde: time, noche: time }),
  launchAtLogin: z.boolean(),
  closeToTray: z.boolean(),
  sidebar: z.boolean(),
  look: LookSchema,
  holidays: z.enum(HOLIDAY_COUNTRIES),
  /** Move undone untimed tasks from past days to today. */
  carryOver: z.boolean(),
  focusMinutes: z.number().int().min(5).max(180),
  currency: z.enum(CURRENCIES),
})

/** The part of the settings that follows the account to every device (sync key `s:prefs`). */
export const PrefsSchema = z.object({ look: LookSchema, holidays: z.enum(HOLIDAY_COUNTRIES), currency: z.enum(CURRENCIES).optional() })

export const AppDataSchema = z.object({
  schema: z.literal(1),
  events: z.array(CalendarEventSchema),
  habits: z.array(HabitSchema),
  habitLog: HabitLogSchema,
  notes: NotesSchema,
  journal: JournalMapSchema,
  priorities: PrioritiesSchema,
  inbox: z.array(InboxItemSchema),
  focus: FocusLogSchema,
  reviews: ReviewsSchema,
  accounts: z.array(AccountSchema),
  transactions: z.array(TransactionSchema),
  subscriptions: z.array(SubscriptionSchema),
  goals: z.array(GoalSchema),
  budgets: BudgetsSchema,
  templates: z.array(TemplateSchema),
  settings: SettingsSchema,
  /**
   * Sync bookkeeping: record key → last change (ms). Keys: e:<id> event, h:<id> habit, l:<date> habit log,
   * n:<date> note, j:<date> journal, p:<date> priorities, f:<date> focus, r:<monday> review, i:<id> inbox, s:prefs,
   * t:<id> transaction, u:<id> subscription, a:<id> account, g:<id> goal, b:budgets, x:<id> template.
   */
  stamps: z.record(z.string(), z.number()),
  /** Record key → deletion time (ms), so deletions travel between devices. */
  tombs: z.record(z.string(), z.number()),
})

export type Category = (typeof CATEGORIES)[number]
export type Template = z.infer<typeof TemplateSchema>
export type Subtask = z.infer<typeof SubtaskSchema>
export type Ink = (typeof INKS)[number]
export type Slot = (typeof SLOTS)[number]
export type HabitKind = (typeof HABIT_KINDS)[number]
export type Priority = (typeof PRIORITIES)[number]
export type Energy = (typeof ENERGY)[number]
export type Journal = z.infer<typeof JournalSchema>
export type Top = z.infer<typeof TopSchema>
export type InboxItem = z.infer<typeof InboxItemSchema>
export type FocusSession = z.infer<typeof FocusSessionSchema>
export type Review = z.infer<typeof ReviewSchema>
export type Account = z.infer<typeof AccountSchema>
export type Transaction = z.infer<typeof TransactionSchema>
export type Subscription = z.infer<typeof SubscriptionSchema>
export type Goal = z.infer<typeof GoalSchema>
export type Budgets = z.infer<typeof BudgetsSchema>
export type FinCat = (typeof FIN_CATS)[number]
export type { FinIconName } from './constants'
export type Currency = (typeof CURRENCIES)[number]
export type Palette = (typeof PALETTES)[number]
export type Backdrop = (typeof BACKDROPS)[number]
export type Country = (typeof HOLIDAY_COUNTRIES)[number]
export type Look = z.infer<typeof LookSchema>
export type Prefs = z.infer<typeof PrefsSchema>
export type Repeat = z.infer<typeof RepeatSchema>
export type CalendarEvent = z.infer<typeof CalendarEventSchema>
export type Habit = z.infer<typeof HabitSchema>
export type HabitLog = z.infer<typeof HabitLogSchema>
export type Notes = z.infer<typeof NotesSchema>
export type Settings = z.infer<typeof SettingsSchema>
export type AppData = z.infer<typeof AppDataSchema>

export const emptyData = (): AppData => ({
  schema: 1,
  events: [],
  habits: [],
  habitLog: {},
  notes: {},
  journal: {},
  priorities: {},
  inbox: [],
  focus: {},
  reviews: {},
  accounts: [],
  transactions: [],
  subscriptions: [],
  goals: [],
  budgets: {},
  templates: [],
  settings: structuredClone(DEFAULT_SETTINGS),
  stamps: {},
  tombs: {},
})
