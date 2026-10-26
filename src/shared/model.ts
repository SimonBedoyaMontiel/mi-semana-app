import { z } from 'zod'
import { CATEGORIES, DEFAULT_SETTINGS, HABIT_KINDS, INKS, ISO_DATE, SLOTS, TIME } from './constants'

export * from './constants'

const isoDate = z.string().regex(ISO_DATE)
const time = z.string().regex(TIME)
const optionalTime = z.union([time, z.literal('')])

export const CalendarEventSchema = z
  .object({
    id: z.string().min(1).max(64),
    date: isoDate,
    start: optionalTime,
    end: optionalTime,
    text: z.string().trim().min(1).max(200),
    cat: z.enum(CATEGORIES),
    done: z.boolean(),
    createdAt: z.number().int().nonnegative(),
    remind: z.number().int().min(-1).max(24 * 60).optional(),
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

export const SettingsSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']),
  eventReminders: z.boolean(),
  eventLeadMinutes: z.number().int().min(0).max(120),
  habitReminders: z.boolean(),
  slotTimes: z.object({ manana: time, mediodia: time, tarde: time, noche: time }),
  launchAtLogin: z.boolean(),
  closeToTray: z.boolean(),
  sidebar: z.boolean(),
})

export const AppDataSchema = z.object({
  schema: z.literal(1),
  events: z.array(CalendarEventSchema),
  habits: z.array(HabitSchema),
  habitLog: HabitLogSchema,
  notes: NotesSchema,
  settings: SettingsSchema,
})

export type Category = (typeof CATEGORIES)[number]
export type Ink = (typeof INKS)[number]
export type Slot = (typeof SLOTS)[number]
export type HabitKind = (typeof HABIT_KINDS)[number]
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
  settings: structuredClone(DEFAULT_SETTINGS),
})
