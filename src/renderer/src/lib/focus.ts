/**
 * Focus timer. Lives outside React so it keeps counting while views change; the running block is
 * kept in localStorage, so a reload or a restart picks it up where it was.
 */
import { create } from 'zustand'
import { todayIso } from '@shared/dates'
import { burst, newId } from './fx'
import { useStore } from '@/state/store'

const KEY = 'mi-semana:focus'

export interface FocusBlock {
  id: string
  label: string
  eventId?: string
  minutes: number
  startedAt: number
  /** When it will end while running; absent while paused. */
  endsAt?: number
  /** Time left when paused (ms). */
  leftMs?: number
}

interface FocusState {
  block: FocusBlock | null
  start(minutes: number, label: string, eventId?: string): void
  pause(): void
  resume(): void
  stop(): void
}

function load(): FocusBlock | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null') as FocusBlock | null
  } catch {
    return null
  }
}

function save(block: FocusBlock | null): void {
  try {
    if (block) localStorage.setItem(KEY, JSON.stringify(block))
    else localStorage.removeItem(KEY)
  } catch { /* storage blocked */ }
}

export const useFocus = create<FocusState>()((set, get) => ({
  block: load(),
  start(minutes, label, eventId) {
    const now = Date.now()
    const block: FocusBlock = { id: newId(), label: label.trim() || 'Enfoque', eventId, minutes, startedAt: now, endsAt: now + minutes * 60_000 }
    save(block)
    set({ block })
  },
  pause() {
    const b = get().block
    if (!b?.endsAt) return
    const block = { ...b, endsAt: undefined, leftMs: Math.max(0, b.endsAt - Date.now()) }
    save(block)
    set({ block })
  },
  resume() {
    const b = get().block
    if (!b || b.endsAt || b.leftMs === undefined) return
    const block = { ...b, endsAt: Date.now() + b.leftMs, leftMs: undefined }
    save(block)
    set({ block })
  },
  stop() {
    save(null)
    set({ block: null })
    window.api.focusProgress(null)
  },
}))

/** Milliseconds left in a block right now. */
export const leftOf = (b: FocusBlock, now = Date.now()): number => (b.endsAt ? Math.max(0, b.endsAt - now) : (b.leftMs ?? 0))

export const fmtClock = (ms: number): string => {
  const s = Math.ceil(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** A block reached zero: log it, celebrate, and clear the timer. */
export function finishFocus(from?: Element | null): void {
  const b = useFocus.getState().block
  if (!b) return
  const st = useStore.getState()
  st.dispatch({
    type: 'focus.add',
    date: todayIso(new Date(b.startedAt)),
    session: { id: b.id, start: b.startedAt, minutes: b.minutes, label: b.label, ...(b.eventId ? { eventId: b.eventId } : {}) },
  })
  burst(from ?? document.querySelector('.focus-ring'), 'var(--accent)')
  st.notify(`Bloque de ${b.minutes} min terminado: ${b.label}. Buen trabajo.`)
  window.api.focusProgress(1, { done: true })
  save(null)
  useFocus.setState({ block: null })
  window.setTimeout(() => window.api.focusProgress(null), 4000)
}
