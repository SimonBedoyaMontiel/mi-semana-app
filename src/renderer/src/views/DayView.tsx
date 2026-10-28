import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { CalendarEvent } from '@shared/model'
import { FIN_CAT_ICON, FIN_CAT_INK, REPEAT_LABEL, SLOT_LABEL } from '@shared/constants'
import { DAYS, MONTHS_SHORT, addDays, fromIso, toIso, todayIso, weekday } from '@shared/dates'
import { evColor, parseQuick } from '@shared/events'
import { SLOT_ORDER, countOf, dayProgress, isActiveOn } from '@shared/habits'
import { fmtMoney } from '@shared/money'
import { useStore } from '@/state/store'
import { useCurrency, useEventIndex, useSubsIndex, useToday } from '@/state/hooks'
import { saveEvent, toggleEvent } from '@/state/actions'
import { newId } from '@/lib/fx'
import { HabitTile } from '@/components/HabitTile'
import { Check, Icon, PriorityMark, Ring, cx } from '@/components/primitives'
import { EvIcon, EventMarks, JoinButton } from '@/components/EventBits'
import { FinIcon } from '@/components/FinIcon'
import { JournalPanel } from '@/components/Journal'
import { Priorities } from '@/components/Priorities'
import { Timeline } from './Timeline'

/** "Mañana", "Vie 30 oct". */
function shortDay(iso: string): string {
  if (iso === todayIso()) return 'Hoy'
  if (iso === toIso(addDays(fromIso(todayIso()), 1))) return 'Mañana'
  const d = fromIso(iso)
  return `${DAYS[weekday(d)]!.slice(0, 3)} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

const HINTS = ['9-10:30 Gimnasio #salud', 'mañana 18:00 Cena con amigos', 'Inglés cada martes y jueves a las 18', 'Reunión el viernes 10:00 y pega el enlace', 'Standup de lunes a viernes 9:00', 'Cumpleaños de Ana 15/11 cada año']

function QuickAdd({ date }: { date: string }) {
  const [value, setValue] = useState('')
  const [hint, setHint] = useState(0)
  const lastCat = useStore(s => s.lastCat)
  const openSheet = useStore(s => s.openSheet)
  const parsed = useMemo(() => parseQuick(value), [value])

  useEffect(() => {
    const t = window.setInterval(() => setHint(h => (h + 1) % HINTS.length), 3600)
    return () => window.clearInterval(t)
  }, [])

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    if (!parsed.text) return
    const ev: CalendarEvent = {
      id: newId(), date: parsed.date ?? date, start: parsed.start, end: parsed.end, text: parsed.text,
      cat: parsed.cat ?? lastCat, done: false, createdAt: Date.now(),
      ...(parsed.repeat ? { repeat: parsed.repeat } : {}),
      ...(parsed.link ? { link: parsed.link } : {}),
    }
    saveEvent(ev, undefined)
    setValue('')
  }

  return (
    <form className="quick" onSubmit={submit}>
      <div className="quick-field">
        <input
          id="quick-add"
          value={value}
          onChange={e => setValue(e.target.value)}
          aria-label="Añadir rápido"
          autoComplete="off"
          maxLength={200}
        />
        {!value && (
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={hint} className="quick-hint" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: 0.25 }}>
              Escribe y pulsa Enter · ej. {HINTS[hint]}
            </motion.span>
          </AnimatePresence>
        )}
        <AnimatePresence>
          {value && (parsed.start || parsed.cat || parsed.date || parsed.repeat || parsed.link) && (
            <motion.span className="quick-parse" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              {parsed.date && parsed.date !== date && <em>{shortDay(parsed.date)}</em>}
              {parsed.start && `${parsed.start}–${parsed.end}`}
              {parsed.repeat && <em className="qp-repeat">{Icon.repeat}{REPEAT_LABEL[parsed.repeat.freq]}{parsed.repeat.count ? ` · ${parsed.repeat.count}` : ''}</em>}
              {parsed.link && EvIcon.video}
              {parsed.cat && <i style={{ '--c': `var(--cat-${parsed.cat})` } as CSSProperties}>#{parsed.cat}</i>}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <button
        type="button"
        className="btn ghost"
        onClick={() => openSheet({
          kind: 'event',
          preset: {
            date: parsed.date ?? date, text: parsed.text,
            ...(parsed.start ? { start: parsed.start, end: parsed.end } : {}),
            ...(parsed.repeat || parsed.link ? { copy: { text: parsed.text, start: parsed.start, end: parsed.end, ...(parsed.cat ? { cat: parsed.cat } : {}), ...(parsed.repeat ? { repeat: parsed.repeat } : {}), ...(parsed.link ? { link: parsed.link } : {}) } } : {}),
          },
        })}
      >
        Con detalles
      </button>
    </form>
  )
}

export function DayView() {
  const date = useStore(s => s.date)
  const habits = useStore(s => s.data!.habits)
  const log = useStore(s => s.data!.habitLog)
  const openSheet = useStore(s => s.openSheet)
  const idx = useEventIndex()
  const today = useToday()
  const events = idx.get(date) ?? []
  const untimed = events.filter(e => !e.start)
  const future = date > today
  const active = habits.filter(h => isActiveOn(h, date))
  const p = dayProgress(habits, log, date)
  const subs = useSubsIndex().get(date) ?? []
  const currency = useCurrency()
  const spent = useStore(s => s.data!.transactions).filter(t => t.date === date)

  return (
    <div className="day">
      <motion.span layoutId={`day-${date}`} className="day-surface" style={{ borderRadius: 22 }} transition={{ type: 'spring', stiffness: 240, damping: 30 }} />
      <motion.div className="day-content" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.12, type: 'spring', stiffness: 260, damping: 30 } }}>
        <section className="day-main">
          <QuickAdd date={date} />
          <Timeline days={[date]} idx={idx} hh={60} today={today} />
        </section>
        <aside className="day-side">
          <section className="panel">
            <header className="panel-head">
              <h3>Hábitos y suplementos</h3>
              {p.total > 0 && <Ring value={p.done / p.total} size={28} stroke={3.5} color="var(--green)" />}
            </header>
            {active.length === 0 ? (
              <div className="empty">
                <p>{habits.length ? 'Nada programado para este día.' : 'Aún no sigues ningún hábito o suplemento.'}</p>
                {!habits.length && <button type="button" className="btn" onClick={() => useStore.getState().setView('habits')}>Configurar hábitos</button>}
              </div>
            ) : (
              SLOT_ORDER.map(slot => {
                const list = active.filter(h => h.slot === slot)
                if (!list.length) return null
                return (
                  <div key={slot} className="slot">
                    <span className="slot-label">{SLOT_LABEL[slot]}</span>
                    {list.map(h => <HabitTile key={h.id} habit={h} date={date} count={countOf(log, h.id, date)} future={future} />)}
                  </div>
                )
              })
            )}
          </section>
          <section className="panel">
            <header className="panel-head"><h3>Sin hora</h3><span className="count">{untimed.length || ''}</span></header>
            {untimed.length ? (
              <ul className="list">
                <AnimatePresence initial={false}>
                  {untimed.map(e => (
                    <motion.li key={e.id} layout className={cx('list-item', e.done && 'is-done')} style={{ '--c': evColor(e) } as CSSProperties} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                      <button type="button" className="tick" aria-label={e.done ? 'Marcar pendiente' : 'Marcar hecho'} onClick={ev => toggleEvent(e, ev.currentTarget)}>
                        <Check on={e.done} size={12} />
                      </button>
                      <button type="button" className="list-text" onClick={() => openSheet({ kind: 'event', event: e })}>
                        {e.text}
                        {e.spanOf && <span className="span-tag">{e.spanFirst ? 'empieza' : e.spanLast ? 'último día' : 'sigue'}</span>}
                        <EventMarks e={e} />
                      </button>
                      {e.link && !e.done && <JoinButton url={e.link} size="s" />}
                      {e.from && <span className="from-tag">pendiente</span>}
                      <PriorityMark value={e.priority} />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            ) : (
              <p className="empty">Lo que escribas sin hora, como “Llamar al banco”, aparece aquí.</p>
            )}
          </section>
          {(subs.length > 0 || spent.length > 0) && (
            <section className="panel">
              <header className="panel-head"><h3>Dinero</h3></header>
              <ul className="day-money">
                {subs.map(s => (
                  <li key={s.id} style={{ '--c': `var(--${s.color})` } as CSSProperties}>
                    <button type="button" onClick={() => openSheet({ kind: 'sub', sub: s })}><FinIcon name={s.icon ?? 'tarjeta'} /><span>Cobro de {s.name}</span><b>{fmtMoney(s.cents, currency)}</b></button>
                  </li>
                ))}
                {spent.map(t => (
                  <li key={t.id} style={{ '--c': `var(--${FIN_CAT_INK[t.cat]})` } as CSSProperties}>
                    <button type="button" onClick={() => openSheet({ kind: 'tx', tx: t })}>
                      <FinIcon name={t.icon ?? FIN_CAT_ICON[t.cat]} />
                      <span>{t.note || (t.kind === 'gasto' ? 'Gasto' : 'Ingreso')}</span>
                      <b className={t.kind === 'ingreso' ? 'is-in' : 'is-out'}>{t.kind === 'ingreso' ? '+' : '−'}{fmtMoney(t.cents, currency)}</b>
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="link" onClick={() => openSheet({ kind: 'tx', preset: { date } })}>Añadir gasto o ingreso</button>
            </section>
          )}
          <section className="panel">
            <Priorities key={date} date={date} />
          </section>
          <section className="panel">
            <header className="panel-head"><h3>Diario del día</h3></header>
            <JournalPanel key={date} date={date} />
          </section>
        </aside>
      </motion.div>
    </div>
  )
}
