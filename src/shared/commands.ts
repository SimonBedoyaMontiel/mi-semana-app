import { z } from 'zod'
import {
  AccountSchema, BudgetsSchema, TemplateSchema, CalendarEventSchema, FocusSessionSchema, GoalSchema, SubscriptionSchema, TransactionSchema, HabitSchema, ISO_DATE, InboxItemSchema, JournalSchema, ReviewSchema, SettingsSchema, TopSchema,
} from './model'

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
  /** `entry: null` clears the day's journal. */
  z.object({ type: z.literal('journal.set'), date, entry: JournalSchema.nullable(), at }),
  z.object({ type: z.literal('priorities.set'), date, items: z.array(TopSchema).max(3), at }),
  z.object({ type: z.literal('inbox.upsert'), item: InboxItemSchema, at }),
  z.object({ type: z.literal('inbox.delete'), id, at }),
  z.object({ type: z.literal('focus.add'), date, session: FocusSessionSchema, at }),
  /** `review: null` clears the week's review. */
  z.object({ type: z.literal('review.set'), week: date, review: ReviewSchema.nullable(), at }),
  z.object({ type: z.literal('tx.upsert'), item: TransactionSchema, at }),
  z.object({ type: z.literal('tx.delete'), id, at }),
  z.object({ type: z.literal('sub.upsert'), item: SubscriptionSchema, at }),
  z.object({ type: z.literal('sub.delete'), id, at }),
  z.object({ type: z.literal('account.upsert'), item: AccountSchema, at }),
  z.object({ type: z.literal('account.delete'), id, at }),
  z.object({ type: z.literal('goal.upsert'), item: GoalSchema, at }),
  z.object({ type: z.literal('goal.delete'), id, at }),
  z.object({ type: z.literal('template.upsert'), item: TemplateSchema, at }),
  z.object({ type: z.literal('template.delete'), id, at }),
  z.object({ type: z.literal('budgets.set'), budgets: BudgetsSchema, at }),
])

export type Command = z.infer<typeof CommandSchema>
