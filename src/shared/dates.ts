/** Calendar helpers. All dates are local and handled as `YYYY-MM-DD` strings at the edges. */

export const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const
export const DAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const
export const DAYS_LETTER = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const
export const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
] as const
export const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const

export const pad = (n: number): string => String(n).padStart(2, '0')

export const toIso = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function fromIso(s: string): Date {
  const [y = 1970, m = 1, d = 1] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const todayIso = (now: Date = new Date()): string => toIso(now)

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

export function addMonths(d: Date, n: number): Date {
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1)
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  return new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), last))
}

/** Monday = 0 … Sunday = 6. */
export const weekday = (d: Date): number => (d.getDay() + 6) % 7

export const mondayOf = (d: Date): Date => addDays(d, -weekday(d))

export const weekDates = (d: Date): Date[] => {
  const mon = mondayOf(d)
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i))
}

export function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 864e5 + 1) / 7)
}

/** Full weeks (Monday-first) covering the month of `d`. */
export function monthMatrix(d: Date): Date[] {
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  const lead = weekday(first)
  const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  const weeks = Math.ceil((lead + days) / 7)
  const start = addDays(first, -lead)
  return Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i))
}

export function toMin(t: string): number {
  const [h = 0, m = 0] = t.split(':').map(Number)
  return h * 60 + m
}

export function fromMin(m: number): string {
  const c = Math.max(0, Math.min(23 * 60 + 59, Math.round(m)))
  return `${pad(Math.floor(c / 60))}:${pad(c % 60)}`
}

/** Lenient clock parsing: "9" → 09:00, "930" → 09:30, "21.15" → 21:15, "7pm" → 19:00. */
export function parseClock(raw: string): string | null {
  const m = /^(\d{1,2})(?:[:.h]?(\d{2}))?(am|pm)?$/.exec(raw.trim().toLowerCase().replace(/\s+/g, ''))
  if (!m) return null
  let h = Number(m[1])
  const min = Number(m[2] ?? 0)
  if (m[3] === 'pm' && h < 12) h += 12
  if (m[3] === 'am' && h === 12) h = 0
  return h < 24 && min < 60 ? fromMin(h * 60 + min) : null
}

export function fmtDuration(m: number): string {
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} h ${r} min` : `${h} h`
}

export const sameMonth = (a: Date, b: Date): boolean => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()

export const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

export function weekRangeLabel(d: Date): string {
  const [mon, sun] = [mondayOf(d), addDays(mondayOf(d), 6)]
  return mon.getMonth() === sun.getMonth()
    ? `${mon.getDate()}–${sun.getDate()} ${MONTHS_SHORT[sun.getMonth()]}`
    : `${mon.getDate()} ${MONTHS_SHORT[mon.getMonth()]} – ${sun.getDate()} ${MONTHS_SHORT[sun.getMonth()]}`
}

export function longDate(iso: string): string {
  const d = fromIso(iso)
  return `${DAYS[weekday(d)]!.toLowerCase()} ${d.getDate()} de ${MONTHS[d.getMonth()]}`
}
