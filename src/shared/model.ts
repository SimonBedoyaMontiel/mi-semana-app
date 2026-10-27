import { z } from 'zod'
import {
  BACKDROPS, CATEGORIES, DEFAULT_SETTINGS, ENERGY, HABIT_KINDS, HEX, HOLIDAY_COUNTRIES, INKS, ISO_DATE, PALETTES, PRIORITIES, REPEAT_FREQS, SLOTS, TIME,
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
})

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
  })
  .refine(e => (e.start === '' ? e.end === '' : e.end !== '' && e.end > e.start), {
    message: 'La hora de fin tiene que ser posterior a la de inicio',
    path: ['end'],
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
})

/** The part of the settings that follows the account to every device (sync key `s:prefs`). */
export const PrefsSchema = z.object({ look: LookSchema, holidays: z.enum(HOLIDAY_COUNTRIES) })

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
  settings: SettingsSchema,
  /**
   * Sync bookkeeping: record key → last change (ms). Keys: e:<id> event, h:<id> habit, l:<date> habit log,
   * n:<date> note, j:<date> journal, p:<date> priorities, f:<date> focus, r:<monday> review, i:<id> inbox, s:prefs.
   */
  stamps: z.record(z.string(), z.number()),
  /** Record key → deletion time (ms), so deletions travel between devices. */
  tombs: z.record(z.string(), z.number()),
})

export type Category = (typeof CATEGORIES)[number]
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
  settings: structuredClone(DEFAULT_SETTINGS),
  stamps: {},
  tombs: {},
})
