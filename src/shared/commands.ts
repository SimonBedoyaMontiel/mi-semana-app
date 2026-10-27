import { z } from 'zod'
import { CalendarEventSchema, HabitSchema, ISO_DATE, SettingsSchema } from './model'

const id = z.string().min(1).max(64)
const date = z.string().regex(ISO_DATE)
/** Client time of the change (ms). Drives last-writer-wins sync; absent only in tests. */
const at = z.number().int().nonnegative().optional()

/**
 * Every mutation is a command. The renderer applies it optimistically, the main process
 * validates it again and applies the very same reducer to the copy it persists.
 */
export const CommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('event.upsert'), event: CalendarEventSchema, at }),
  z.object({ type: z.literal('event.delete'), id, at }),
  z.object({ type: z.literal('event.setDone'), id, done: z.boolean(), at }),
  /** One date of a recurring series: mark done / not done, or remove it from the series. */
  z.object({ type: z.literal('event.occurrence'), id, date, op: z.enum(['done', 'undone', 'skip']), at }),
  z.object({ type: z.literal('habit.upsert'), habit: HabitSchema, index: z.number().int().min(0).optional(), at }),
  z.object({ type: z.literal('habit.delete'), id, at }),
  z.object({ type: z.literal('habitLog.set'), date, habitId: id, count: z.number().int().min(0).max(99), at }),
  z.object({ type: z.literal('note.set'), date, text: z.string().max(4000), at }),
  z.object({ type: z.literal('settings.set'), settings: SettingsSchema, at }),
])

export type Command = z.infer<typeof CommandSchema>
