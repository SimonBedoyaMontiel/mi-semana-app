import { describe, expect, it } from 'vitest'
import { easter, holidayOn, holidaysOf } from '@shared/holidays'
import { byTime, expandRange } from '@shared/events'
import { PREFS_KEY, applyCommand } from '@shared/reducer'
import { DEFAULT_SETTINGS, emptyData } from '@shared/model'
import type { CalendarEvent } from '@shared/model'
import { sanitize } from '@shared/sanitize'
import { applyRemote, emptySyncState, pendingRows } from '@shared/sync'

const ev = (p: Partial<CalendarEvent>): CalendarEvent => ({
  id: 'x', date: '2026-10-26', start: '', end: '', text: 'Tarea', cat: 'otro', done: false, createdAt: 0, ...p,
})

describe('holidays', () => {
  it('finds Easter', () => {
    expect([2024, 2025, 2026, 2027].map(y => easter(y).toDateString())).toEqual([
      new Date(2024, 2, 31).toDateString(),
      new Date(2025, 3, 20).toDateString(),
      new Date(2026, 3, 5).toDateString(),
      new Date(2027, 2, 28).toDateString(),
    ])
  })

  it('moves Colombian holidays to Monday (Ley Emiliani)', () => {
    const co = [...holidaysOf('CO', 2026).keys()]
    expect(co).toEqual([
      '2026-01-01', '2026-01-12', '2026-03-23', '2026-04-02', '2026-04-03', '2026-05-01', '2026-05-18', '2026-06-08',
      '2026-06-15', '2026-06-29', '2026-07-20', '2026-08-07', '2026-08-17', '2026-10-12', '2026-11-02', '2026-11-16',
      '2026-12-08', '2026-12-25',
    ])
  })

  it('handles n-th weekday rules', () => {
    expect(holidayOn('US', '2026-11-26')).toBe('Acción de Gracias')
    expect(holidayOn('US', '2026-05-25')).toBe('Día de los Caídos')
    expect(holidayOn('MX', '2026-02-02')).toBe('Día de la Constitución')
    expect(holidayOn('MX', '2026-11-16')).toBe('Día de la Revolución')
    expect(holidayOn('ES', '2026-12-06')).toBe('Día de la Constitución')
    expect(holidayOn('PE', '2026-07-28')).toBe('Fiestas Patrias')
    expect(holidayOn('CL', '2026-09-18')).toBe('Fiestas Patrias')
    expect(holidayOn('AR', '2026-02-16')).toBe('Carnaval')
  })

  it('shows nothing when turned off', () => {
    expect(holidayOn('none', '2026-12-25')).toBeUndefined()
  })
})

describe('priority and colour', () => {
  it('puts higher priority first among untimed events', () => {
    const list = [ev({ id: 'a', createdAt: 1 }), ev({ id: 'b', createdAt: 2, priority: 'alta' }), ev({ id: 'c', createdAt: 3, priority: 'baja' })]
    expect(list.sort(byTime).map(e => e.id)).toEqual(['b', 'a', 'c'])
  })

  it('keeps colour and priority on recurring occurrences', () => {
    const e = ev({ color: 'teal', priority: 'media', repeat: { freq: 'weekly', interval: 1, days: [0, 2, 4] } })
    const items = expandRange([e], '2026-10-26', '2026-11-01')
    expect(items.map(i => i.date)).toEqual(['2026-10-26', '2026-10-28', '2026-10-30'])
    expect(items.every(i => i.color === 'teal' && i.priority === 'media')).toBe(true)
  })
})

describe('design settings', () => {
  it('fills the new settings in for data saved by older versions', () => {
    const old = { ...emptyData(), settings: { theme: 'dark', sidebar: false } }
    const s = sanitize(old).settings
    expect(s.theme).toBe('dark')
    expect(s.sidebar).toBe(false)
    expect(s.look).toEqual(DEFAULT_SETTINGS.look)
    expect(s.holidays).toBe('CO')
  })

  it('keeps the rest of the settings when the look is damaged', () => {
    const s = sanitize({ ...emptyData(), settings: { theme: 'light', look: { palette: 'neon' } } }).settings
    expect(s.theme).toBe('light')
    expect(s.look).toEqual(DEFAULT_SETTINGS.look)
  })

  it('syncs the look and holidays, not the device settings', () => {
    let data = emptyData()
    data = applyCommand(data, { type: 'settings.set', settings: { ...data.settings, sidebar: false }, at: 100 })
    expect(data.stamps[PREFS_KEY]).toBeUndefined()
    const look = { ...data.settings.look, palette: 'bosque' as const, accent: '#123abc' }
    data = applyCommand(data, { type: 'settings.set', settings: { ...data.settings, look, holidays: 'MX' }, at: 200 })
    const row = pendingRows(data, emptySyncState()).find(r => r.key === PREFS_KEY)
    expect(row?.value).toEqual({ look, holidays: 'MX', currency: 'COP' })

    const other = applyRemote(emptyData(), [{ ...row!, updated_at: 200 }])
    expect(other.data.settings.look.palette).toBe('bosque')
    expect(other.data.settings.holidays).toBe('MX')
    expect(other.data.settings.sidebar).toBe(true)
  })

  it('ignores an invalid look from the server', () => {
    const res = applyRemote(emptyData(), [{ key: PREFS_KEY, value: { look: { palette: 'x' } }, deleted: false, updated_at: 5 }])
    expect(res.changed).toBe(false)
  })
})
