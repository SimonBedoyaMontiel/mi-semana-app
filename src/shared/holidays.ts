/**
 * Public holidays, computed (no data files, no network). National holidays only; regional ones
 * and holidays moved by a one-off decree are not included.
 */
import type { Country } from './model'
import { addDays, toIso, weekday } from './dates'

export type HolidayMap = ReadonlyMap<string, string>

/** Easter Sunday (Gregorian), anonymous algorithm. */
export function easter(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

const date = (y: number, m: number, d: number): Date => new Date(y, m - 1, d)
/** Same day if it is a Monday, otherwise the next Monday. */
const nextMonday = (d: Date): Date => addDays(d, (7 - weekday(d)) % 7)
/** n-th given weekday (Monday = 0) of a month; n = -1 is the last one. */
function nth(y: number, m: number, wd: number, n: number): Date {
  if (n < 0) {
    const last = date(y, m + 1, 0)
    return addDays(last, -((weekday(last) - wd + 7) % 7))
  }
  const first = date(y, m, 1)
  return addDays(first, ((wd - weekday(first) + 7) % 7) + 7 * (n - 1))
}

type Rule = [Date, string]

function colombia(y: number): Rule[] {
  const e = easter(y)
  return [
    [date(y, 1, 1), 'Año Nuevo'],
    [nextMonday(date(y, 1, 6)), 'Reyes Magos'],
    [nextMonday(date(y, 3, 19)), 'San José'],
    [addDays(e, -3), 'Jueves Santo'],
    [addDays(e, -2), 'Viernes Santo'],
    [date(y, 5, 1), 'Día del Trabajo'],
    [addDays(e, 43), 'Ascensión del Señor'],
    [addDays(e, 64), 'Corpus Christi'],
    [addDays(e, 71), 'Sagrado Corazón'],
    [nextMonday(date(y, 6, 29)), 'San Pedro y San Pablo'],
    [date(y, 7, 20), 'Día de la Independencia'],
    [date(y, 8, 7), 'Batalla de Boyacá'],
    [nextMonday(date(y, 8, 15)), 'Asunción de la Virgen'],
    [nextMonday(date(y, 10, 12)), 'Día de la Raza'],
    [nextMonday(date(y, 11, 1)), 'Todos los Santos'],
    [nextMonday(date(y, 11, 11)), 'Independencia de Cartagena'],
    [date(y, 12, 8), 'Inmaculada Concepción'],
    [date(y, 12, 25), 'Navidad'],
  ]
}

function spain(y: number): Rule[] {
  return [
    [date(y, 1, 1), 'Año Nuevo'],
    [date(y, 1, 6), 'Epifanía del Señor'],
    [addDays(easter(y), -2), 'Viernes Santo'],
    [date(y, 5, 1), 'Fiesta del Trabajo'],
    [date(y, 8, 15), 'Asunción de la Virgen'],
    [date(y, 10, 12), 'Fiesta Nacional de España'],
    [date(y, 11, 1), 'Todos los Santos'],
    [date(y, 12, 6), 'Día de la Constitución'],
    [date(y, 12, 8), 'Inmaculada Concepción'],
    [date(y, 12, 25), 'Navidad'],
  ]
}

function mexico(y: number): Rule[] {
  const rules: Rule[] = [
    [date(y, 1, 1), 'Año Nuevo'],
    [nth(y, 2, 0, 1), 'Día de la Constitución'],
    [nth(y, 3, 0, 3), 'Natalicio de Benito Juárez'],
    [date(y, 5, 1), 'Día del Trabajo'],
    [date(y, 9, 16), 'Día de la Independencia'],
    [nth(y, 11, 0, 3), 'Día de la Revolución'],
    [date(y, 12, 25), 'Navidad'],
  ]
  if ((y - 2024) % 6 === 0) rules.push([date(y, 10, 1), 'Transmisión del Poder Ejecutivo'])
  return rules
}

/** Argentina's movable holidays: Tuesday or Wednesday go back to Monday, Thursday or Friday forward. */
function argMove(d: Date): Date {
  const wd = weekday(d)
  return wd === 1 || wd === 2 ? addDays(d, -wd) : wd === 3 || wd === 4 ? addDays(d, 7 - wd) : d
}

function argentina(y: number): Rule[] {
  const e = easter(y)
  return [
    [date(y, 1, 1), 'Año Nuevo'],
    [addDays(e, -48), 'Carnaval'],
    [addDays(e, -47), 'Carnaval'],
    [date(y, 3, 24), 'Día de la Memoria'],
    [date(y, 4, 2), 'Día de las Malvinas'],
    [addDays(e, -2), 'Viernes Santo'],
    [date(y, 5, 1), 'Día del Trabajador'],
    [date(y, 5, 25), 'Revolución de Mayo'],
    [argMove(date(y, 6, 17)), 'Paso a la Inmortalidad de Güemes'],
    [date(y, 6, 20), 'Día de la Bandera'],
    [date(y, 7, 9), 'Día de la Independencia'],
    [nth(y, 8, 0, 3), 'Paso a la Inmortalidad de San Martín'],
    [argMove(date(y, 10, 12)), 'Día de la Diversidad Cultural'],
    [argMove(date(y, 11, 20)), 'Día de la Soberanía Nacional'],
    [date(y, 12, 8), 'Inmaculada Concepción'],
    [date(y, 12, 25), 'Navidad'],
  ]
}

/** Chile: Tuesday to Thursday go back to Monday, Friday forward to Monday. */
function chileMove(d: Date): Date {
  const wd = weekday(d)
  return wd >= 1 && wd <= 3 ? addDays(d, -wd) : wd === 4 ? addDays(d, 3) : d
}

function chile(y: number): Rule[] {
  const e = easter(y)
  const oct31 = date(y, 10, 31)
  const wd = weekday(oct31)
  // Evangelical churches' day: a Tuesday moves to the Friday before, a Wednesday to the Friday after.
  const evangelical = wd === 1 ? addDays(oct31, -4) : wd === 2 ? addDays(oct31, 2) : oct31
  return [
    [date(y, 1, 1), 'Año Nuevo'],
    [addDays(e, -2), 'Viernes Santo'],
    [addDays(e, -1), 'Sábado Santo'],
    [date(y, 5, 1), 'Día del Trabajo'],
    [date(y, 5, 21), 'Día de las Glorias Navales'],
    // The June solstice in Chile: the 20th in the first two years of each leap cycle, else the 21st.
    [date(y, 6, y % 4 < 2 ? 20 : 21), 'Día de los Pueblos Indígenas'],
    [chileMove(date(y, 6, 29)), 'San Pedro y San Pablo'],
    [date(y, 7, 16), 'Virgen del Carmen'],
    [date(y, 8, 15), 'Asunción de la Virgen'],
    [date(y, 9, 18), 'Fiestas Patrias'],
    [date(y, 9, 19), 'Glorias del Ejército'],
    [chileMove(date(y, 10, 12)), 'Encuentro de Dos Mundos'],
    [evangelical, 'Día de las Iglesias Evangélicas'],
    [date(y, 11, 1), 'Todos los Santos'],
    [date(y, 12, 8), 'Inmaculada Concepción'],
    [date(y, 12, 25), 'Navidad'],
  ]
}

function peru(y: number): Rule[] {
  const e = easter(y)
  return [
    [date(y, 1, 1), 'Año Nuevo'],
    [addDays(e, -3), 'Jueves Santo'],
    [addDays(e, -2), 'Viernes Santo'],
    [date(y, 5, 1), 'Día del Trabajo'],
    [date(y, 6, 7), 'Batalla de Arica'],
    [date(y, 6, 29), 'San Pedro y San Pablo'],
    [date(y, 7, 23), 'Día de la Fuerza Aérea'],
    [date(y, 7, 28), 'Fiestas Patrias'],
    [date(y, 7, 29), 'Fiestas Patrias'],
    [date(y, 8, 6), 'Batalla de Junín'],
    [date(y, 8, 30), 'Santa Rosa de Lima'],
    [date(y, 10, 8), 'Combate de Angamos'],
    [date(y, 11, 1), 'Todos los Santos'],
    [date(y, 12, 8), 'Inmaculada Concepción'],
    [date(y, 12, 9), 'Batalla de Ayacucho'],
    [date(y, 12, 25), 'Navidad'],
  ]
}

function unitedStates(y: number): Rule[] {
  return [
    [date(y, 1, 1), 'Año Nuevo'],
    [nth(y, 1, 0, 3), 'Día de Martin Luther King Jr.'],
    [nth(y, 2, 0, 3), 'Día de los Presidentes'],
    [nth(y, 5, 0, -1), 'Día de los Caídos'],
    [date(y, 6, 19), 'Juneteenth'],
    [date(y, 7, 4), 'Día de la Independencia'],
    [nth(y, 9, 0, 1), 'Día del Trabajo'],
    [nth(y, 10, 0, 2), 'Día de Colón'],
    [date(y, 11, 11), 'Día de los Veteranos'],
    [nth(y, 11, 3, 4), 'Acción de Gracias'],
    [date(y, 12, 25), 'Navidad'],
  ]
}

const RULES: Record<Exclude<Country, 'none'>, (y: number) => Rule[]> = {
  CO: colombia,
  ES: spain,
  MX: mexico,
  AR: argentina,
  CL: chile,
  PE: peru,
  US: unitedStates,
}

const EMPTY: HolidayMap = new Map()
const cache = new Map<string, HolidayMap>()

/** Holidays of one year: ISO date → name (two on the same day are joined). */
export function holidaysOf(country: Country, year: number): HolidayMap {
  if (country === 'none') return EMPTY
  const key = `${country}${year}`
  let map = cache.get(key)
  if (!map) {
    const m = new Map<string, string>()
    for (const [d, name] of RULES[country](year)) {
      const iso = toIso(d)
      const prev = m.get(iso)
      m.set(iso, prev && prev !== name ? `${prev} · ${name}` : name)
    }
    map = m
    cache.set(key, map)
  }
  return map
}

/** Holiday name for an ISO date, if any. */
export const holidayOn = (country: Country, iso: string): string | undefined =>
  holidaysOf(country, Number(iso.slice(0, 4))).get(iso)
