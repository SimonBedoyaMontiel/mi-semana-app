import { create } from 'zustand'
import type { Command } from '@shared/commands'
import { applyCommand } from '@shared/reducer'
import type { AppData, CalendarEvent, Category, Habit } from '@shared/model'
import { addDays, addMonths, fromIso, toIso, todayIso } from '@shared/dates'

export type View = 'month' | 'week' | 'day' | 'habits'

export interface EventPreset {
  date: string
  start?: string
  end?: string
  text?: string
}

export type Sheet =
  | { kind: 'event'; event?: CalendarEvent; preset?: EventPreset }
  | { kind: 'habit'; habit?: Habit }
  | { kind: 'settings' }
  | null

export interface Toast {
  id: number
  text: string
  undo?: () => void
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

  init(): Promise<void>
  dispatch(cmd: Command): void
  replaceData(data: AppData): void
  setView(v: View): void
  shift(n: -1 | 1): void
  goToday(): void
  openDay(date: string): void
  back(): void
  openSheet(s: Exclude<Sheet, null>): void
  closeSheet(): void
  notify(text: string, undo?: () => void): void
  setLastCat(c: Category): void
}

let queue: Promise<unknown> = Promise.resolve()
let toastSeq = 0

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

  async init() {
    try {
      set({ data: await window.api.load() })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
    }
  },

  /** Optimistic: the UI updates now; writes reach the main process in order. */
  dispatch(cmd) {
    const data = get().data
    if (!data) return
    set({ data: applyCommand(data, cmd) })
    queue = queue
      .then(() => window.api.dispatch(cmd))
      .catch(async (err: unknown) => {
        console.error(err)
        get().replaceData(await window.api.load())
        get().notify('No se pudo guardar el último cambio. Se restauró lo guardado.')
      })
  },

  replaceData(data) {
    set({ data })
  },

  setView(v) {
    const { view } = get()
    if (v === view) return
    set({ view: v, dir: 0, prevView: view === 'day' ? get().prevView : view })
  },

  shift(n) {
    const { view, date } = get()
    const d = fromIso(date)
    const next = view === 'month' ? addMonths(d, n) : view === 'day' ? addDays(d, n) : addDays(d, 7 * n)
    set({ date: toIso(next), dir: n })
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
    set({ toast: { id: ++toastSeq, text, undo } })
  },

  setLastCat(c) {
    set({ lastCat: c })
  },
}))
