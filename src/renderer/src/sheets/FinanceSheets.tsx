import { useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Account, FinCat, FinIconName, Goal, Ink, Subscription, Transaction } from '@shared/model'
import {
  ACCOUNT_KINDS, ACCOUNT_KIND_ICON, ACCOUNT_KIND_LABEL, CYCLES, CYCLE_LABEL, EXPENSE_CATS, FIN_CAT_ICON, FIN_CAT_INK, FIN_CAT_LABEL, FIN_ICON_GROUPS, INCOME_CATS, INKS, INK_LABEL,
} from '@shared/constants'
import { addDays, fromIso, toIso, todayIso } from '@shared/dates'
import { fmtMoney, moneyInput, parseMoney } from '@shared/money'
import { useStore } from '@/state/store'
import { useCurrency } from '@/state/hooks'
import { burst, newId } from '@/lib/fx'
import { Sheet } from '@/components/Sheet'
import { Chip, Segmented, Switch, cx } from '@/components/primitives'
import { FinIcon } from '@/components/FinIcon'

/** Big amount field: type freely, see it formatted as you go. */
function MoneyField({ value, onChange, label, autoFocus, tone }: { value: string; onChange: (v: string) => void; label: string; autoFocus?: boolean; tone?: 'gasto' | 'ingreso' }) {
  const currency = useCurrency()
  const cents = parseMoney(value, currency)
  return (
    <label className={cx('money-field', tone && `is-${tone}`)}>
      <span>{label}</span>
      <input
        {...(autoFocus ? { 'data-autofocus': true } : {})}
        inputMode="decimal"
        value={value}
        placeholder="0"
        onChange={e => onChange(e.target.value)}
        aria-label={label}
      />
      <AnimatePresence initial={false}>
        {cents !== null && cents > 0 && (
          <motion.b key={cents} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {fmtMoney(cents, currency)}
          </motion.b>
        )}
      </AnimatePresence>
    </label>
  )
}

function InkPicker({ value, onChange }: { value: Ink; onChange: (v: Ink) => void }) {
  return (
    <div className="swatches">
      {INKS.map(k => (
        <motion.button
          key={k}
          type="button"
          className={cx('swatch', value === k && 'is-active')}
          style={{ '--c': `var(--${k})` } as CSSProperties}
          aria-label={INK_LABEL[k]}
          title={INK_LABEL[k]}
          whileHover={{ scale: 1.14 }}
          whileTap={{ scale: 0.88 }}
          onClick={() => onChange(k)}
        />
      ))}
    </div>
  )
}

/** Grid of icons by group. `fallback` is what shows when none is picked (the category's icon, or a letter). */
function IconPicker({ value, onChange, color, fallback, fallbackLabel }: {
  value?: FinIconName; onChange: (v?: FinIconName) => void; color: Ink; fallback: FinIconName | string; fallbackLabel: string
}) {
  const [open, setOpen] = useState(false)
  const shown = value ?? fallback
  return (
    <div className="field icon-field" style={{ '--c': `var(--${color})` } as CSSProperties}>
      <span>Icono</span>
      <button type="button" className={cx('icon-current', open && 'is-open')} onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <motion.span key={shown} className="fin-badge is-l is-solid" initial={{ scale: 0.4, rotate: -25 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 16 }}>
          {shown.length > 1 ? <FinIcon name={shown as FinIconName} /> : <b>{shown}</b>}
        </motion.span>
        <span className="icon-current-text">{value ? 'Toca para cambiarlo' : fallbackLabel}</span>
        <svg viewBox="0 0 24 24" className="ico icon-caret" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="icon-picker"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          >
            <div className="icon-picker-inner">
              {value && (
                <button type="button" className="link icon-reset" onClick={() => onChange(undefined)}>{fallbackLabel.replace(/^Usa/, 'Usar')}</button>
              )}
              {FIN_ICON_GROUPS.map((g, gi) => (
                <div key={g.label} className="icon-group">
                  <span>{g.label}</span>
                  <div className="icon-grid">
                    {g.icons.map((n, i) => (
                      <motion.button
                        key={n}
                        type="button"
                        className={cx('icon-opt', value === n && 'is-active')}
                        aria-label={n}
                        aria-pressed={value === n}
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 500, damping: 24, delay: gi * 0.04 + i * 0.012 } }}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.85 }}
                        onClick={() => { onChange(n); setOpen(false) }}
                      >
                        <FinIcon name={n} />
                      </motion.button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function AccountSelect({ value, onChange }: { value?: string; onChange: (v?: string) => void }) {
  const accounts = useStore(s => s.data!.accounts)
  if (!accounts.length) return null
  return (
    <label className="field">
      <span>Cuenta</span>
      <select value={value ?? ''} onChange={e => onChange(e.target.value || undefined)}>
        <option value="">Sin cuenta</option>
        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
    </label>
  )
}

function useForm() {
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(0)
  const fail = (msg: string): void => {
    setError(msg)
    setShake(n => n + 1)
  }
  const errorNode = (
    <AnimatePresence>
      {error && <motion.p className="error" role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{error}</motion.p>}
    </AnimatePresence>
  )
  return { fail, clear: () => setError(null), shake, errorNode }
}

const shakeAnim = (shake: number) => (shake ? { x: [0, -8, 8, -5, 5, 0] } : undefined)

// ---------- Movement ----------

export function TxSheet({ tx, preset }: { tx?: Transaction; preset?: Partial<Transaction> }) {
  const close = useStore(s => s.closeSheet)
  const dispatch = useStore(s => s.dispatch)
  const notify = useStore(s => s.notify)
  const currency = useCurrency()
  const [kind, setKind] = useState<Transaction['kind']>(tx?.kind ?? preset?.kind ?? 'gasto')
  const [amount, setAmount] = useState(tx ? moneyInput(tx.cents, currency) : '')
  const [cat, setCat] = useState<FinCat>(tx?.cat ?? preset?.cat ?? 'comida')
  const [date, setDate] = useState(tx?.date ?? preset?.date ?? todayIso())
  const [note, setNote] = useState(tx?.note ?? '')
  const [accountId, setAccountId] = useState<string | undefined>(tx?.accountId ?? preset?.accountId)
  const [icon, setIcon] = useState<FinIconName | undefined>(tx?.icon)
  const { fail, clear, shake, errorNode } = useForm()
  const cats = kind === 'gasto' ? EXPENSE_CATS : INCOME_CATS

  const switchKind = (k: Transaction['kind']): void => {
    setKind(k)
    setCat(k === 'gasto' ? 'comida' : 'salario')
  }

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    const cents = parseMoney(amount, currency)
    if (!cents) return fail('Escribe el valor.')
    const item: Transaction = {
      id: tx?.id ?? newId(), date, kind, cents, cat, note: note.trim(), createdAt: tx?.createdAt ?? Date.now(),
      ...(accountId ? { accountId } : {}),
      ...(icon ? { icon } : {}),
      ...(tx?.subId ? { subId: tx.subId } : {}),
    }
    dispatch({ type: 'tx.upsert', item })
    burst(document.querySelector('.sheet .btn.primary'), kind === 'gasto' ? 'var(--vermilion)' : 'var(--green)')
    close()
  }

  return (
    <Sheet
      title={tx ? 'Editar movimiento' : 'Nuevo movimiento'}
      onClose={close}
      footer={
        <>
          {tx && (
            <button type="button" className="btn ghost danger" onClick={() => {
              dispatch({ type: 'tx.delete', id: tx.id })
              notify(`Borrado: ${tx.note || FIN_CAT_LABEL[tx.cat]}`, () => dispatch({ type: 'tx.upsert', item: tx }))
              close()
            }}>Borrar</button>
          )}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={close}>Cancelar</button>
          <button type="submit" form="tx-form" className="btn primary">Guardar</button>
        </>
      }
    >
      <motion.form id="tx-form" className="form" onSubmit={submit} key={shake} animate={shakeAnim(shake)} transition={{ duration: 0.35 }}>
        <Segmented label="Tipo" layoutId="tx-kind" value={kind} onChange={switchKind} options={[{ value: 'gasto', label: 'Gasto' }, { value: 'ingreso', label: 'Ingreso' }]} />
        <MoneyField label="Valor" value={amount} onChange={v => { setAmount(v); clear() }} autoFocus tone={kind} />
        <div className="field">
          <span>Categoría</span>
          <div className="chips">
            {cats.map(c => (
              <Chip key={c} className="chip-cat" active={cat === c} color={`var(--${FIN_CAT_INK[c]})`} onClick={() => setCat(c)}>
                <FinIcon name={FIN_CAT_ICON[c]} />{FIN_CAT_LABEL[c]}
              </Chip>
            ))}
          </div>
        </div>
        <div className="row">
          <label className="field">
            <span>Día</span>
            <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} />
          </label>
          <AccountSelect value={accountId} onChange={setAccountId} />
        </div>
        <label className="field">
          <span>Nota</span>
          <input value={note} maxLength={200} placeholder={kind === 'gasto' ? 'En qué fue, ej. almuerzo con Ana' : 'De dónde vino'} onChange={e => setNote(e.target.value)} />
        </label>
        <IconPicker value={icon} onChange={setIcon} color={FIN_CAT_INK[cat]} fallback={FIN_CAT_ICON[cat]} fallbackLabel={`Usa el de ${FIN_CAT_LABEL[cat]}`} />
        {errorNode}
      </motion.form>
    </Sheet>
  )
}

// ---------- Subscription ----------

const REMIND_CHOICES = [-1, 0, 1, 2, 3, 5, 7] as const

export function SubSheet({ sub }: { sub?: Subscription }) {
  const close = useStore(s => s.closeSheet)
  const dispatch = useStore(s => s.dispatch)
  const notify = useStore(s => s.notify)
  const currency = useCurrency()
  const [name, setName] = useState(sub?.name ?? '')
  const [amount, setAmount] = useState(sub ? moneyInput(sub.cents, currency) : '')
  const [cycle, setCycle] = useState<Subscription['cycle']>(sub?.cycle ?? 'mensual')
  const [anchor, setAnchor] = useState(sub?.anchor ?? todayIso())
  const [accountId, setAccountId] = useState<string | undefined>(sub?.accountId)
  const [color, setColor] = useState<Ink>(sub?.color ?? 'magenta')
  const [icon, setIcon] = useState<FinIconName | undefined>(sub?.icon)
  const [remindDays, setRemindDays] = useState(sub?.remindDays ?? 1)
  const [autoLog, setAutoLog] = useState(sub?.autoLog ?? true)
  const [active, setActive] = useState(sub?.active ?? true)
  const { fail, clear, shake, errorNode } = useForm()

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    const cents = parseMoney(amount, currency)
    if (!name.trim()) return fail('Escribe el nombre, ej. Netflix.')
    if (!cents) return fail('Escribe cuánto cuesta.')
    const today = todayIso()
    // A payment date already in the past is just the day it is charged: earlier payments are not recorded.
    const loggedThrough = sub?.loggedThrough ?? (anchor < today ? toIso(addDays(fromIso(today), -1)) : undefined)
    const item: Subscription = {
      id: sub?.id ?? newId(), name: name.trim(), cents, cycle, anchor, color, remindDays, autoLog, active, createdAt: sub?.createdAt ?? Date.now(),
      ...(accountId ? { accountId } : {}),
      ...(loggedThrough ? { loggedThrough } : {}),
      ...(icon ? { icon } : {}),
    }
    dispatch({ type: 'sub.upsert', item })
    close()
  }

  return (
    <Sheet
      title={sub ? 'Editar suscripción' : 'Nueva suscripción'}
      onClose={close}
      footer={
        <>
          {sub && (
            <button type="button" className="btn ghost danger" onClick={() => {
              dispatch({ type: 'sub.delete', id: sub.id })
              notify(`Borrada: ${sub.name}`, () => dispatch({ type: 'sub.upsert', item: sub }))
              close()
            }}>Borrar</button>
          )}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={close}>Cancelar</button>
          <button type="submit" form="sub-form" className="btn primary">Guardar</button>
        </>
      }
    >
      <motion.form id="sub-form" className="form" onSubmit={submit} key={shake} animate={shakeAnim(shake)} transition={{ duration: 0.35 }}>
        <input data-autofocus className="title-input" placeholder="Nombre, ej. Netflix" value={name} maxLength={60} onChange={e => { setName(e.target.value); clear() }} aria-label="Nombre" />
        <MoneyField label="Cuánto cuesta" value={amount} onChange={v => { setAmount(v); clear() }} tone="gasto" />
        <div className="field">
          <span>Se cobra</span>
          <Segmented label="Frecuencia" layoutId="sub-cycle" size="s" value={cycle} onChange={setCycle} options={CYCLES.map(c => ({ value: c, label: CYCLE_LABEL[c] }))} />
        </div>
        <div className="row">
          <label className="field">
            <span>{sub ? 'Un día de cobro' : 'Próximo cobro'}</span>
            <input type="date" value={anchor} onChange={e => e.target.value && setAnchor(e.target.value)} />
          </label>
          <AccountSelect value={accountId} onChange={setAccountId} />
        </div>
        <label className="field">
          <span>Aviso</span>
          <select value={remindDays} onChange={e => setRemindDays(Number(e.target.value))}>
            {REMIND_CHOICES.map(d => <option key={d} value={d}>{d < 0 ? 'Sin aviso' : d === 0 ? 'El mismo día' : d === 1 ? 'Un día antes' : `${d} días antes`}</option>)}
          </select>
        </label>
        <Switch label="Registrar el pago como gasto el día del cobro" on={autoLog} onChange={setAutoLog} />
        {sub && <Switch label="Activa" on={active} onChange={setActive} />}
        <IconPicker value={icon} onChange={setIcon} color={color} fallback={(name.trim().charAt(0) || '?').toUpperCase()} fallbackLabel="Usa la inicial del nombre" />
        <div className="field">
          <span>Color</span>
          <InkPicker value={color} onChange={setColor} />
        </div>
        {errorNode}
      </motion.form>
    </Sheet>
  )
}

// ---------- Account ----------

export function WalletSheet({ wallet }: { wallet?: Account }) {
  const close = useStore(s => s.closeSheet)
  const dispatch = useStore(s => s.dispatch)
  const notify = useStore(s => s.notify)
  const currency = useCurrency()
  const [name, setName] = useState(wallet?.name ?? '')
  const [kind, setKind] = useState<Account['kind']>(wallet?.kind ?? 'debito')
  const [color, setColor] = useState<Ink>(wallet?.color ?? 'cobalt')
  const [icon, setIcon] = useState<FinIconName | undefined>(wallet?.icon)
  const [initial, setInitial] = useState(wallet ? moneyInput(Math.abs(wallet.initial), currency) : '')
  const { fail, clear, shake, errorNode } = useForm()

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    if (!name.trim()) return fail('Escribe un nombre, ej. Bancolombia.')
    const cents = parseMoney(initial, currency) ?? 0
    const item: Account = {
      id: wallet?.id ?? newId(), name: name.trim(), kind, color, initial: kind === 'credito' ? -cents : cents, createdAt: wallet?.createdAt ?? Date.now(),
      ...(icon ? { icon } : {}),
    }
    dispatch({ type: 'account.upsert', item })
    close()
  }

  return (
    <Sheet
      title={wallet ? 'Editar cuenta' : 'Nueva cuenta'}
      onClose={close}
      footer={
        <>
          {wallet && (
            <button type="button" className="btn ghost danger" onClick={() => {
              dispatch({ type: 'account.delete', id: wallet.id })
              notify(`Borrada: ${wallet.name}. Sus movimientos se conservan.`, () => dispatch({ type: 'account.upsert', item: wallet }))
              close()
            }}>Borrar</button>
          )}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={close}>Cancelar</button>
          <button type="submit" form="wallet-form" className="btn primary">Guardar</button>
        </>
      }
    >
      <motion.form id="wallet-form" className="form" onSubmit={submit} key={shake} animate={shakeAnim(shake)} transition={{ duration: 0.35 }}>
        <input data-autofocus className="title-input" placeholder="Nombre, ej. Nequi o Visa" value={name} maxLength={60} onChange={e => { setName(e.target.value); clear() }} aria-label="Nombre" />
        <div className="field">
          <span>Tipo</span>
          <div className="chips">
            {ACCOUNT_KINDS.map(k => <Chip key={k} className="chip-cat" active={kind === k} onClick={() => setKind(k)}><FinIcon name={ACCOUNT_KIND_ICON[k]} />{ACCOUNT_KIND_LABEL[k]}</Chip>)}
          </div>
        </div>
        <MoneyField label={kind === 'credito' ? 'Lo que debes hoy' : 'Saldo de hoy'} value={initial} onChange={setInitial} tone={kind === 'credito' ? 'gasto' : 'ingreso'} />
        <p className="hint">Los gastos e ingresos que registres con esta cuenta se suman o restan a partir de aquí.</p>
        <IconPicker value={icon} onChange={setIcon} color={color} fallback={ACCOUNT_KIND_ICON[kind]} fallbackLabel={`Usa el de ${ACCOUNT_KIND_LABEL[kind].toLowerCase()}`} />
        <div className="field">
          <span>Color</span>
          <InkPicker value={color} onChange={setColor} />
        </div>
        {errorNode}
      </motion.form>
    </Sheet>
  )
}

// ---------- Savings goal ----------

export function GoalSheet({ goal }: { goal?: Goal }) {
  const close = useStore(s => s.closeSheet)
  const dispatch = useStore(s => s.dispatch)
  const notify = useStore(s => s.notify)
  const currency = useCurrency()
  const [name, setName] = useState(goal?.name ?? '')
  const [target, setTarget] = useState(goal ? moneyInput(goal.target, currency) : '')
  const [saved, setSaved] = useState(goal ? moneyInput(goal.saved, currency) : '')
  const [deadline, setDeadline] = useState(goal?.deadline ?? '')
  const [color, setColor] = useState<Ink>(goal?.color ?? 'green')
  const [icon, setIcon] = useState<FinIconName | undefined>(goal?.icon)
  const { fail, clear, shake, errorNode } = useForm()

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    const t = parseMoney(target, currency)
    if (!name.trim()) return fail('Escribe para qué ahorras.')
    if (!t) return fail('Escribe cuánto quieres juntar.')
    const item: Goal = {
      id: goal?.id ?? newId(), name: name.trim(), target: t, saved: parseMoney(saved, currency) ?? 0, color, createdAt: goal?.createdAt ?? Date.now(),
      ...(deadline ? { deadline } : {}),
      ...(icon ? { icon } : {}),
    }
    dispatch({ type: 'goal.upsert', item })
    close()
  }

  return (
    <Sheet
      title={goal ? 'Editar meta' : 'Nueva meta de ahorro'}
      onClose={close}
      footer={
        <>
          {goal && (
            <button type="button" className="btn ghost danger" onClick={() => {
              dispatch({ type: 'goal.delete', id: goal.id })
              notify(`Borrada: ${goal.name}`, () => dispatch({ type: 'goal.upsert', item: goal }))
              close()
            }}>Borrar</button>
          )}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={close}>Cancelar</button>
          <button type="submit" form="goal-form" className="btn primary">Guardar</button>
        </>
      }
    >
      <motion.form id="goal-form" className="form" onSubmit={submit} key={shake} animate={shakeAnim(shake)} transition={{ duration: 0.35 }}>
        <input data-autofocus className="title-input" placeholder="Para qué ahorras, ej. Viaje a Cartagena" value={name} maxLength={60} onChange={e => { setName(e.target.value); clear() }} aria-label="Nombre" />
        <div className="row">
          <MoneyField label="Meta" value={target} onChange={v => { setTarget(v); clear() }} tone="ingreso" />
          <MoneyField label="Llevas ahorrado" value={saved} onChange={setSaved} />
        </div>
        <label className="field">
          <span>Para cuándo (opcional)</span>
          <input type="date" value={deadline} min={todayIso()} onChange={e => setDeadline(e.target.value)} />
        </label>
        <IconPicker value={icon} onChange={setIcon} color={color} fallback="alcancia" fallbackLabel="Usa la alcancía" />
        <div className="field">
          <span>Color</span>
          <InkPicker value={color} onChange={setColor} />
        </div>
        {errorNode}
      </motion.form>
    </Sheet>
  )
}
