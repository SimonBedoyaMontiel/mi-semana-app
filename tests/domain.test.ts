import { describe, expect, it } from 'vitest'
import { addMonths, fromIso, isoWeek, monthMatrix, parseClock, toIso, weekday } from '@shared/dates'
import { hourWindow, indexByDate, layoutDay, parseQuick } from '@shared/events'
import { dayProgress, nextTapCount, streak } from '@shared/habits'
import { applyCommand } from '@shared/reducer'
import { emptyData } from '@shared/model'
import type { CalendarEvent, Habit } from '@shared/model'

const ev = (p: Partial<CalendarEvent>): CalendarEvent => ({
  id: Math.random().toString(36).slice(2), date: '2026-10-26', start: '', end: '', text: 'x', cat: 'otro', done: false, createdAt: 0, ...p,
})
const habit = (p: Partial<Habit>): Habit => ({
  id: 'h1', name: 'Creatina', kind: 'suplemento', dose: '5 g', target: 1, unit: '', slot: 'manana',
  days: [0, 1, 2, 3, 4, 5, 6], color: 'cobalt', createdAt: '2026-10-01', ...p,
})

describe('dates', () => {
  it('uses Monday-first weekdays', () => {
    expect(weekday(fromIso('2026-10-26'))).toBe(0)
    expect(weekday(fromIso('2026-11-01'))).toBe(6)
  })
  it('builds full Monday-first weeks for a month', () => {
    const m = monthMatrix(fromIso('2026-10-15'))
    expect(m.length % 7).toBe(0)
    expect(toIso(m[0]!)).toBe('2026-09-28')
    expect(toIso(m.at(-1)!)).toBe('2026-11-01')
  })
  it('clamps the day when moving months', () => {
    expect(toIso(addMonths(fromIso('2026-01-31'), 1))).toBe('2026-02-28')
  })
  it('parses typed clock times leniently', () => {
    expect(parseClock('9')).toBe('09:00')
    expect(parseClock('930')).toBe('09:30')
    expect(parseClock('21.15')).toBe('21:15')
    expect(parseClock('7 pm')).toBe('19:00')
    expect(parseClock('25:00')).toBeNull()
    expect(parseClock('hola')).toBeNull()
  })
  it('computes ISO weeks', () => {
    expect(isoWeek(fromIso('2026-10-26'))).toBe(44)
    expect(isoWeek(fromIso('2027-01-01'))).toBe(53)
  })
})

describe('parseQuick', () => {
  it('reads ranges, single times and tags', () => {
    expect(parseQuick('9-10:30 Gimnasio #salud')).toEqual({ text: 'Gimnasio', start: '09:00', end: '10:30', cat: 'salud' })
    expect(parseQuick('18:00 Cena')).toMatchObject({ start: '18:00', end: '19:00', text: 'Cena' })
    expect(parseQuick('2-4pm Clase #est')).toMatchObject({ start: '14:00', end: '16:00', cat: 'estudio' })
    expect(parseQuick('8am Correr')).toMatchObject({ start: '08:00', text: 'Correr' })
  })
  it('never treats a bare number as a time', () => {
    expect(parseQuick('3 manzanas')).toMatchObject({ start: '', text: '3 manzanas' })
    expect(parseQuick('9 almuerzo')).toMatchObject({ start: '' })
  })
  it('keeps unknown tags in the text', () => {
    expect(parseQuick('Ver #pelicula').text).toBe('Ver #pelicula')
  })
  it('repairs an end before the start', () => {
    expect(parseQuick('10-9 Raro')).toMatchObject({ start: '10:00', end: '11:00' })
  })
})

describe('layout', () => {
  it('places overlapping events side by side and frees columns after a gap', () => {
    const placed = layoutDay([
      ev({ id: 'a', start: '09:00', end: '10:00' }),
      ev({ id: 'b', start: '09:30', end: '11:00' }),
      ev({ id: 'c', start: '10:00', end: '10:30' }),
      ev({ id: 'd', start: '12:00', end: '13:00' }),
    ])
    const by = Object.fromEntries(placed.map(p => [p.event.id, p]))
    expect(by.a).toMatchObject({ col: 0, cols: 2 })
    expect(by.b).toMatchObject({ col: 1, cols: 2 })
    expect(by.c).toMatchObject({ col: 0, cols: 2 })
    expect(by.d).toMatchObject({ col: 0, cols: 1 })
  })
  it('widens the hour window to fit early and late events', () => {
    expect(hourWindow([ev({ start: '05:30', end: '06:00' })])).toEqual([5, 23])
    expect(hourWindow([ev({ start: '22:00', end: '23:45' })])).toEqual([7, 24])
  })
  it('indexes events by date in time order', () => {
    const idx = indexByDate([ev({ id: 'u', createdAt: 1 }), ev({ id: 't', start: '08:00', end: '09:00' })])
    expect(idx.get('2026-10-26')!.map(e => e.id)).toEqual(['t', 'u'])
  })
})

describe('habits', () => {
  it('counts a streak and tolerates an unfinished today', () => {
    const h = habit({})
    const log = { '2026-10-24': { h1: 1 }, '2026-10-25': { h1: 1 } }
    expect(streak(h, log, '2026-10-26')).toBe(2)
    expect(streak(h, { ...log, '2026-10-26': { h1: 1 } }, '2026-10-26')).toBe(3)
  })
  it('skips days a habit is not scheduled', () => {
    const h = habit({ days: [0, 2, 4] }) // L X V
    const log = { '2026-10-23': { h1: 1 }, '2026-10-21': { h1: 1 } }
    expect(streak(h, log, '2026-10-25')).toBe(2)
  })
  it('ignores days before the habit existed', () => {
    const h = habit({ createdAt: '2026-10-26' })
    expect(dayProgress([h], {}, '2026-10-25')).toEqual({ done: 0, total: 0 })
    expect(dayProgress([h], {}, '2026-10-26')).toEqual({ done: 0, total: 1 })
  })
  it('steps counters up and back', () => {
    expect(nextTapCount(0, 1)).toBe(1)
    expect(nextTapCount(1, 1)).toBe(0)
    expect(nextTapCount(7, 8)).toBe(8)
    expect(nextTapCount(8, 8)).toBe(7)
  })
})

describe('commands', () => {
  it('applies immutably and prunes empty log days', () => {
    const base = emptyData()
    const a = applyCommand(base, { type: 'habitLog.set', date: '2026-10-26', habitId: 'h1', count: 2 })
    expect(base.habitLog).toEqual({})
    expect(a.habitLog).toEqual({ '2026-10-26': { h1: 2 } })
    const b = applyCommand(a, { type: 'habitLog.set', date: '2026-10-26', habitId: 'h1', count: 0 })
    expect(b.habitLog).toEqual({})
  })
  it('restores a deleted habit at its old position', () => {
    let d = emptyData()
    for (const id of ['a', 'b', 'c']) d = applyCommand(d, { type: 'habit.upsert', habit: habit({ id }) })
    d = applyCommand(d, { type: 'habit.delete', id: 'b' })
    d = applyCommand(d, { type: 'habit.upsert', habit: habit({ id: 'b' }), index: 1 })
    expect(d.habits.map(h => h.id)).toEqual(['a', 'b', 'c'])
  })
})
