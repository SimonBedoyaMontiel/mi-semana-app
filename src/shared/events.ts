import type { CalendarEvent, Category, Repeat } from './model'
import { CATEGORIES } from './constants'
import { addDays, fromIso, fromMin, pad, toIso, toMin, todayIso, weekday } from './dates'

/**
 * What views render: a one-off event, one dated occurrence of a recurring series, or one day of a
 * several-day event. Occurrences get `id = <seriesId>@<date>` and the days of a long event
 * `<id>~<date>`, so keys stay unique across a week; `spanOf` points back to the stored event.
 */
export type EventItem = CalendarEvent & {
  seriesId?: string
  occurrence?: string
  spanOf?: string
  /** Several-day events: whether this is its first or last day. */
  spanFirst?: boolean
  spanLast?: boolean
}

const dayNumber = (iso: string): number => {
  const [y = 1970, m = 1, d = 1] = iso.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / 864e5)
}

const daysInMonth = (d: Date): number => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()

/** Which weekday of its month a date is: 1–5, and whether it is the last one. */
export function weekdayPos(date: string): { nth: number; last: boolean } {
  const d = fromIso(date)
  return { nth: Math.ceil(d.getDate() / 7), last: d.getDate() + 7 > daysInMonth(d) }
}

/** Whether the rule matches `date`, before exceptions and the end of the series. */
function matches(e: CalendarEvent, date: string): boolean {
  const r = e.repeat!
  const diff = dayNumber(date) - dayNumber(e.date)
  const a = fromIso(e.date)
  const b = fromIso(date)
  switch (r.freq) {
    case 'daily':
      return diff % r.interval === 0
    case 'weekly': {
      const startMonday = dayNumber(e.date) - weekday(a)
      const week = Math.floor((dayNumber(date) - startMonday) / 7)
      const days = r.days ?? [weekday(a)]
      return week % r.interval === 0 && days.includes(weekday(b))
    }
    case 'monthly': {
      const months = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth()
      if (months % r.interval !== 0) return false
      if (!r.pos) return b.getDate() === a.getDate()
      if (weekday(b) !== weekday(a)) return false
      const p = weekdayPos(date)
      return r.pos === -1 ? p.last : p.nth === r.pos
    }
    case 'yearly':
      return (b.getFullYear() - a.getFullYear()) % r.interval === 0 && b.getMonth() === a.getMonth() && b.getDate() === a.getDate()
  }
}

const countEnds = new WeakMap<CalendarEvent, string>()

/**
 * The last date of a series: its `until`, or the date of its last counted occurrence.
 * Undefined when it never ends.
 */
export function seriesEnd(e: CalendarEvent): string | undefined {
  const r = e.repeat
  if (!r) return e.date
  if (!r.count) return r.until
  let end = countEnds.get(e)
  if (!end) {
    let n = 0
    let d = fromIso(e.date)
    // Fifty years is plenty and keeps a bad rule from looping forever.
    for (let i = 0; i < 366 * 50; i++, d = addDays(d, 1)) {
      const iso = toIso(d)
      if (matches(e, iso) && ++n === r.count) {
        end = iso
        break
      }
    }
    end ??= toIso(d)
    countEnds.set(e, end)
  }
  return r.until && r.until < end ? r.until : end
}

/** Whether a recurring event happens on `date` (exceptions excluded). */
export function occursOn(e: CalendarEvent, date: string): boolean {
  if (!e.repeat) return e.date === date
  const end = seriesEnd(e)
  if (date < e.date || (end && date > end) || e.exceptions?.includes(date)) return false
  return matches(e, date)
}

/** How many times the rule fired from the first date up to `before` (exclusive), removed days included. */
export function occurrencesBefore(e: CalendarEvent, before: string): number {
  let n = 0
  for (let d = fromIso(e.date); toIso(d) < before; d = addDays(d, 1)) if (matches(e, toIso(d))) n++
  return n
}

/** Every event and occurrence dated within [from, to] (inclusive ISO dates). */
export function expandRange(events: readonly CalendarEvent[], from: string, to: string): EventItem[] {
  const out: EventItem[] = []
  for (const e of events) {
    if (e.endDate) {
      if (e.endDate < from || e.date > to) continue
      for (let d = fromIso(e.date > from ? e.date : from); toIso(d) <= e.endDate && toIso(d) <= to; d = addDays(d, 1)) {
        const date = toIso(d)
        out.push({ ...e, id: date === e.date ? e.id : `${e.id}~${date}`, date, spanOf: e.id, spanFirst: date === e.date, spanLast: date === e.endDate })
      }
      continue
    }
    if (!e.repeat) {
      if (e.date >= from && e.date <= to) out.push(e)
      continue
    }
    const end = seriesEnd(e)
    const last = end && end < to ? end : to
    for (let d = fromIso(e.date > from ? e.date : from); toIso(d) <= last; d = addDays(d, 1)) {
      const date = toIso(d)
      if (!occursOn(e, date)) continue
      out.push({ ...e, id: `${e.id}@${date}`, date, done: !!e.doneDates?.includes(date), seriesId: e.id, occurrence: date })
    }
  }
  return out
}

/** Recognised video-call services, for the «Unirse» button. */
export function meetingService(url: string | undefined): string | null {
  if (!url) return null
  try {
    const h = new URL(url).hostname.toLowerCase()
    if (h.endsWith('meet.google.com')) return 'Google Meet'
    if (h.endsWith('zoom.us') || h.endsWith('zoom.com')) return 'Zoom'
    if (h.includes('teams.microsoft') || h.endsWith('teams.live.com')) return 'Teams'
    if (h.endsWith('webex.com')) return 'Webex'
    if (h.endsWith('whereby.com')) return 'Whereby'
    if (h.endsWith('discord.gg') || h.endsWith('discord.com')) return 'Discord'
    if (h.endsWith('jit.si')) return 'Jitsi'
    return null
  } catch {
    return null
  }
}

/** The first web address in a piece of text, if any. */
export function findLink(text: string): string | null {
  const m = /https?:\/\/[^\s<>"']+/i.exec(text)
  return m ? m[0].replace(/[).,;]+$/, '') : null
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
  /** Only when the text names a day ("mañana", "el viernes", "15/11"). */
  date?: string
  /** Only when the text says how it repeats ("cada lunes", "todos los días 10 veces"). */
  repeat?: Repeat
  /** Only when the text carries a web address (a meeting link). */
  link?: string
}

// Accent-tolerant pieces, so "miercoles" and "miércoles" both work.
const WD = [String.raw`lunes`, String.raw`martes`, String.raw`mi[eé]rcoles`, String.raw`jueves`, String.raw`viernes`, String.raw`s[aá]bados?`, String.raw`domingos?`]
const WD_ANY = `(?:${WD.join('|')})`
const MONTH_RX = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'sep?tiembre', 'octubre', 'noviembre', 'diciembre']
const B = String.raw`(?:^|\s)`
const E = String.raw`(?=$|[\s,.;])`
const rx = (body: string): RegExp => new RegExp(`${B}(${body})${E}`, 'i')
const dayIndex = (word: string): number => WD.findIndex(w => new RegExp(`^${w}$`, 'i').test(word))
const NUM_WORDS: Record<string, number> = { dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6 }

/** First date on or after `from` that falls on one of `days`. */
function nextOn(from: string, days: number[]): string {
  let d = fromIso(from)
  for (let i = 0; i < 7 && !days.includes(weekday(d)); i++) d = addDays(d, 1)
  return toIso(d)
}

/** Takes the first match of `re` out of the text and hands its groups over. */
function take(state: { text: string }, re: RegExp): RegExpExecArray | null {
  const m = re.exec(state.text)
  if (m) state.text = `${state.text.slice(0, m.index)} ${state.text.slice(m.index + m[0].length)}`.replace(/\s{2,}/g, ' ').trim()
  return m
}

/** Words for the day and the repetition, read anywhere in the text. */
function parseWhen(state: { text: string }, today: string): { date?: string; repeat?: Repeat } {
  let date: string | undefined
  let repeat: Repeat | undefined
  const unit = (w: string): Repeat['freq'] => (/^d/i.test(w) ? 'daily' : /^s/i.test(w) ? 'weekly' : /^m/i.test(w) ? 'monthly' : 'yearly')

  let m: RegExpExecArray | null
  if ((m = take(state, rx(String.raw`(?:de lunes a viernes|entre semana|(?:los |cada )?d[ií]as (?:laborables|h[aá]biles))`)))) repeat = { freq: 'weekly', interval: 1, days: [0, 1, 2, 3, 4] }
  else if ((m = take(state, rx(String.raw`(?:cada|todos los) fin(?:es)? de semana`)))) repeat = { freq: 'weekly', interval: 1, days: [5, 6] }
  else if ((m = take(state, rx(String.raw`(?:cada|todos los|todas las)\s+(${WD_ANY}(?:\s*(?:,|y)\s*${WD_ANY})*)`)))) {
    const days = [...new Set(m[2]!.split(/\s*(?:,|\by\b)\s*/i).map(dayIndex).filter(i => i >= 0))].sort()
    repeat = { freq: 'weekly', interval: 1, days }
  } else if ((m = take(state, rx(String.raw`(?:todos los d[ií]as|cada d[ií]a|diari(?:o|a|amente))`)))) repeat = { freq: 'daily', interval: 1 }
  else if ((m = take(state, rx(String.raw`cada (\d{1,2}|dos|tres|cuatro|cinco|seis) (d[ií]as|semanas|meses|a[nñ]os)`)))) {
    const n = NUM_WORDS[m[2]!.toLowerCase()] ?? Number(m[2])
    repeat = { freq: unit(m[3]!), interval: Math.max(1, Math.min(30, n)) }
  } else if ((m = take(state, rx(String.raw`(?:cada semana|semanal(?:mente)?)`)))) repeat = { freq: 'weekly', interval: 1 }
  else if ((m = take(state, rx(String.raw`(?:cada mes|mensual(?:mente)?)`)))) repeat = { freq: 'monthly', interval: 1 }
  else if ((m = take(state, rx(String.raw`(?:cada a[nñ]o|anual(?:mente)?)`)))) repeat = { freq: 'yearly', interval: 1 }

  if (repeat && (m = take(state, rx(String.raw`(\d{1,3}) veces`)))) repeat = { ...repeat, count: Math.max(1, Math.min(999, Number(m[2]))) }

  if ((m = take(state, rx(String.raw`pasado ma[nñ]ana`)))) date = toIso(addDays(fromIso(today), 2))
  else if ((m = take(state, rx(String.raw`hoy`)))) date = today
  // "mañana" alone is tomorrow; "por la mañana" or "en la mañana" is the morning and stays.
  else if ((m = take(state, new RegExp(String.raw`(?:^|\s)(?<!la\s)(ma[nñ]ana)${E}`, 'i')))) date = toIso(addDays(fromIso(today), 1))
  else if ((m = take(state, rx(String.raw`(?:el\s+)?(?:pr[oó]ximo\s+)?(${WD_ANY})`)))) {
    const i = dayIndex(m[2]!)
    // A weekday without "cada" is the next one to come, never today.
    if (i >= 0) date = nextOn(toIso(addDays(fromIso(today), 1)), [i])
  } else if ((m = take(state, rx(String.raw`(?:el\s+)?(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?`)))) {
    const [d, mo, y] = [Number(m[2]), Number(m[3]), m[4] ? Number(m[4].length === 2 ? `20${m[4]}` : m[4]) : undefined]
    date = futureDate(today, d, mo, y)
  } else if ((m = take(state, rx(String.raw`(?:el\s+)?(\d{1,2}) de (${MONTH_RX.join('|')})(?: de (\d{4}))?`)))) {
    const mo = MONTH_RX.findIndex(p => new RegExp(`^${p}$`, 'i').test(m![3]!)) + 1
    date = futureDate(today, Number(m[2]), mo, m[4] ? Number(m[4]) : undefined)
  }

  if (repeat && (m = take(state, rx(String.raw`hasta el (\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?`)))) {
    const until = futureDate(today, Number(m[2]), Number(m[3]), m[4] ? Number(m[4].length === 2 ? `20${m[4]}` : m[4]) : undefined)
    if (until) repeat = { ...repeat, until }
  }
  // A weekly rule on given days starts on the first of them.
  if (repeat?.days && !date) date = nextOn(today, repeat.days)
  return { ...(date ? { date } : {}), ...(repeat ? { repeat } : {}) }
}

/** A day and month without a year means the next time that date comes round. */
function futureDate(today: string, d: number, m: number, y?: number): string | undefined {
  const t = fromIso(today)
  const year = y ?? t.getFullYear()
  const cand = new Date(year, m - 1, d)
  if (cand.getMonth() !== m - 1 || cand.getDate() !== d) return undefined
  if (!y && toIso(cand) < today) cand.setFullYear(year + 1)
  return toIso(cand)
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
const TRAIL_RANGE = new RegExp(String.raw`^(.+?)\s+${T}\s*(?:-|–|a)\s*${T}$`, 'i')
/** A trailing time needs minutes or am/pm, so "Comprar 3" stays a title. */
const TRAIL_SINGLE = /^(.+?)\s+(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|h)?$/i
const TAG = /(^|\s)#([\p{L}]+)/gu

const fold = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * Natural quick-add: "9-10:30 Gimnasio #salud", "18:00 Cena", "8am Correr", "Llamar al banco",
 * "mañana 9-10 Dentista", "Inglés cada martes y jueves a las 18", "Reunión el viernes 10:00 https://meet…".
 * A bare leading number ("3 manzanas") is never read as a time.
 */
export function parseQuick(raw: string, today: string = todayIso()): QuickParse {
  let link: string | undefined
  const found = findLink(raw)
  const state = { text: raw.trim() }
  if (found) {
    link = found
    state.text = state.text.replace(found, ' ').replace(/\s{2,}/g, ' ').trim()
  }
  const when = parseWhen(state, today)
  let text = state.text
  let start = ''
  let end = ''
  let cat: Category | null = null

  // "a las 18", "a las 9:30 pm" anywhere in the text.
  const atTime = /(?:^|\s)a las (\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?(?=$|[\s,.])/i.exec(text)
  if (atTime) {
    const a = clock(atTime[1]!, atTime[2], atTime[3])
    if (a) {
      start = a
      end = fromMin(Math.min(toMin(a) + 60, 23 * 60 + 59))
      text = `${text.slice(0, atTime.index)} ${text.slice(atTime.index + atTime[0].length)}`.trim()
    }
  }

  const r = start ? null : RANGE.exec(text)
  if (start) {
    // Already set by "a las".
  } else if (r) {
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
    } else {
      // The time can also close the text: "Dentista 9-10", "Reunión 10:00", "Clase de 2 a 4pm".
      const tr = TRAIL_RANGE.exec(text)
      const tsm = tr ? null : TRAIL_SINGLE.exec(text)
      const ts = tsm && (tsm[3] || tsm[4]) ? tsm : null
      const ta = tr ? clock(tr[2]!, tr[3], tr[4] ?? tr[7]) : ts ? clock(ts[2]!, ts[3], ts[4]) : null
      const tb = tr ? clock(tr[5]!, tr[6], tr[7]) : ta ? fromMin(Math.min(toMin(ta) + 60, 23 * 60 + 59)) : null
      if (ta && tb) {
        start = ta
        end = tb
        text = (tr ?? ts)![1]!.replace(/\s+de$/i, '')
      }
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
  return { text, start, end, cat, ...when, ...(link ? { link } : {}) }
}
