import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import type { FinCat, Goal, Transaction } from '@shared/model'
import { ACCOUNT_KIND_ICON, ACCOUNT_KIND_LABEL, CYCLE_LABEL, EXPENSE_CATS, FIN_CAT_ICON, FIN_CAT_INK, FIN_CAT_LABEL } from '@shared/constants'
import { DAYS, MONTHS, MONTHS_SHORT, addMonths, fromIso, toIso, weekday } from '@shared/dates'
import { accountBalance, fmtMoney, moneyInput, monthTotals, monthlyCost, nextPayment, parseMoney } from '@shared/money'
import { useStore } from '@/state/store'
import { useCurrency, useToday } from '@/state/hooks'
import { burst, celebrate } from '@/lib/fx'
import { Icon, Ring, SPRING, Segmented, cx } from '@/components/primitives'
import { FinBadge, FinIcon } from '@/components/FinIcon'

type Tab = 'moves' | 'budget' | 'subs' | 'accounts' | 'goals'
const TABS: ReadonlyArray<{ value: Tab; label: string }> = [
  { value: 'moves', label: 'Movimientos' },
  { value: 'budget', label: 'Presupuesto' },
  { value: 'subs', label: 'Suscripciones' },
  { value: 'accounts', label: 'Cuentas' },
  { value: 'goals', label: 'Metas' },
]
let lastTab: Tab = 'moves'

/** An amount that counts up to its new value. */
export function AnimatedMoney({ cents, sign }: { cents: number; sign?: boolean }) {
  const currency = useCurrency()
  const mv = useMotionValue(0)
  const spring = useSpring(mv, { stiffness: 90, damping: 20 })
  const text = useTransform(spring, v => fmtMoney(Math.round(v), currency, { sign }))
  useEffect(() => {
    mv.set(cents)
  }, [mv, cents])
  return <motion.span className="num">{text}</motion.span>
}

const daysUntil = (from: string, to: string): number => Math.round((fromIso(to).getTime() - fromIso(from).getTime()) / 864e5)
const whenText = (n: number): string => (n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : `En ${n} días`)

// ---------- Charts ----------

function Donut({ parts, total }: { parts: Array<{ cat: FinCat; cents: number }>; total: number }) {
  const r = 52
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <svg className="donut" viewBox="0 0 140 140" aria-hidden="true">
      <circle cx="70" cy="70" r={r} className="donut-track" />
      {parts.map((p, i) => {
        const len = total ? (p.cents / total) * c : 0
        const el = (
          <motion.circle
            key={p.cat}
            cx="70"
            cy="70"
            r={r}
            style={{ stroke: `var(--${FIN_CAT_INK[p.cat]})` }}
            strokeDasharray={`${Math.max(0, len - 2)} ${c}`}
            initial={{ strokeDashoffset: c, opacity: 0 }}
            animate={{ strokeDashoffset: -offset, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 70, damping: 16, delay: 0.1 + i * 0.06 }}
            transform="rotate(-90 70 70)"
          />
        )
        offset += len
        return el
      })}
    </svg>
  )
}

function MonthBars({ txs, month }: { txs: readonly Transaction[]; month: string }) {
  const currency = useCurrency()
  const months = useMemo(() => Array.from({ length: 6 }, (_, i) => toIso(addMonths(fromIso(`${month}-01`), i - 5)).slice(0, 7)), [month])
  const totals = months.map(m => monthTotals(txs, m))
  const max = Math.max(1, ...totals.flatMap(t => [t.income, t.expense]))
  return (
    <div className="mbars">
      {months.map((m, i) => (
        <div key={m} className={cx('mbar', m === month && 'is-current')} title={`Ingresos ${fmtMoney(totals[i]!.income, currency)} · Gastos ${fmtMoney(totals[i]!.expense, currency)}`}>
          <div className="mbar-pair">
            <motion.span className="mb-in" initial={{ scaleY: 0 }} animate={{ scaleY: totals[i]!.income / max }} transition={{ type: 'spring', stiffness: 150, damping: 18, delay: i * 0.05 }} />
            <motion.span className="mb-out" initial={{ scaleY: 0 }} animate={{ scaleY: totals[i]!.expense / max }} transition={{ type: 'spring', stiffness: 150, damping: 18, delay: 0.08 + i * 0.05 }} />
          </div>
          <span>{MONTHS_SHORT[fromIso(`${m}-01`).getMonth()]}</span>
        </div>
      ))}
    </div>
  )
}

// ---------- Tabs ----------

function Moves({ month }: { month: string }) {
  const txs = useStore(s => s.data!.transactions)
  const accounts = useStore(s => s.data!.accounts)
  const openSheet = useStore(s => s.openSheet)
  const currency = useCurrency()
  const [filter, setFilter] = useState<'all' | Transaction['kind']>('all')
  const [query, setQuery] = useState('')
  const totals = monthTotals(txs, month)
  const parts = [...totals.byCat].map(([cat, cents]) => ({ cat: cat as FinCat, cents })).sort((a, b) => b.cents - a.cents)
  const q = query.trim().toLowerCase()
  const list = txs
    .filter(t => t.date.startsWith(month) && (filter === 'all' || t.kind === filter))
    .filter(t => !q || `${t.note} ${FIN_CAT_LABEL[t.cat]}`.toLowerCase().includes(q))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  const days = [...new Set(list.map(t => t.date))]
  const accountName = (id?: string): string | undefined => accounts.find(a => a.id === id)?.name

  return (
    <>
      <div className="money-grid">
        <section className="panel">
          <header className="panel-head"><h3>Gastos por categoría</h3></header>
          {parts.length ? (
            <div className="donut-wrap">
              <div className="donut-box">
                <Donut parts={parts} total={totals.expense} />
                <span className="donut-center"><b><AnimatedMoney cents={totals.expense} /></b><span>gastado</span></span>
              </div>
              <ul className="legend">
                {parts.map((p, i) => (
                  <motion.li key={p.cat} style={{ '--c': `var(--${FIN_CAT_INK[p.cat]})` } as CSSProperties} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0, transition: { delay: 0.15 + i * 0.05 } }}>
                    <FinBadge name={FIN_CAT_ICON[p.cat]} size="s" />
                    <span>{FIN_CAT_LABEL[p.cat]}</span>
                    <b>{fmtMoney(p.cents, currency)}</b>
                    <em>{Math.round((p.cents / totals.expense) * 100)}%</em>
                  </motion.li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="empty">Aún no hay gastos este mes.</p>
          )}
        </section>
        <section className="panel">
          <header className="panel-head">
            <h3>Últimos 6 meses</h3>
            <span className="mb-legend"><i className="in" />Ingresos <i className="out" />Gastos</span>
          </header>
          <MonthBars txs={txs} month={month} />
        </section>
      </div>

      <section className="panel moves">
        <header className="panel-head moves-head">
          <Segmented label="Filtrar" layoutId="tx-filter" size="s" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Todos' }, { value: 'gasto', label: 'Gastos' }, { value: 'ingreso', label: 'Ingresos' }]} />
          <label className="jv-search small">{Icon.search}<input value={query} placeholder="Buscar…" onChange={e => setQuery(e.target.value)} aria-label="Buscar movimientos" /></label>
        </header>
        {days.length ? (
          days.map(d => (
            <div key={d} className="tx-day">
              <span className="tx-date">{DAYS[weekday(fromIso(d))]} {fromIso(d).getDate()}</span>
              <ul className="tx-list">
                <AnimatePresence initial={false}>
                  {list.filter(t => t.date === d).map(t => (
                    <motion.li
                      key={t.id}
                      layout
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      style={{ '--c': `var(--${FIN_CAT_INK[t.cat]})` } as CSSProperties}
                    >
                      <button type="button" className="tx-row" onClick={() => openSheet({ kind: 'tx', tx: t })}>
                        <span className="tx-cat"><FinBadge name={t.icon ?? FIN_CAT_ICON[t.cat]} />{FIN_CAT_LABEL[t.cat]}</span>
                        <span className="tx-note">{t.note}{t.subId && <span className="tag">Suscripción</span>}</span>
                        {accountName(t.accountId) && <span className="tx-acc">{accountName(t.accountId)}</span>}
                        <b className={cx('tx-amount', t.kind === 'ingreso' ? 'is-in' : 'is-out')}>{t.kind === 'ingreso' ? '+' : '−'}{fmtMoney(t.cents, currency)}</b>
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </div>
          ))
        ) : (
          <p className="empty">{q || filter !== 'all' ? 'Nada coincide.' : 'Sin movimientos este mes. Pulsa «Nuevo movimiento» para empezar.'}</p>
        )}
      </section>
    </>
  )
}

function BudgetRow({ cat, spent, limit, i }: { cat: FinCat; spent: number; limit?: number; i: number }) {
  const currency = useCurrency()
  const budgets = useStore(s => s.data!.budgets)
  const dispatch = useStore(s => s.dispatch)
  const [text, setText] = useState(limit ? moneyInput(limit, currency) : '')
  useEffect(() => setText(limit ? moneyInput(limit, currency) : ''), [limit, currency])
  const save = (): void => {
    const cents = parseMoney(text, currency) ?? 0
    if (cents === (limit ?? 0)) return
    const next = { ...budgets }
    if (cents) next[cat] = cents
    else delete next[cat]
    dispatch({ type: 'budgets.set', budgets: next })
  }
  const v = limit ? spent / limit : 0
  const state = !limit ? '' : v >= 1 ? 'is-over' : v >= 0.8 ? 'is-near' : 'is-ok'
  return (
    <motion.li className={cx('budget-row', state)} style={{ '--c': `var(--${FIN_CAT_INK[cat]})` } as CSSProperties} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.03 } }}>
      <span className="br-name"><FinBadge name={FIN_CAT_ICON[cat]} size="s" />{FIN_CAT_LABEL[cat]}</span>
      <span className="br-track">
        <motion.span className="br-fill" initial={{ scaleX: 0 }} animate={{ scaleX: Math.min(1, limit ? v : 0) }} transition={{ type: 'spring', stiffness: 120, damping: 18, delay: 0.1 + i * 0.03 }} />
      </span>
      <span className="br-spent">{fmtMoney(spent, currency)}</span>
      <input className="br-limit" inputMode="decimal" placeholder="Sin límite" value={text} onChange={e => setText(e.target.value)} onBlur={save} onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} aria-label={`Límite de ${FIN_CAT_LABEL[cat]}`} />
    </motion.li>
  )
}

function Budget({ month }: { month: string }) {
  const txs = useStore(s => s.data!.transactions)
  const budgets = useStore(s => s.data!.budgets)
  const totals = monthTotals(txs, month)
  const limitSum = Object.values(budgets).reduce((a, b) => a + (b ?? 0), 0)
  const spentInBudget = EXPENSE_CATS.filter(c => budgets[c]).reduce((a, c) => a + (totals.byCat.get(c) ?? 0), 0)
  return (
    <section className="panel">
      <header className="panel-head">
        <h3>Presupuesto del mes</h3>
        {limitSum > 0 && <span className="count"><AnimatedMoney cents={spentInBudget} /> de <AnimatedMoney cents={limitSum} /></span>}
      </header>
      <p className="hint">Escribe un límite mensual para cada categoría. La barra se pone ámbar al 80 % y roja si te pasas.</p>
      <ul className="budget-list">
        {EXPENSE_CATS.map((c, i) => <BudgetRow key={c} cat={c} i={i} spent={totals.byCat.get(c) ?? 0} limit={budgets[c]} />)}
      </ul>
    </section>
  )
}

function Subs() {
  const subs = useStore(s => s.data!.subscriptions)
  const openSheet = useStore(s => s.openSheet)
  const currency = useCurrency()
  const today = useToday()
  const active = subs.filter(s => s.active)
  const perMonth = active.reduce((n, s) => n + monthlyCost(s), 0)
  const sorted = [...subs].map(s => ({ s, next: nextPayment(s, today) })).sort((a, b) => Number(b.s.active) - Number(a.s.active) || a.next.localeCompare(b.next))
  return (
    <>
      <div className="tiles three">
        <div className="tile"><span className="tile-label">Al mes</span><b className="big-money"><AnimatedMoney cents={perMonth} /></b><span className="tile-sub">{active.length} activas</span></div>
        <div className="tile"><span className="tile-label">Al año</span><b className="big-money"><AnimatedMoney cents={perMonth * 12} /></b><span className="tile-sub">Si nada cambia</span></div>
        <div className="tile"><span className="tile-label">Próximo cobro</span>
          {sorted[0]?.s.active ? <><b className="big-money">{sorted[0].s.name}</b><span className="tile-sub">{whenText(daysUntil(today, sorted[0].next))} · {fmtMoney(sorted[0].s.cents, currency)}</span></> : <span className="tile-sub">Ninguno</span>}
        </div>
      </div>
      <section className="panel">
        <header className="panel-head">
          <h3>Tus suscripciones</h3>
          <button type="button" className="btn small" onClick={() => openSheet({ kind: 'sub' })}>{Icon.plus}Añadir</button>
        </header>
        {sorted.length ? (
          <ul className="sub-list">
            <AnimatePresence initial={false}>
              {sorted.map(({ s, next }, i) => {
                const n = daysUntil(today, next)
                return (
                  <motion.li key={s.id} layout className={cx(!s.active && 'is-off')} style={{ '--c': `var(--${s.color})` } as CSSProperties} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04 } }} exit={{ opacity: 0, scale: 0.96 }}>
                    <button type="button" className="sub-row" onClick={() => openSheet({ kind: 'sub', sub: s })}>
                      <span className="sub-avatar">{s.icon ? <FinIcon name={s.icon} /> : s.name.charAt(0).toUpperCase()}</span>
                      <span className="sub-main">
                        <b>{s.name}</b>
                        <span>{CYCLE_LABEL[s.cycle]}{s.autoLog ? ' · se registra solo' : ''}{!s.active ? ' · pausada' : ''}</span>
                      </span>
                      {s.active && (
                        <span className={cx('sub-when', n <= 3 && 'is-soon')}>
                          <b>{whenText(n)}</b>
                          <span>{fromIso(next).getDate()} {MONTHS_SHORT[fromIso(next).getMonth()]}</span>
                        </span>
                      )}
                      <b className="sub-amount">{fmtMoney(s.cents, currency)}</b>
                    </button>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        ) : (
          <div className="empty">
            <p>Añade Netflix, Spotify, el gimnasio o cualquier pago que se repita. Verás el día de cobro en el calendario y te avisaré antes.</p>
            <button type="button" className="btn primary" onClick={() => openSheet({ kind: 'sub' })}>{Icon.plus}Añadir suscripción</button>
          </div>
        )}
      </section>
    </>
  )
}

function Accounts() {
  const accounts = useStore(s => s.data!.accounts)
  const txs = useStore(s => s.data!.transactions)
  const openSheet = useStore(s => s.openSheet)
  const total = accounts.reduce((n, a) => n + accountBalance(a, txs), 0)
  return (
    <section className="panel">
      <header className="panel-head">
        <h3>Cuentas y tarjetas</h3>
        {accounts.length > 0 && <span className="count">Total: <AnimatedMoney cents={total} /></span>}
      </header>
      <div className="acc-grid">
        {accounts.map((a, i) => {
          const b = accountBalance(a, txs)
          return (
            <motion.button
              key={a.id}
              type="button"
              className="acc-card"
              style={{ '--c': `var(--${a.color})` } as CSSProperties}
              onClick={() => openSheet({ kind: 'wallet', wallet: a })}
              initial={{ opacity: 0, y: 14, rotate: -1 }}
              animate={{ opacity: 1, y: 0, rotate: 0, transition: { ...SPRING, delay: i * 0.05 } }}
              whileHover={{ y: -4, rotate: -0.6 }}
              whileTap={{ scale: 0.97 }}
            >
              <span className="acc-kind">{ACCOUNT_KIND_LABEL[a.kind]}</span>
              <b className="acc-name">{a.name}</b>
              <span className={cx('acc-balance', b < 0 && 'is-neg')}><AnimatedMoney cents={b} /></span>
              <span className="acc-icon" aria-hidden="true"><FinIcon name={a.icon ?? ACCOUNT_KIND_ICON[a.kind]} /></span>
            </motion.button>
          )
        })}
        <motion.button type="button" className="acc-card is-new" onClick={() => openSheet({ kind: 'wallet' })} whileHover={{ y: -4 }} whileTap={{ scale: 0.97 }}>
          {Icon.plus}<span>Añadir cuenta o tarjeta</span>
        </motion.button>
      </div>
    </section>
  )
}

function GoalCard({ g, i }: { g: Goal; i: number }) {
  const dispatch = useStore(s => s.dispatch)
  const openSheet = useStore(s => s.openSheet)
  const notify = useStore(s => s.notify)
  const currency = useCurrency()
  const today = useToday()
  const [adding, setAdding] = useState('')
  const v = g.target ? g.saved / g.target : 0
  const monthsLeft = g.deadline ? Math.max(1, Math.ceil(daysUntil(today, g.deadline) / 30)) : 0
  const perMonth = monthsLeft && g.saved < g.target ? Math.ceil((g.target - g.saved) / monthsLeft) : 0
  const add = (el: Element): void => {
    const cents = parseMoney(adding, currency)
    if (!cents) return
    const saved = g.saved + cents
    dispatch({ type: 'goal.upsert', item: { ...g, saved } })
    setAdding('')
    burst(el, `var(--${g.color})`)
    if (saved >= g.target && g.saved < g.target) {
      window.setTimeout(() => {
        celebrate()
        notify(`¡Meta cumplida: ${g.name}!`)
      }, 250)
    }
  }
  return (
    <motion.div className="goal-card" style={{ '--c': `var(--${g.color})` } as CSSProperties} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0, transition: { ...SPRING, delay: i * 0.06 } }}>
      <button type="button" className="goal-head" onClick={() => openSheet({ kind: 'goal', goal: g })}>
        <Ring value={v} size={64} stroke={6} color={`var(--${g.color})`}><FinIcon name={g.icon ?? 'alcancia'} className="goal-ico" /></Ring>
        <span className="goal-text">
          <b>{g.name} <em className="goal-pct">{Math.min(100, Math.round(v * 100))}%</em></b>
          <span><AnimatedMoney cents={g.saved} /> de {fmtMoney(g.target, currency)}</span>
          {g.deadline && <span>{perMonth ? `Ahorra ${fmtMoney(perMonth, currency)} al mes hasta ${MONTHS[fromIso(g.deadline).getMonth()]}` : `Para el ${fromIso(g.deadline).getDate()} de ${MONTHS[fromIso(g.deadline).getMonth()]}`}</span>}
        </span>
      </button>
      <form className="goal-add" onSubmit={e => { e.preventDefault(); add(e.currentTarget) }}>
        <input inputMode="decimal" value={adding} placeholder="Añadir ahorro" onChange={e => setAdding(e.target.value)} aria-label={`Añadir ahorro a ${g.name}`} />
        <button type="submit" className="btn small" disabled={!parseMoney(adding, currency)}>{Icon.plus}</button>
      </form>
    </motion.div>
  )
}

function Goals() {
  const goals = useStore(s => s.data!.goals)
  const openSheet = useStore(s => s.openSheet)
  return (
    <section className="panel">
      <header className="panel-head">
        <h3>Metas de ahorro</h3>
        <button type="button" className="btn small" onClick={() => openSheet({ kind: 'goal' })}>{Icon.plus}Nueva meta</button>
      </header>
      {goals.length ? (
        <div className="goal-grid">{goals.map((g, i) => <GoalCard key={g.id} g={g} i={i} />)}</div>
      ) : (
        <p className="empty">Ponle nombre a lo que quieres juntar, por ejemplo un viaje o un fondo de emergencia, y ve sumando lo que ahorras.</p>
      )}
    </section>
  )
}

export function MoneyView() {
  const date = useStore(s => s.date)
  const txs = useStore(s => s.data!.transactions)
  const subs = useStore(s => s.data!.subscriptions)
  const month = date.slice(0, 7)
  const [tab, setTab] = useState<Tab>(lastTab)
  const totals = monthTotals(txs, month)
  const balance = totals.income - totals.expense
  const perMonth = subs.filter(s => s.active).reduce((n, s) => n + monthlyCost(s), 0)
  const choose = (t: Tab): void => {
    lastTab = t
    setTab(t)
  }

  return (
    <div className="money">
      <div className="tiles four">
        <motion.div className="tile" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: 0 }}>
          <span className="tile-label">Ingresos</span><b className="big-money is-in"><AnimatedMoney cents={totals.income} /></b>
        </motion.div>
        <motion.div className="tile" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: 0.05 }}>
          <span className="tile-label">Gastos</span><b className="big-money is-out"><AnimatedMoney cents={totals.expense} /></b>
        </motion.div>
        <motion.div className="tile" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: 0.1 }}>
          <span className="tile-label">Balance del mes</span><b className={cx('big-money', balance < 0 ? 'is-out' : 'is-in')}><AnimatedMoney cents={balance} sign /></b>
        </motion.div>
        <motion.div className="tile" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: 0.15 }}>
          <span className="tile-label">Suscripciones al mes</span><b className="big-money"><AnimatedMoney cents={perMonth} /></b>
        </motion.div>
      </div>

      <Segmented label="Sección" layoutId="money-tab" value={tab} onChange={choose} options={TABS} />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          className="money-pane"
          initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transition: { type: 'spring', stiffness: 260, damping: 26 } }}
          exit={{ opacity: 0, y: -6, transition: { duration: 0.14 } }}
        >
          {tab === 'moves' && <Moves month={month} />}
          {tab === 'budget' && <Budget month={month} />}
          {tab === 'subs' && <Subs />}
          {tab === 'accounts' && <Accounts />}
          {tab === 'goals' && <Goals />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
