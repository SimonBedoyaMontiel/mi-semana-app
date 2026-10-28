import { create } from 'zustand'
import type { Command } from '@shared/commands'
import { applyCommand } from '@shared/reducer'
import type { Account, AppData, CalendarEvent, Category, Goal, Habit, Subscription, Transaction } from '@shared/model'
import type { EventItem } from '@shared/events'
import type { SyncStatus } from '@shared/sync'
import type { UpdateStatus } from '@shared/ipc'
import { addDays, addMonths, fromIso, toIso, todayIso } from '@shared/dates'

/** `today` is the phone layout's home; on desktop the same content lives in the side panel. */
export type View = 'today' | 'month' | 'week' | 'day' | 'habits' | 'journal' | 'stats' | 'money'

export interface EventPreset {
  date: string
  start?: string
  end?: string
  text?: string
  /** Planning an inbox item: it leaves the inbox once saved. */
  inboxId?: string
  /** Fields of a duplicated event. */
  copy?: Partial<CalendarEvent>
}

export type SettingsTab = 'general' | 'design' | 'alerts' | 'data'

export type Sheet =
  | { kind: 'event'; event?: EventItem; preset?: EventPreset }
  | { kind: 'habit'; habit?: Habit }
  | { kind: 'settings'; tab?: SettingsTab }
  | { kind: 'account' }
  | { kind: 'tx'; tx?: Transaction; preset?: Partial<Transaction> }
  | { kind: 'sub'; sub?: Subscription }
  | { kind: 'wallet'; wallet?: Account }
  | { kind: 'goal'; goal?: Goal }
  | null

export interface Toast {
  id: number
  text: string
  action?: { label: string; run: () => void }
  /** Stays until acted on or replaced. */
  sticky?: boolean
}

interface State {
  data: AppData | null
  error: string | null
  view: View
  prevView: Exclude<View, 'day'>
  date: string
  dir: -1 | 0 | 1
  sheet: Sheet
  toast: Toast | null
  lastCat: Category
  /** Date whose month cell carries the shared-element id for the month ⇄ day morph. */
  morph: string | null
  sync: SyncStatus | null
  update: UpdateStatus

  init(): Promise<void>
  dispatch(cmd: Command): void
  replaceData(data: AppData): void
  receiveExternal(data: AppData): void
  setView(v: View): void
  shift(n: -1 | 1): void
  goToday(): void
  openDay(date: string): void
  back(): void
  openSheet(s: Exclude<Sheet, null>): void
  closeSheet(): void
  notify(text: string, undo?: () => void): void
  toastWith(t: Omit<Toast, 'id'>): void
  setLastCat(c: Category): void
}

let queue: Promise<unknown> = Promise.resolve()
/** Commands applied locally but not yet confirmed by the store of record. */
let inFlight: Command[] = []
let toastSeq = 0

const stamped = (cmd: Command): Command => (cmd.at !== undefined ? cmd : { ...cmd, at: Date.now() })

export const useStore = create<State>()((set, get) => ({
  data: null,
  error: null,
  view: 'month',
  prevView: 'month',
  date: todayIso(),
  dir: 0,
  sheet: null,
  toast: null,
  lastCat: 'otro',
  morph: null,
  sync: null,
  update: { phase: 'idle' },

  async init() {
    try {
      set({ data: await window.api.load() })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
    }
  },

  /** Optimistic: the UI updates now; writes reach the store of record in order. */
  dispatch(raw) {
    const data = get().data
    if (!data) return
    const cmd = stamped(raw)
    set({ data: applyCommand(data, cmd) })
    inFlight.push(cmd)
    queue = queue
      .then(() => window.api.dispatch(cmd))
      .then(
        () => {
          inFlight = inFlight.filter(c => c !== cmd)
        },
        async (err: unknown) => {
          console.error(err)
          inFlight = inFlight.filter(c => c !== cmd)
          get().replaceData(await window.api.load())
          get().notify('No se pudo guardar el último cambio. Se restauró lo guardado.')
        },
      )
  },

  replaceData(data) {
    set({ data })
  },

  /** Data merged from another device: keep any local change that is still on its way. */
  receiveExternal(data) {
    set({ data: inFlight.reduce(applyCommand, data) })
  },

  setView(v) {
    const { view } = get()
    if (v === view) return
    set({ view: v, dir: 0, prevView: view === 'day' ? get().prevView : view })
  },

  shift(n) {
    const { view, date } = get()
    const d = fromIso(date)
    const next = view === 'month' || view === 'money' ? addMonths(d, n) : view === 'journal' ? addMonths(d, 12 * n) : view === 'day' || view === 'today' ? addDays(d, n) : addDays(d, 7 * n)
    set({ date: toIso(next), dir: n, ...(view === 'today' ? { view: 'day' as const, prevView: 'today' as const } : {}) })
  },

  goToday() {
    const today = todayIso()
    const { date } = get()
    if (today !== date) set({ date: today, dir: today > date ? 1 : -1 })
  },

  openDay(date) {
    const { view } = get()
    set({ date, view: 'day', dir: 0, prevView: view === 'day' ? get().prevView : view })
  },

  back() {
    const { view, date, prevView } = get()
    if (view !== 'day') return
    set({ morph: prevView === 'month' ? date : null })
    requestAnimationFrame(() => set({ view: prevView, dir: 0 }))
    window.setTimeout(() => set({ morph: null }), 700)
  },

  openSheet(s) {
    set({ sheet: s })
  },
  closeSheet() {
    set({ sheet: null })
  },

  notify(text, undo) {
    set({ toast: { id: ++toastSeq, text, action: undo ? { label: 'Deshacer', run: undo } : undefined } })
  },
  toastWith(t) {
    set({ toast: { id: ++toastSeq, ...t } })
  },

  setLastCat(c) {
    set({ lastCat: c })
  },
}))

export const rawEvent = (id: string): CalendarEvent | undefined => useStore.getState().data?.events.find(e => e.id === id)
