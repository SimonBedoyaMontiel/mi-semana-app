import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mergeBackup, parseBackup, toBackupFile } from '@shared/backup'
import { remindersBetween } from '@shared/reminders'
import { emptyData } from '@shared/model'
import { Repository, sanitize } from '../src/main/repository'

describe('backup', () => {
  it('round-trips its own format', () => {
    const d = emptyData()
    d.notes['2026-10-26'] = 'hola'
    expect(parseBackup(toBackupFile(d)).notes).toEqual({ '2026-10-26': 'hola' })
  })

  it('repairs and maps the web export', () => {
    const web = {
      app: 'mi-semana-web',
      events: [
        { id: 'e1', date: '2026-10-26', start: '09:00', end: '', text: 'Gym', cat: 'salud', done: false, t: 5 },
        { id: 'e2', date: 'mal', text: 'x' },
        { id: 'e3', date: '2026-10-27', start: '', end: '', text: 'Banco', cat: 'raro', done: true },
      ],
      habits: [{ id: 'h1', name: 'Agua', kind: 'habito', target: 8, unit: 'vasos', slot: 'cualquiera', days: [0, 1], color: 'pink', created: '2026-10-26' }],
      habitLog: { '2026-10-26': { h1: 3, bad: -1 } },
      notes: { '2026-10-26': 'nota' },
    }
    const p = parseBackup(JSON.stringify(web))
    expect(p.events.map(e => e.id)).toEqual(['e1', 'e3'])
    expect(p.events[0]).toMatchObject({ end: '10:00', createdAt: 5 })
    expect(p.events[1]).toMatchObject({ cat: 'otro', done: true })
    expect(p.habits[0]).toMatchObject({ color: 'magenta', createdAt: '2026-10-26', target: 8 })
    expect(p.habitLog).toEqual({ '2026-10-26': { h1: 3 } })
  })

  it('rejects unrelated files with a readable message', () => {
    expect(() => parseBackup('{"foo":1}')).toThrow(/no es una exportación/)
    expect(() => parseBackup('nope')).toThrow(/JSON/)
  })

  it('merges additively and keeps the higher habit count', () => {
    const base = emptyData()
    base.habitLog = { '2026-10-26': { h1: 5 } }
    const res = mergeBackup(base, { events: [], habits: [], habitLog: { '2026-10-26': { h1: 2, h2: 1 } }, notes: {} })
    expect(res.data.habitLog).toEqual({ '2026-10-26': { h1: 5, h2: 1 } })
    expect(res.added.days).toBe(1)
  })
})

describe('reminders', () => {
  it('fires event and pending-habit reminders inside the window only', () => {
    const d = emptyData()
    d.events.push({ id: 'e', date: '2026-10-26', start: '09:00', end: '10:00', text: 'Reunión', cat: 'trabajo', done: false, createdAt: 0 })
    d.habits.push({ id: 'h', name: 'Creatina', kind: 'suplemento', dose: '5 g', target: 1, unit: '', slot: 'manana', days: [0, 1, 2, 3, 4, 5, 6], color: 'cobalt', createdAt: '2026-10-01' })
    const t = (h: number, m: number): number => new Date(2026, 9, 26, h, m).getTime()
    const r = remindersBetween(d, t(7, 55), t(8, 55))
    expect(r.map(x => x.title)).toEqual(['Mañana: Creatina', 'Reunión'])
    expect(r[1]!.body).toContain('10 min')
    d.habitLog['2026-10-26'] = { h: 1 }
    expect(remindersBetween(d, t(7, 55), t(8, 5))).toEqual([])
  })
})

describe('repository', () => {
  it('drops invalid rows instead of the whole file', () => {
    const d = sanitize({ events: [{ id: 'x' }, { id: 'ok', date: '2026-10-26', start: '', end: '', text: 'a', cat: 'otro', done: false, createdAt: 1 }], settings: { theme: 'dark' } })
    expect(d.events.map(e => e.id)).toEqual(['ok'])
    expect(d.settings.theme).toBe('dark')
    expect(d.settings.slotTimes.manana).toBe('08:00')
  })

  it('persists atomically and recovers from a corrupt main file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'misemana-'))
    const repo = new Repository(dir)
    await repo.init()
    repo.apply({ type: 'note.set', date: '2026-10-26', text: 'uno' })
    await repo.flush()
    repo.apply({ type: 'note.set', date: '2026-10-26', text: 'dos' })
    await repo.flush()
    expect(JSON.parse(readFileSync(join(dir, 'data.json'), 'utf8')).notes['2026-10-26']).toBe('dos')

    writeFileSync(join(dir, 'data.json'), '{ roto')
    const again = new Repository(dir)
    expect((await again.init()).notes['2026-10-26']).toBe('uno')
  })
})
