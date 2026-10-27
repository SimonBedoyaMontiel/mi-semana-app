/**
 * Money helpers shared by the interface and the main process. Amounts are integer cents, so sums
 * never pick up floating-point dust.
 */
import type { Account, AppData, Subscription, Transaction } from './model'
import { WHOLE_CURRENCIES } from './constants'
import { addDays, addMonths, fromIso, toIso } from './dates'

const formatters = new Map<string, Intl.NumberFormat>()

/** "$ 1.250.000", "US$ 12,50"… in Spanish notation. */
export function fmtMoney(cents: number, currency: string, opts: { sign?: boolean; compact?: boolean } = {}): string {
  const whole = WHOLE_CURRENCIES.has(currency)
  const key = `${currency}${opts.compact ? 'c' : ''}`
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: whole || opts.compact ? 0 : 2,
      maximumFractionDigits: whole || opts.compact ? 0 : 2,
      ...(opts.compact ? { notation: 'compact' as const } : {}),
    })
    formatters.set(key, f)
  }
  const text = f.format(Math.abs(cents) / 100)
  if (cents < 0) return `−${text}`
  return opts.sign && cents > 0 ? `+${text}` : text
}

/**
 * Reads what a person types: "1.250.000", "1250000", "12,50", "12.5", "$ 3.000". Returns cents,
 * or null if it is not an amount.
 */
export function parseMoney(raw: string, currency: string): number | null {
  const s = raw.replace(/[^\d.,]/g, '')
  if (!/\d/.test(s)) return null
  if (WHOLE_CURRENCIES.has(currency)) {
    // Separators are thousands, except a single one followed by one or two digits ("12,5"), which is rounded.
    const parts = s.split(/[.,]/)
    const n = parts.length === 2 && parts[1]!.length <= 2 ? Math.round(Number(`${parts[0]}.${parts[1]}`)) : Number(parts.join(''))
    return Number.isFinite(n) ? n * 100 : null
  }
  const lastSep = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','))
  let int = s
  let dec = ''
  if (lastSep >= 0 && s.length - lastSep - 1 <= 2) {
    int = s.slice(0, lastSep)
    dec = s.slice(lastSep + 1)
  }
  const n = Number(int.replace(/[.,]/g, '') || '0')
  if (!Number.isFinite(n)) return null
  return n * 100 + Number(dec.padEnd(2, '0') || '0')
}

/** Text for an amount input: no symbol, separators as the person would type them. */
export function moneyInput(cents: number, currency: string): string {
  if (!cents) return ''
  const whole = WHOLE_CURRENCIES.has(currency)
  return new Intl.NumberFormat('es-CO', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(cents / 100)
}

// ---------- Subscriptions ----------

/** Payment dates of a subscription within [from, to], starting at its anchor. */
export function paymentsBetween(sub: Subscription, from: string, to: string): string[] {
  const out: string[] = []
  if (to < sub.anchor) return out
  const anchor = fromIso(sub.anchor)
  if (sub.cycle === 'semanal') {
    const skip = Math.max(0, Math.floor((fromIso(from).getTime() - anchor.getTime()) / (7 * 864e5)))
    for (let d = addDays(anchor, skip * 7); toIso(d) <= to; d = addDays(d, 7)) if (toIso(d) >= from) out.push(toIso(d))
    return out
  }
  const step = sub.cycle === 'anual' ? 12 : 1
  const start = fromIso(from)
  let k = Math.max(0, Math.floor(((start.getFullYear() - anchor.getFullYear()) * 12 + start.getMonth() - anchor.getMonth()) / step) - 1)
  for (;; k++) {
    // addMonths keeps the anchor's day, or the month's last day when it is shorter (31 → 30, 28…).
    const iso = toIso(addMonths(anchor, k * step))
    if (iso > to) break
    if (iso >= from) out.push(iso)
  }
  return out
}

/** Next payment on or after `today`. */
export function nextPayment(sub: Subscription, today: string): string {
  const horizon = toIso(addDays(fromIso(today), sub.cycle === 'anual' ? 370 : 40))
  return paymentsBetween(sub, today, horizon)[0] ?? sub.anchor
}

/** What a subscription costs per month, whatever its cycle. */
export function monthlyCost(sub: Subscription): number {
  return sub.cycle === 'mensual' ? sub.cents : sub.cycle === 'anual' ? Math.round(sub.cents / 12) : Math.round((sub.cents * 52) / 12)
}

/** Every subscription payment in [from, to], by date. */
export function subscriptionsByDate(subs: readonly Subscription[], from: string, to: string): Map<string, Subscription[]> {
  const map = new Map<string, Subscription[]>()
  for (const s of subs) {
    if (!s.active) continue
    for (const d of paymentsBetween(s, from, to)) map.set(d, [...(map.get(d) ?? []), s])
  }
  return map
}

/** Id of the expense a subscription records for one payment: the same on every device, so it is never doubled. */
export const subTxId = (subId: string, date: string): string => `s${subId}${date.replace(/-/g, '')}`.slice(0, 64)

/**
 * Payments due up to `today` that have not been recorded yet, for subscriptions that record their
 * own payments. Returns the expenses to add and how far each subscription is now recorded.
 */
export function duePayments(data: AppData, today: string): { txs: Transaction[]; done: Array<{ sub: Subscription; through: string }> } {
  const txs: Transaction[] = []
  const done: Array<{ sub: Subscription; through: string }> = []
  const have = new Set(data.transactions.map(t => t.id))
  for (const sub of data.subscriptions) {
    if (!sub.active || !sub.autoLog || (sub.loggedThrough && sub.loggedThrough >= today)) continue
    const from = sub.loggedThrough ? toIso(addDays(fromIso(sub.loggedThrough), 1)) : sub.anchor
    for (const date of paymentsBetween(sub, from, today)) {
      const id = subTxId(sub.id, date)
      if (have.has(id)) continue
      txs.push({
        id, date, kind: 'gasto', cents: sub.cents, cat: 'suscripciones', note: sub.name, subId: sub.id, createdAt: fromIso(date).getTime(),
        ...(sub.accountId ? { accountId: sub.accountId } : {}),
      })
    }
    done.push({ sub, through: today })
  }
  return { txs, done }
}

// ---------- Totals ----------

/** Current balance of an account: its starting amount plus what came in, minus what went out. */
export function accountBalance(account: Account, txs: readonly Transaction[]): number {
  let b = account.initial
  for (const t of txs) if (t.accountId === account.id) b += t.kind === 'ingreso' ? t.cents : -t.cents
  return b
}

export interface MonthTotals {
  income: number
  expense: number
  byCat: Map<string, number>
}

/** Income, spending and spending per category for a month ("YYYY-MM"). */
export function monthTotals(txs: readonly Transaction[], month: string): MonthTotals {
  let income = 0
  let expense = 0
  const byCat = new Map<string, number>()
  for (const t of txs) {
    if (!t.date.startsWith(month)) continue
    if (t.kind === 'ingreso') income += t.cents
    else {
      expense += t.cents
      byCat.set(t.cat, (byCat.get(t.cat) ?? 0) + t.cents)
    }
  }
  return { income, expense, byCat }
}
