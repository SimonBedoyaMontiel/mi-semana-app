import { describe, expect, it } from 'vitest'
import { expandRange, meetingService, occurrencesBefore, parseQuick, seriesEnd } from '@shared/events'
import { applyCommand } from '@shared/reducer'
import { CalendarEventSchema, emptyData } from '@shared/model'
import type { CalendarEvent, Template } from '@shared/model'
import { applyRemote, emptySyncState, pendingRows } from '@shared/sync'

const ev = (p: Partial<CalendarEvent>): CalendarEvent => ({ id: 'e', date: '2026-10-05', start: '09:00', end: '10:00', text: 'Clase', cat: 'estudio', done: false, createdAt: 0, ...p })
const dates = (e: CalendarEvent, from: string, to: string): string[] => expandRange([e], from, to).map(x => x.date)

describe('repeating', () => {
  it('stops after a number of times', () => {
    const e = ev({ repeat: { freq: 'weekly', interval: 1, days: [0, 2], count: 5 } })
    expect(dates(e, '2026-10-01', '2026-12-31')).toEqual(['2026-10-05', '2026-10-07', '2026-10-12', '2026-10-14', '2026-10-19'])
    expect(seriesEnd(e)).toBe('2026-10-19')
    expect(occurrencesBefore(e, '2026-10-12')).toBe(2)
  })

  it('counts removed days, as other calendars do', () => {
    const e = ev({ repeat: { freq: 'daily', interval: 1, count: 3 }, exceptions: ['2026-10-06'] })
    expect(dates(e, '2026-10-01', '2026-10-31')).toEqual(['2026-10-05', '2026-10-07'])
  })

  it('repeats on the nth or the last weekday of the month', () => {
    // 13 Oct 2026 is the second Tuesday.
    const second = ev({ date: '2026-10-13', repeat: { freq: 'monthly', interval: 1, pos: 2 } })
    expect(dates(second, '2026-10-01', '2027-01-31')).toEqual(['2026-10-13', '2026-11-10', '2026-12-08', '2027-01-12'])
    // 30 Oct 2026 is the last Friday.
    const last = ev({ date: '2026-10-30', repeat: { freq: 'monthly', interval: 1, pos: -1 } })
    expect(dates(last, '2026-10-01', '2027-01-31')).toEqual(['2026-10-30', '2026-11-27', '2026-12-25', '2027-01-29'])
  })

  it('repeats every year', () => {
    const e = ev({ date: '2024-11-15', start: '', end: '', repeat: { freq: 'yearly', interval: 1 } })
    expect(dates(e, '2026-01-01', '2027-12-31')).toEqual(['2026-11-15', '2027-11-15'])
  })
})

describe('several days', () => {
  it('shows on every day it covers', () => {
    const trip = ev({ id: 't', date: '2026-10-30', start: '', end: '', endDate: '2026-11-02', text: 'Viaje' })
    const items = expandRange([trip], '2026-10-01', '2026-11-30')
    expect(items.map(i => i.date)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
    expect(items.map(i => i.id)).toEqual(['t', 't~2026-10-31', 't~2026-11-01', 't~2026-11-02'])
    expect(items[0]).toMatchObject({ spanOf: 't', spanFirst: true, spanLast: false })
    expect(items[3]).toMatchObject({ spanLast: true })
  })

  it('goes without a time and without repeating', () => {
    expect(CalendarEventSchema.safeParse(ev({ endDate: '2026-10-07' })).success).toBe(false)
    expect(CalendarEventSchema.safeParse(ev({ start: '', end: '', endDate: '2026-10-07' })).success).toBe(true)
    expect(CalendarEventSchema.safeParse(ev({ start: '', end: '', endDate: '2026-10-04' })).success).toBe(false)
  })
})

describe('details', () => {
  it('keeps meeting links, places, people and steps', () => {
    const full = ev({
      link: 'https://meet.google.com/abc-defg-hij', location: 'Oficina', guests: ['Ana', 'luis@correo.com'], notes: 'Agenda',
      tasks: [{ id: 's', text: 'Preparar', done: false }],
    })
    expect(CalendarEventSchema.safeParse(full).success).toBe(true)
    expect(CalendarEventSchema.safeParse(ev({ link: 'javascript:alert(1)' })).success).toBe(false)
    expect(meetingService(full.link)).toBe('Google Meet')
    expect(meetingService('https://us02web.zoom.us/j/123')).toBe('Zoom')
    expect(meetingService('https://example.com')).toBeNull()
  })

  it('syncs templates', () => {
    const t: Template = { id: 'x', text: 'Standup', startMin: 540, minutes: 15, cat: 'trabajo', link: 'https://meet.google.com/a', createdAt: 0 }
    const a = applyCommand(emptyData(), { type: 'template.upsert', item: t, at: 1 })
    const b = applyRemote(emptyData(), pendingRows(a, emptySyncState())).data
    expect(b.templates).toEqual([t])
  })
})

describe('quick add', () => {
  const today = '2026-10-27' // a Tuesday
  it('reads the day', () => {
    expect(parseQuick('mañana 9-10 Dentista', today)).toMatchObject({ text: 'Dentista', start: '09:00', date: '2026-10-28' })
    expect(parseQuick('Viaje el 20 de diciembre', today)).toMatchObject({ text: 'Viaje', date: '2026-12-20' })
    expect(parseQuick('Llamar el martes', today).date).toBe('2026-11-03')
    expect(parseQuick('Correr por la mañana', today)).toEqual({ text: 'Correr por la mañana', start: '', end: '', cat: null })
  })

  it('reads how it repeats', () => {
    expect(parseQuick('Inglés cada martes y jueves a las 18', today)).toMatchObject({
      text: 'Inglés', start: '18:00', date: '2026-10-27', repeat: { freq: 'weekly', interval: 1, days: [1, 3] },
    })
    expect(parseQuick('Gimnasio todos los días 10 veces', today).repeat).toEqual({ freq: 'daily', interval: 1, count: 10 })
    expect(parseQuick('Cumpleaños de Ana 15/11 cada año', today)).toMatchObject({ text: 'Cumpleaños de Ana', date: '2026-11-15', repeat: { freq: 'yearly' } })
  })

  it('takes the meeting link and a time at the end', () => {
    expect(parseQuick('Reunión el viernes 10:00 https://meet.google.com/abc-defg-hij', today)).toMatchObject({
      text: 'Reunión', start: '10:00', date: '2026-10-30', link: 'https://meet.google.com/abc-defg-hij',
    })
    expect(parseQuick('Clase de 2 a 4pm', today)).toMatchObject({ text: 'Clase', start: '14:00', end: '16:00' })
    expect(parseQuick('Comprar 3', today)).toMatchObject({ text: 'Comprar 3', start: '' })
  })
})
