import { describe, expect, it } from 'vitest'
import { applyCommand } from '@shared/reducer'
import { emptyData } from '@shared/model'
import type { AppData } from '@shared/model'
import { sanitize } from '@shared/sanitize'
import { SYNC_KINDS, SyncEngine, applyRemote, emptySyncState, pendingRows } from '@shared/sync'
import type { RecordRow, SyncState } from '@shared/sync'
import { mergeBackup, parseBackup, toBackupFile } from '@shared/backup'

const entry = { mood: 4, energy: 'alta' as const, gratitude: ['Café', 'Sol'], answer: 'Mucho' }

describe('journal and productivity records', () => {
  it('sets and clears a day of journal, stamping it for sync', () => {
    let d = applyCommand(emptyData(), { type: 'journal.set', date: '2026-10-26', entry, at: 10 })
    expect(d.journal['2026-10-26']).toEqual(entry)
    expect(d.stamps['j:2026-10-26']).toBe(10)
    d = applyCommand(d, { type: 'journal.set', date: '2026-10-26', entry: null, at: 20 })
    expect(d.journal['2026-10-26']).toBeUndefined()
    expect(pendingRows(d, emptySyncState()).find(r => r.key === 'j:2026-10-26')?.value).toBeNull()
  })

  it('keeps priorities, focus blocks, reviews and the inbox', () => {
    let d = emptyData()
    d = applyCommand(d, { type: 'priorities.set', date: '2026-10-26', items: [{ id: 'a', text: 'Informe', done: false }], at: 1 })
    d = applyCommand(d, { type: 'focus.add', date: '2026-10-26', session: { id: 'f1', start: 5, minutes: 25, label: 'Informe' }, at: 2 })
    d = applyCommand(d, { type: 'focus.add', date: '2026-10-26', session: { id: 'f1', start: 5, minutes: 25, label: 'Informe' }, at: 3 })
    d = applyCommand(d, { type: 'review.set', week: '2026-10-26', review: { good: 'Todo', improve: '', next: '' }, at: 4 })
    d = applyCommand(d, { type: 'inbox.upsert', item: { id: 'i1', text: 'Llamar', createdAt: 1 }, at: 5 })
    expect(d.priorities['2026-10-26']).toHaveLength(1)
    expect(d.focus['2026-10-26']).toHaveLength(1)
    expect(d.reviews['2026-10-26']?.good).toBe('Todo')
    d = applyCommand(d, { type: 'inbox.delete', id: 'i1', at: 6 })
    expect(d.inbox).toEqual([])
    expect(d.tombs['i:i1']).toBe(6)
  })

  it('travels to another device through sync rows', () => {
    let a = emptyData()
    a = applyCommand(a, { type: 'journal.set', date: '2026-10-26', entry, at: 10 })
    a = applyCommand(a, { type: 'priorities.set', date: '2026-10-26', items: [{ id: 'x', text: 'Correr', done: true }], at: 11 })
    a = applyCommand(a, { type: 'inbox.upsert', item: { id: 'i1', text: 'Llamar', createdAt: 1, priority: 'alta' }, at: 12 })
    const rows = pendingRows(a, emptySyncState())
    const b = applyRemote(emptyData(), rows).data
    expect(b.journal).toEqual(a.journal)
    expect(b.priorities).toEqual(a.priorities)
    expect(b.inbox).toEqual(a.inbox)
  })

  it('pulls everything again once after an update adds new kinds of records', async () => {
    const pulls: Array<string | null> = []
    let saved: SyncState = { cursor: '2026-10-01T00:00:00Z', pushed: {} }
    let data: AppData = emptyData()
    const engine = new SyncEngine(
      {
        pull: async c => {
          pulls.push(c)
          return [] as RecordRow[]
        },
        push: async () => undefined,
      },
      { get: () => data, replace: d => (data = d), loadState: () => saved, saveState: s => (saved = s) },
    )
    await engine.run()
    await engine.run()
    expect(pulls).toEqual([null, null])
    expect(saved.kinds).toBe(SYNC_KINDS)
  })

  it('loads old files without the new sections and drops damaged days only', () => {
    const d = sanitize({ ...emptyData(), journal: { '2026-10-26': entry, '2026-10-27': { mood: 9 } }, inbox: undefined, priorities: undefined })
    expect(Object.keys(d.journal)).toEqual(['2026-10-26'])
    expect(d.inbox).toEqual([])
    expect(d.settings.carryOver).toBe(true)
  })

  it('exports and imports the new sections without overwriting', () => {
    let a = applyCommand(emptyData(), { type: 'journal.set', date: '2026-10-26', entry, at: 1 })
    a = applyCommand(a, { type: 'inbox.upsert', item: { id: 'i1', text: 'Llamar', createdAt: 1 }, at: 2 })
    const local = applyCommand(emptyData(), { type: 'journal.set', date: '2026-10-26', entry: { gratitude: [], answer: 'Mío' }, at: 3 })
    const merged = mergeBackup(local, parseBackup(toBackupFile(a))).data
    expect(merged.journal['2026-10-26']?.answer).toBe('Mío')
    expect(merged.inbox).toHaveLength(1)
  })
})
