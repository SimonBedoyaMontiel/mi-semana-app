import type { CalendarEvent, Category } from './model'
import { CATEGORIES } from './constants'
import { addDays, fromIso, fromMin, pad, toIso, toMin, weekday } from './dates'

/**
 * What views render: a one-off event, or one dated occurrence of a recurring series.
 * Occurrences get `id = <seriesId>@<date>` so keys stay unique across a week.
 */
export type EventItem = CalendarEvent & { seriesId?: string; occurrence?: string }

const dayNumber = (iso: string): number => {
  const [y = 1970, m = 1, d = 1] = iso.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / 864e5)
}

/** Whether a recurring event happens on `date` (exceptions excluded). */
export function occursOn(e: CalendarEvent, date: string): boolean {
  const r = e.repeat
  if (!r) return e.date === date
  if (date < e.date || (r.until && date > r.until) || e.exceptions?.includes(date)) return false
  const diff = dayNumber(date) - dayNumber(e.date)
  switch (r.freq) {
    case 'daily':
      return diff % r.interval === 0
    case 'weekly': {
      const startMonday = dayNumber(e.date) - weekday(fromIso(e.date))
      const week = Math.floor((dayNumber(date) - startMonday) / 7)
      const days = r.days ?? [weekday(fromIso(e.date))]
      return week % r.interval === 0 && days.includes(weekday(fromIso(date)))
    }
    case 'monthly': {
      const a = fromIso(e.date)
      const b = fromIso(date)
      const months = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth()
      return months % r.interval === 0 && b.getDate() === a.getDate()
    }
  }
}

/** Every event and occurrence dated within [from, to] (inclusive ISO dates). */
export function expandRange(events: readonly CalendarEvent[], from: string, to: string): EventItem[] {
  const out: EventItem[] = []
  for (const e of events) {
    if (!e.repeat) {
      if (e.date >= from && e.date <= to) out.push(e)
      continue
    }
    const last = e.repeat.until && e.repeat.until < to ? e.repeat.until : to
    for (let d = fromIso(e.date > from ? e.date : from); toIso(d) <= last; d = addDays(d, 1)) {
      const date = toIso(d)
      if (!occursOn(e, date)) continue
      out.push({ ...e, id: `${e.id}@${date}`, date, done: !!e.doneDates?.includes(date), seriesId: e.id, occurrence: date })
    }
  }
  return out
}

const RANK = { alta: 0, media: 1, baja: 2 } as const
const rank = (e: CalendarEvent): number => (e.priority ? RANK[e.priority] : 1.5)

/** Timed events first, by start; untimed after. Ties go to the higher priority, then the older. */
export function byTime(a: CalendarEvent, b: CalendarEvent): number {
  return (
    (a.start ? 0 : 1) - (b.start ? 0 : 1) ||
    a.start.localeCompare(b.start) ||
    rank(a) - rank(b) ||
    a.createdAt - b.createdAt
  )
}

/** CSS colour of an event: its own colour if chosen, else its category's. */
export const evColor = (e: Pick<CalendarEvent, 'cat' | 'color'>): string => (e.color ? `var(--${e.color})` : `var(--cat-${e.cat})`)

export type EventIndex = ReadonlyMap<string, readonly EventItem[]>

/** O(n) grouping by date; each bucket sorted once. */
export function indexByDate(events: readonly EventItem[]): EventIndex {
  const map = new Map<string, EventItem[]>()
  for (const e of events) {
    const bucket = map.get(e.date)
    if (bucket) bucket.push(e)
    else map.set(e.date, [e])
  }
  for (const bucket of map.values()) bucket.sort(byTime)
  return map
}

export const durationOf = (e: CalendarEvent): number => (e.start && e.end ? Math.max(0, toMin(e.end) - toMin(e.start)) : 0)

export interface PlacedEvent {
  event: EventItem
  startMin: number
  endMin: number
  col: number
  cols: number
}

/**
 * Side-by-side placement for overlapping timed events. Events are grouped into clusters of
 * transitively overlapping items; each item takes the first free column within its cluster.
 */
export function layoutDay(events: readonly EventItem[], minHeightMin = 20): PlacedEvent[] {
  const items = events
    .filter(e => e.start)
    .map(e => {
      const s = toMin(e.start)
      const en = e.end ? toMin(e.end) : s + 60
      return { event: e, startMin: s, endMin: Math.max(en, s + minHeightMin), col: 0, cols: 1 }
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin)

  const out: PlacedEvent[] = []
  let cluster: PlacedEvent[] = []
  let colEnds: number[] = []
  let clusterEnd = -1

  const close = (): void => {
    const n = colEnds.length
    for (const c of cluster) c.cols = n
    cluster = []
    colEnds = []
  }

  for (const it of items) {
    if (cluster.length && it.startMin >= clusterEnd) close()
    let col = colEnds.findIndex(end => end <= it.startMin)
    if (col < 0) {
      col = colEnds.length
      colEnds.push(it.endMin)
    } else colEnds[col] = it.endMin
    it.col = col
    cluster.push(it)
    out.push(it)
    clusterEnd = Math.max(clusterEnd, it.endMin)
  }
  if (cluster.length) close()
  return out
}

/** Visible hour window: 7–23 by default, widened to fit any event. */
export function hourWindow(events: readonly CalendarEvent[]): [number, number] {
  let h0 = 7
  let h1 = 23
  for (const e of events) {
    if (!e.start) continue
    h0 = Math.min(h0, Math.floor(toMin(e.start) / 60))
    h1 = Math.max(h1, Math.ceil((e.end ? toMin(e.end) : toMin(e.start) + 60) / 60))
  }
  return [h0, Math.min(24, h1)]
}

export interface QuickParse {
  text: string
  start: string
  end: string
  cat: Category | null
}

function clock(h: string, m: string | undefined, suffix: string | undefined): string | null {
  let hours = Number(h)
  const mins = Number(m ?? 0)
  const s = (suffix ?? '').toLowerCase()
  if (s === 'pm' && hours < 12) hours += 12
  if (s === 'am' && hours === 12) hours = 0
  return hours < 24 && mins < 60 ? `${pad(hours)}:${pad(mins)}` : null
}

const T = String.raw`(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|h)?`
const RANGE = new RegExp(String.raw`^${T}\s*(?:-|–|a)\s*${T}\s+(.+)$`, 'i')
const SINGLE_COLON = /^(\d{1,2})[:.](\d{2})\s*(am|pm|h)?\s+(.+)$/i
const SINGLE_SUFFIX = /^(\d{1,2})\s*(am|pm|h)\s+(.+)$/i
const TAG = /(^|\s)#([\p{L}]+)/gu

const fold = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * Natural quick-add: "9-10:30 Gimnasio #salud", "18:00 Cena", "8am Correr", "Llamar al banco".
 * A bare leading number ("3 manzanas") is never read as a time.
 */
export function parseQuick(raw: string): QuickParse {
  let text = raw.trim()
  let start = ''
  let end = ''
  let cat: Category | null = null

  const r = RANGE.exec(text)
  if (r) {
    const a = clock(r[1]!, r[2], r[3] ?? r[6])
    const b = clock(r[4]!, r[5], r[6])
    if (a && b) {
      start = a
      end = b
      text = r[7]!
    }
  } else {
    const s1 = SINGLE_COLON.exec(text)
    const s2 = s1 ? null : SINGLE_SUFFIX.exec(text)
    const a = s1 ? clock(s1[1]!, s1[2], s1[3]) : s2 ? clock(s2[1]!, undefined, s2[2]) : null
    if (a) {
      start = a
      end = fromMin(toMin(a) + 60)
      text = (s1 ? s1[4] : s2![3])!
    }
  }

  text = text
    .replace(TAG, (all, _sp: string, tag: string) => {
      const t = fold(tag)
      const hit = CATEGORIES.find(c => c === t || c.startsWith(t))
      if (hit && !cat) {
        cat = hit
        return ''
      }
      return all
    })
    .replace(/\s{2,}/g, ' ')
    .trim()

  if (start && end <= start) end = fromMin(Math.min(toMin(start) + 60, 23 * 60 + 59))
  return { text, start, end, cat }
}
