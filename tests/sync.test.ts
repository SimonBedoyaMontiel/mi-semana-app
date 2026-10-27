import { describe, expect, it } from 'vitest'
import { expandRange, occursOn } from '@shared/events'
import { applyCommand } from '@shared/reducer'
import type { Command } from '@shared/commands'
import { emptyData } from '@shared/model'
import type { AppData, CalendarEvent } from '@shared/model'
import { SyncEngine, applyRemote, emptySyncState, ensureStamps, pendingRows } from '@shared/sync'
import type { RecordRow, SyncState, SyncTransport } from '@shared/sync'
import { remindersBetween } from '@shared/reminders'

const base = (p: Partial<CalendarEvent>): CalendarEvent => ({
  id: 'r', date: '2026-10-26', start: '09:00', end: '10:00', text: 'Serie', cat: 'trabajo', done: false, createdAt: 0, ...p,
})

describe('recurrence', () => {
  it('repeats daily with an interval and an end date', () => {
    const e = base({ repeat: { freq: 'daily', interval: 2, until: '2026-11-01' } })
    expect(expandRange([e], '2026-10-25', '2026-11-10').map(x => x.date)).toEqual(['2026-10-26', '2026-10-28', '2026-10-30', '2026-11-01'])
  })
  it('repeats weekly on chosen weekdays, every other week', () => {
    const e = base({ repeat: { freq: 'weekly', interval: 2, days: [0, 2] } }) // L y X
    expect(expandRange([e], '2026-10-26', '2026-11-15').map(x => x.date)).toEqual(['2026-10-26', '2026-10-28', '2026-11-09', '2026-11-11'])
  })
  it('repeats monthly on the same day and skips short months', () => {
    const e = base({ date: '2026-01-31', repeat: { freq: 'monthly', interval: 1 } })
    expect(expandRange([e], '2026-01-01', '2026-05-31').map(x => x.date)).toEqual(['2026-01-31', '2026-03-31', '2026-05-31'])
  })
  it('honours exceptions and per-occurrence done state', () => {
    let d: AppData = { ...emptyData(), events: [base({ repeat: { freq: 'daily', interval: 1 } })] }
    d = applyCommand(d, { type: 'event.occurrence', id: 'r', date: '2026-10-27', op: 'skip' })
    d = applyCommand(d, { type: 'event.occurrence', id: 'r', date: '2026-10-28', op: 'done' })
    const occ = expandRange(d.events, '2026-10-26', '2026-10-28')
    expect(occ.map(x => [x.date, x.done, x.id])).toEqual([
      ['2026-10-26', false, 'r@2026-10-26'],
      ['2026-10-28', true, 'r@2026-10-28'],
    ])
    expect(occursOn(d.events[0]!, '2026-10-27')).toBe(false)
  })
  it('sends a reminder for each occurrence', () => {
    const d = { ...emptyData(), events: [base({ repeat: { freq: 'daily', interval: 1 } })] }
    const t = (day: number, h: number, m: number): number => new Date(2026, 9, day, h, m).getTime()
    expect(remindersBetween(d, t(28, 8, 45), t(28, 8, 55)).map(r => r.key)).toEqual(['e:r@2026-10-28:2026-10-28:09:00:10'])
  })
})

describe('stamps', () => {
  it('stamps changes and records deletions as tombstones', () => {
    let d = emptyData()
    d = applyCommand(d, { type: 'note.set', date: '2026-10-26', text: 'a', at: 100 })
    d = applyCommand(d, { type: 'note.set', date: '2026-10-26', text: 'b', at: 50 }) // clock went backwards
    expect(d.stamps['n:2026-10-26']).toBe(101)
    d = applyCommand(d, { type: 'event.upsert', event: base({}), at: 200 })
    d = applyCommand(d, { type: 'event.delete', id: 'r', at: 300 })
    expect(d.stamps['e:r']).toBeUndefined()
    expect(d.tombs['e:r']).toBe(300)
  })
  it('stamps legacy records once so they get uploaded', () => {
    const d = ensureStamps({ ...emptyData(), notes: { '2026-10-26': 'x' } })
    expect(d.stamps).toEqual({ 'n:2026-10-26': 1 })
    expect(ensureStamps(d)).toBe(d)
  })
})

/** In-memory stand-in for the Supabase table + push_records() function. */
class FakeServer {
  rows = new Map<string, RecordRow>()
  private clock = 0
  transport(): SyncTransport {
    return {
      pull: async cursor => [...this.rows.values()].filter(r => !cursor || r.modified_at! > cursor).sort((a, b) => a.modified_at!.localeCompare(b.modified_at!)),
      push: async rows => {
        for (const r of rows) {
          const cur = this.rows.get(r.key)
          if (cur && cur.updated_at >= r.updated_at) continue
          this.rows.set(r.key, { ...r, modified_at: String(++this.clock).padStart(10, '0') })
        }
      },
    }
  }
}

class Device {
  data = emptyData()
  state: SyncState = emptySyncState()
  engine: SyncEngine
  constructor(server: FakeServer) {
    this.engine = new SyncEngine(server.transport(), {
      get: () => this.data,
      replace: d => (this.data = d),
      loadState: () => this.state,
      saveState: s => (this.state = s),
    })
  }
  do(cmd: Command): void {
    this.data = applyCommand(this.data, cmd)
  }
}

describe('sync engine', () => {
  it('converges two devices and lets the newest change win', async () => {
    const server = new FakeServer()
    const pc = new Device(server)
    const phone = new Device(server)

    pc.do({ type: 'event.upsert', event: base({ text: 'Desde el PC' }), at: 1000 })
    pc.do({ type: 'note.set', date: '2026-10-26', text: 'nota PC', at: 1000 })
    await pc.engine.run()
    await phone.engine.run()
    expect(phone.data.events.map(e => e.text)).toEqual(['Desde el PC'])

    phone.do({ type: 'event.upsert', event: base({ text: 'Editado en el móvil' }), at: 2000 })
    pc.do({ type: 'event.upsert', event: base({ text: 'Edición vieja' }), at: 1500 })
    phone.do({ type: 'habitLog.set', date: '2026-10-26', habitId: 'h', count: 2, at: 2100 })
    await phone.engine.run()
    await pc.engine.run()
    await phone.engine.run()

    expect(pc.data.events[0]!.text).toBe('Editado en el móvil')
    expect(phone.data.events[0]!.text).toBe('Editado en el móvil')
    expect(pc.data.habitLog).toEqual({ '2026-10-26': { h: 2 } })
    expect(pendingRows(pc.data, pc.state)).toEqual([])
    expect(pendingRows(phone.data, phone.state)).toEqual([])
  })

  it('propagates deletions', async () => {
    const server = new FakeServer()
    const a = new Device(server)
    const b = new Device(server)
    a.do({ type: 'event.upsert', event: base({}), at: 10 })
    await a.engine.run()
    await b.engine.run()
    b.do({ type: 'event.delete', id: 'r', at: 20 })
    await b.engine.run()
    await a.engine.run()
    expect(a.data.events).toEqual([])
    expect(a.data.tombs['e:r']).toBe(20)
  })

  it('does not re-upload what it just downloaded', async () => {
    const server = new FakeServer()
    const a = new Device(server)
    const b = new Device(server)
    a.do({ type: 'note.set', date: '2026-10-26', text: 'hola', at: 5 })
    await a.engine.run()
    let pushes = 0
    const t = server.transport()
    const counting = new SyncEngine({ pull: t.pull, push: async rows => { pushes += rows.length; await t.push(rows) } }, {
      get: () => b.data, replace: d => (b.data = d), loadState: () => b.state, saveState: s => (b.state = s),
    })
    await counting.run()
    expect(b.data.notes['2026-10-26']).toBe('hola')
    expect(pushes).toBe(0)
  })

  it('ignores malformed rows from the server', () => {
    const res = applyRemote(emptyData(), [
      { key: 'e:x', value: { id: 'x' }, deleted: false, updated_at: 5 },
      { key: 'l:no-es-fecha', value: { h: 1 }, deleted: false, updated_at: 5 },
      { key: 'n:2026-10-26', value: 'ok', deleted: false, updated_at: 5 },
    ])
    expect(res.data.events).toEqual([])
    expect(res.data.notes).toEqual({ '2026-10-26': 'ok' })
  })
})

describe('account switching', () => {
  it('adopts never-synced data and clears data owned by another account', async () => {
    const { adoptAccount } = await import('@shared/sync')
    expect(adoptAccount(emptySyncState(), 'a')).toEqual({ state: { userId: 'a', cursor: null, pushed: {} }, clearLocal: false })
    const owned = { userId: 'a', cursor: 'x', pushed: { 'e:1': 5 } }
    expect(adoptAccount(owned, 'a')).toEqual({ state: owned, clearLocal: false })
    expect(adoptAccount(owned, 'b')).toEqual({ state: { userId: 'b', cursor: null, pushed: {} }, clearLocal: true })
  })
})
