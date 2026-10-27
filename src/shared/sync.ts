/**
 * Record-level, last-writer-wins sync.
 *
 * The local document is split into small records — one per event (`e:`), habit (`h:`), day of
 * habit log (`l:`) and day note (`n:`), plus the look that follows the account (`s:prefs`). Every change stamps its record (see reducer.ts); deletions
 * leave a tombstone. The server keeps one row per record and only accepts a write that is newer
 * than what it has, so devices converge whatever order they sync in.
 */
import type { AppData } from './model'
import {
  AccountSchema, BudgetsSchema, CalendarEventSchema, FocusSessionSchema, GoalSchema, HabitSchema, SubscriptionSchema, TransactionSchema, ISO_DATE, InboxItemSchema, JournalSchema, PrefsSchema, ReviewSchema, TopSchema,
} from './model'
import { BUDGETS_KEY, PREFS_KEY } from './reducer'
import { z } from 'zod'

export interface RecordRow {
  key: string
  value: unknown
  deleted: boolean
  updated_at: number
  /** Server time of the last accepted write; used as the pull cursor. */
  modified_at?: string
}

export interface SyncState {
  /** Account the local data belongs to; another account signing in starts from a clean slate. */
  userId?: string | null
  /** Highest server `modified_at` already pulled. */
  cursor: string | null
  /** Stamp last confirmed on the server for each key, so nothing is pushed twice. */
  pushed: Record<string, number>
  /** Record kinds this copy understood when it last pulled; see SYNC_KINDS. */
  kinds?: number
}

/**
 * Bumped whenever a new kind of record is added. An older version skips rows it does not know
 * yet, so after an update the next pull starts again from the beginning to pick them up.
 */
export const SYNC_KINDS = 4

export const emptySyncState = (): SyncState => ({ userId: null, cursor: null, pushed: {}, kinds: SYNC_KINDS })

/**
 * Decides what happens to local data when `userId` signs in. Data synced with another account
 * already lives in that account's cloud copy, so it is cleared here instead of leaking into the new
 * one. Data never synced before is adopted (uploaded) by whoever signs in first.
 */
export function adoptAccount(state: SyncState, userId: string): { state: SyncState; clearLocal: boolean } {
  if (state.userId && state.userId !== userId) return { state: { ...emptySyncState(), userId }, clearLocal: true }
  return { state: { ...state, userId }, clearLocal: false }
}

const DayLog = z.record(z.string(), z.number().int().min(1).max(99))
const Note = z.string().max(4000)

/** Date-keyed records that live in a map of AppData; an empty or null value removes the day. */
const DAY_MAPS = {
  j: { field: 'journal', schema: JournalSchema },
  p: { field: 'priorities', schema: TopSchema.array().max(3) },
  f: { field: 'focus', schema: FocusSessionSchema.array().max(50) },
  r: { field: 'reviews', schema: ReviewSchema },
} as const
type DayKind = keyof typeof DAY_MAPS
const isDayKind = (k: string | undefined): k is DayKind => !!k && k in DAY_MAPS

/** Lists of records with an id; deleting one leaves a tombstone. */
const ID_LISTS = {
  t: { field: 'transactions', schema: TransactionSchema },
  u: { field: 'subscriptions', schema: SubscriptionSchema },
  a: { field: 'accounts', schema: AccountSchema },
  g: { field: 'goals', schema: GoalSchema },
} as const
type ListKind = keyof typeof ID_LISTS
const isListKind = (k: string | undefined): k is ListKind => !!k && k in ID_LISTS

export function valueOf(data: AppData, key: string): unknown {
  const id = key.slice(2)
  switch (key[0]) {
    case 'e':
      return data.events.find(e => e.id === id)
    case 'h':
      return data.habits.find(h => h.id === id)
    case 'l':
      return data.habitLog[id] ?? {}
    case 'n':
      return data.notes[id] ?? ''
    case 's':
      return key === PREFS_KEY ? { look: data.settings.look, holidays: data.settings.holidays, currency: data.settings.currency } : undefined
    case 'b':
      return key === BUDGETS_KEY ? data.budgets : undefined
    case 'i':
      return data.inbox.find(i => i.id === id)
    default:
      if (isListKind(key[0])) return (data[ID_LISTS[key[0]].field] as ReadonlyArray<{ id: string }>).find(x => x.id === id)
      return isDayKind(key[0]) ? (data[DAY_MAPS[key[0]].field][id] ?? null) : undefined
  }
}

/** Local changes the server hasn't confirmed yet. */
export function pendingRows(data: AppData, state: SyncState): RecordRow[] {
  const rows: RecordRow[] = []
  for (const [key, t] of Object.entries(data.stamps)) {
    if (state.pushed[key] === t) continue
    const value = valueOf(data, key)
    if (value === undefined) continue
    rows.push({ key, value, deleted: false, updated_at: t })
  }
  for (const [key, t] of Object.entries(data.tombs)) {
    if (state.pushed[key] === t) continue
    rows.push({ key, value: null, deleted: true, updated_at: t })
  }
  return rows
}

/** Applies server rows that are newer than the local copy. Invalid rows are ignored. */
export function applyRemote(data: AppData, rows: readonly RecordRow[]): { data: AppData; changed: boolean } {
  let events = data.events
  let habits = data.habits
  let habitLog = data.habitLog
  let notes = data.notes
  let settings = data.settings
  let inbox = data.inbox
  const maps: Pick<AppData, (typeof DAY_MAPS)[DayKind]['field']> = {
    journal: data.journal, priorities: data.priorities, focus: data.focus, reviews: data.reviews,
  }
  let budgets = data.budgets
  const lists: Pick<AppData, (typeof ID_LISTS)[ListKind]['field']> = {
    transactions: data.transactions, subscriptions: data.subscriptions, accounts: data.accounts, goals: data.goals,
  }
  const stamps = { ...data.stamps }
  const tombs = { ...data.tombs }
  let changed = false

  for (const row of rows) {
    const local = Math.max(stamps[row.key] ?? 0, tombs[row.key] ?? 0)
    if (row.updated_at <= local) continue
    const kind = row.key[0]
    const id = row.key.slice(2)
    if (!id) continue

    if (row.deleted) {
      if (kind === 's' || kind === 'b') continue
      if (isListKind(kind)) {
        const field = ID_LISTS[kind].field
        Object.assign(lists, { [field]: (lists[field] as ReadonlyArray<{ id: string }>).filter(x => x.id !== id) })
      } else if (kind === 'i') inbox = inbox.filter(i => i.id !== id)
      else if (isDayKind(kind)) {
        const field = DAY_MAPS[kind].field
        const next: Record<string, unknown> = { ...maps[field] }
        delete next[id]
        Object.assign(maps, { [field]: next })
      } else if (kind === 'e') events = events.filter(e => e.id !== id)
      else if (kind === 'h') habits = habits.filter(h => h.id !== id)
      else if (kind === 'l') {
        habitLog = { ...habitLog }
        delete habitLog[id]
      } else if (kind === 'n') {
        notes = { ...notes }
        delete notes[id]
      }
      else continue
      delete stamps[row.key]
      tombs[row.key] = row.updated_at
      changed = true
      continue
    }

    if (kind === 'e') {
      const p = CalendarEventSchema.safeParse(row.value)
      if (!p.success || p.data.id !== id) continue
      const i = events.findIndex(e => e.id === id)
      events = i >= 0 ? events.map((e, j) => (j === i ? p.data : e)) : [...events, p.data]
    } else if (kind === 'h') {
      const p = HabitSchema.safeParse(row.value)
      if (!p.success || p.data.id !== id) continue
      const i = habits.findIndex(h => h.id === id)
      habits = i >= 0 ? habits.map((h, j) => (j === i ? p.data : h)) : [...habits, p.data]
    } else if (kind === 'l') {
      const p = DayLog.safeParse(row.value)
      if (!p.success || !ISO_DATE.test(id)) continue
      habitLog = { ...habitLog }
      if (Object.keys(p.data).length) habitLog[id] = p.data
      else delete habitLog[id]
    } else if (kind === 'n') {
      const p = Note.safeParse(row.value)
      if (!p.success || !ISO_DATE.test(id)) continue
      notes = { ...notes }
      if (p.data.trim()) notes[id] = p.data
      else delete notes[id]
    } else if (isListKind(kind)) {
      const { field, schema } = ID_LISTS[kind]
      const p = schema.safeParse(row.value)
      if (!p.success || p.data.id !== id) continue
      const list = lists[field] as ReadonlyArray<{ id: string }>
      const i = list.findIndex(x => x.id === id)
      Object.assign(lists, { [field]: i >= 0 ? list.map((x, j) => (j === i ? p.data : x)) : [...list, p.data] })
    } else if (row.key === BUDGETS_KEY) {
      const p = BudgetsSchema.safeParse(row.value)
      if (!p.success) continue
      budgets = p.data
    } else if (kind === 'i') {
      const p = InboxItemSchema.safeParse(row.value)
      if (!p.success || p.data.id !== id) continue
      const i = inbox.findIndex(x => x.id === id)
      inbox = i >= 0 ? inbox.map((x, j) => (j === i ? p.data : x)) : [...inbox, p.data]
    } else if (isDayKind(kind)) {
      if (!ISO_DATE.test(id)) continue
      const { field, schema } = DAY_MAPS[kind]
      const next: Record<string, unknown> = { ...maps[field] }
      const empty = row.value === null || (Array.isArray(row.value) && row.value.length === 0)
      if (empty) delete next[id]
      else {
        const p = schema.safeParse(row.value)
        if (!p.success) continue
        next[id] = p.data
      }
      Object.assign(maps, { [field]: next })
    } else if (row.key === PREFS_KEY) {
      const p = PrefsSchema.safeParse(row.value)
      if (!p.success) continue
      const { currency, ...rest } = p.data
      settings = { ...settings, ...rest, ...(currency ? { currency } : {}) }
    } else continue

    delete tombs[row.key]
    stamps[row.key] = row.updated_at
    changed = true
  }

  return changed ? { data: { ...data, events, habits, habitLog, notes, ...maps, ...lists, budgets, inbox, settings, stamps, tombs }, changed } : { data, changed }
}

/** Stamps every record that has none (data created before sync existed), so it gets uploaded. */
export function ensureStamps(data: AppData, at = 1): AppData {
  const stamps = { ...data.stamps }
  let added = false
  const need = (key: string): void => {
    if (stamps[key] === undefined && data.tombs[key] === undefined) {
      stamps[key] = at
      added = true
    }
  }
  for (const e of data.events) need(`e:${e.id}`)
  for (const h of data.habits) need(`h:${h.id}`)
  for (const d of Object.keys(data.habitLog)) need(`l:${d}`)
  for (const d of Object.keys(data.notes)) need(`n:${d}`)
  for (const i of data.inbox) need(`i:${i.id}`)
  for (const kind of Object.keys(ID_LISTS) as ListKind[]) {
    for (const x of data[ID_LISTS[kind].field] as ReadonlyArray<{ id: string }>) need(`${kind}:${x.id}`)
  }
  if (Object.keys(data.budgets).length) need(BUDGETS_KEY)
  for (const kind of Object.keys(DAY_MAPS) as DayKind[]) {
    for (const d of Object.keys(data[DAY_MAPS[kind].field])) need(`${kind}:${d}`)
  }
  return added ? { ...data, stamps } : data
}

export type SyncPhase = 'off' | 'signed-out' | 'idle' | 'syncing' | 'error'

export interface SyncStatus {
  configured: boolean
  phase: SyncPhase
  email: string | null
  lastSync: number | null
  error: string | null
  /** Opened from a password-reset e-mail: the UI should ask for a new password. */
  recovery?: boolean
  /** Desktop Google sign-in: waiting for the browser to hand the session back. */
  waitingForBrowser?: boolean
}

export interface SyncTransport {
  pull(cursor: string | null): Promise<RecordRow[]>
  push(rows: RecordRow[]): Promise<void>
}

export interface SyncHost {
  get(): AppData
  replace(data: AppData): void
  loadState(): SyncState
  saveState(state: SyncState): void
}

const PUSH_CHUNK = 400

/**
 * One sync pass: pull newer rows, merge, then push what the server hasn't confirmed.
 * Runs are serialized; a request during a run schedules exactly one more.
 */
export class SyncEngine {
  private running: Promise<void> | null = null
  private again = false

  constructor(private readonly transport: SyncTransport, private readonly host: SyncHost) {}

  run(): Promise<void> {
    if (this.running) {
      this.again = true
      return this.running
    }
    this.running = (async () => {
      try {
        do {
          this.again = false
          await this.pass()
        } while (this.again)
      } finally {
        this.running = null
      }
    })()
    return this.running
  }

  private async pass(): Promise<void> {
    const state = this.host.loadState()
    const pushed = { ...state.pushed }

    // Kinds added since the last pull were skipped by the older version: pull everything once more.
    const fresh = (state.kinds ?? 0) < SYNC_KINDS
    const rows = await this.transport.pull(fresh ? null : state.cursor)
    let cursor = fresh ? null : state.cursor
    if (rows.length) {
      const res = applyRemote(this.host.get(), rows)
      if (res.changed) this.host.replace(res.data)
      for (const r of rows) {
        // What the server holds is by definition already there: never echo it back.
        pushed[r.key] = r.updated_at
        if (r.modified_at && (!cursor || r.modified_at > cursor)) cursor = r.modified_at
      }
    }

    const pending = pendingRows(this.host.get(), { cursor, pushed })
    for (let i = 0; i < pending.length; i += PUSH_CHUNK) {
      const chunk = pending.slice(i, i + PUSH_CHUNK)
      await this.transport.push(chunk)
      for (const r of chunk) pushed[r.key] = r.updated_at
    }
    this.host.saveState({ ...state, cursor, pushed, kinds: SYNC_KINDS })
  }
}
