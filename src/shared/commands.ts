import { z } from 'zod'
import { CalendarEventSchema, HabitSchema, ISO_DATE, SettingsSchema } from './model'

const id = z.string().min(1).max(64)
const date = z.string().regex(ISO_DATE)

/**
 * Every mutation is a command. The renderer applies it optimistically, the main process
 * validates it again and applies the very same reducer to the copy it persists.
 */
export const CommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('event.upsert'), event: CalendarEventSchema }),
  z.object({ type: z.literal('event.delete'), id }),
  z.object({ type: z.literal('event.setDone'), id, done: z.boolean() }),
  z.object({ type: z.literal('habit.upsert'), habit: HabitSchema, index: z.number().int().min(0).optional() }),
  z.object({ type: z.literal('habit.delete'), id }),
  z.object({ type: z.literal('habitLog.set'), date, habitId: id, count: z.number().int().min(0).max(99) }),
  z.object({ type: z.literal('note.set'), date, text: z.string().max(4000) }),
  z.object({ type: z.literal('settings.set'), settings: SettingsSchema }),
])

export type Command = z.infer<typeof CommandSchema>
