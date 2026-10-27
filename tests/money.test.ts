import { describe, expect, it } from 'vitest'
import { accountBalance, duePayments, fmtMoney, monthTotals, monthlyCost, nextPayment, parseMoney, paymentsBetween } from '@shared/money'
import { applyCommand } from '@shared/reducer'
import { emptyData } from '@shared/model'
import type { Account, Subscription, Transaction } from '@shared/model'
import { applyRemote, emptySyncState, pendingRows } from '@shared/sync'
import { remindersBetween } from '@shared/reminders'

const sub = (p: Partial<Subscription>): Subscription => ({
  id: 'n', name: 'Netflix', cents: 4_490_000, cycle: 'mensual', anchor: '2026-01-31', color: 'magenta', remindDays: 1, autoLog: true, active: true, createdAt: 0, ...p,
})
const tx = (p: Partial<Transaction>): Transaction => ({ id: 't', date: '2026-10-05', kind: 'gasto', cents: 100, cat: 'comida', note: '', createdAt: 0, ...p })

describe('amounts', () => {
  it('reads what people type', () => {
    expect(parseMoney('1.250.000', 'COP')).toBe(125_000_000)
    expect(parseMoney('$ 3000', 'COP')).toBe(300_000)
    expect(parseMoney('12,5', 'COP')).toBe(1_300)
    expect(parseMoney('12,50', 'USD')).toBe(1_250)
    expect(parseMoney('1,234.56', 'USD')).toBe(123_456)
    expect(parseMoney('1.234,56', 'EUR')).toBe(123_456)
    expect(parseMoney('abc', 'COP')).toBeNull()
  })

  it('writes amounts in Spanish notation', () => {
    expect(fmtMoney(125_000_000, 'COP').replace(/\s/g, ' ')).toBe('$ 1.250.000')
    expect(fmtMoney(-5_000, 'COP')).toMatch(/^−\$/)
  })
})

describe('subscriptions', () => {
  it('keeps the payment day, or the last day of shorter months', () => {
    expect(paymentsBetween(sub({}), '2026-01-01', '2026-04-30')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
    expect(paymentsBetween(sub({ cycle: 'semanal', anchor: '2026-10-05' }), '2026-10-10', '2026-10-31')).toEqual(['2026-10-12', '2026-10-19', '2026-10-26'])
    expect(paymentsBetween(sub({ cycle: 'anual', anchor: '2024-03-15' }), '2026-01-01', '2026-12-31')).toEqual(['2026-03-15'])
    expect(nextPayment(sub({ anchor: '2026-01-15' }), '2026-10-27')).toBe('2026-11-15')
  })

  it('works out the monthly cost of every cycle', () => {
    expect(monthlyCost(sub({ cycle: 'anual', cents: 1_200 }))).toBe(100)
    expect(monthlyCost(sub({ cycle: 'semanal', cents: 1_200 }))).toBe(5_200)
  })

  it('records each payment once, with an id that is the same on every device', () => {
    let data = { ...emptyData(), subscriptions: [sub({ anchor: '2026-09-10', loggedThrough: '2026-09-09' })] }
    const first = duePayments(data, '2026-10-27')
    expect(first.txs.map(t => t.date)).toEqual(['2026-09-10', '2026-10-10'])
    for (const t of first.txs) data = applyCommand(data, { type: 'tx.upsert', item: t, at: 1 })
    data = applyCommand(data, { type: 'sub.upsert', item: { ...first.done[0]!.sub, loggedThrough: first.done[0]!.through }, at: 2 })
    expect(duePayments(data, '2026-10-27').txs).toEqual([])
    const other = duePayments({ ...emptyData(), subscriptions: [sub({ anchor: '2026-09-10', loggedThrough: '2026-09-09' })] }, '2026-10-27')
    expect(other.txs.map(t => t.id)).toEqual(first.txs.map(t => t.id))
  })

  it('warns the morning before a payment', () => {
    const data = { ...emptyData(), subscriptions: [sub({ anchor: '2026-10-28' })] }
    const from = new Date(2026, 9, 27, 0, 0).getTime()
    const to = new Date(2026, 9, 27, 23, 0).getTime()
    const r = remindersBetween(data, from, to)
    expect(r).toHaveLength(1)
    expect(r[0]!.body).toContain('mañana')
  })
})

describe('totals and sync', () => {
  it('adds up a month and an account', () => {
    const txs = [tx({ cents: 500 }), tx({ id: 'b', kind: 'ingreso', cat: 'salario', cents: 2_000, accountId: 'a' }), tx({ id: 'c', cents: 300, accountId: 'a', cat: 'ocio' })]
    const m = monthTotals(txs, '2026-10')
    expect([m.income, m.expense, m.byCat.get('comida')]).toEqual([2_000, 800, 500])
    const acc: Account = { id: 'a', name: 'Débito', kind: 'debito', color: 'cobalt', initial: 1_000, createdAt: 0 }
    expect(accountBalance(acc, txs)).toBe(2_700)
  })

  it('syncs movements, subscriptions, accounts, goals and budgets', () => {
    let a = emptyData()
    a = applyCommand(a, { type: 'tx.upsert', item: tx({}), at: 1 })
    a = applyCommand(a, { type: 'sub.upsert', item: sub({}), at: 2 })
    a = applyCommand(a, { type: 'account.upsert', item: { id: 'a', name: 'Nequi', kind: 'debito', color: 'violet', initial: 0, createdAt: 0 }, at: 3 })
    a = applyCommand(a, { type: 'goal.upsert', item: { id: 'g', name: 'Viaje', target: 100, saved: 10, color: 'green', createdAt: 0 }, at: 4 })
    a = applyCommand(a, { type: 'budgets.set', budgets: { comida: 50_000 }, at: 5 })
    const b = applyRemote(emptyData(), pendingRows(a, emptySyncState())).data
    expect([b.transactions, b.subscriptions, b.accounts, b.goals, b.budgets]).toEqual([a.transactions, a.subscriptions, a.accounts, a.goals, a.budgets])
    a = applyCommand(a, { type: 'tx.delete', id: 't', at: 6 })
    const c = applyRemote(b, pendingRows(a, emptySyncState()).filter(r => r.key === 't:t')).data
    expect(c.transactions).toEqual([])
  })
})
