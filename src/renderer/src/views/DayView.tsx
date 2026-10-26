import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { CalendarEvent } from '@shared/model'
import { SLOT_LABEL } from '@shared/constants'
import { parseQuick } from '@shared/events'
import { SLOT_ORDER, countOf, dayProgress, isActiveOn } from '@shared/habits'
import { useStore } from '@/state/store'
import { useEventIndex, useToday } from '@/state/hooks'
import { saveEvent, toggleEvent } from '@/state/actions'
import { newId } from '@/lib/fx'
import { HabitTile } from '@/components/HabitTile'
import { Check, Ring, cx } from '@/components/primitives'
import { Timeline } from './Timeline'

const HINTS = ['9-10:30 Gimnasio #salud', '18:00 Cena con amigos #personal', 'Llamar al banco', '8am-12 Trabajo profundo #trabajo', '16:30 Inglés #estudio']

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
      id: newId(), date, start: parsed.start, end: parsed.end, text: parsed.text,
      cat: parsed.cat ?? lastCat, done: false, createdAt: Date.now(),
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
          {value && (parsed.start || parsed.cat) && (
            <motion.span className="quick-parse" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              {parsed.start && `${parsed.start}–${parsed.end}`}
              {parsed.cat && <i style={{ '--c': `var(--cat-${parsed.cat})` } as CSSProperties}>#{parsed.cat}</i>}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <button type="button" className="btn ghost" onClick={() => openSheet({ kind: 'event', preset: { date, text: parsed.text } })}>
        Con detalles
      </button>
    </form>
  )
}

function Notes({ date }: { date: string }) {
  const stored = useStore(s => s.data!.notes[date] ?? '')
  const dispatch = useStore(s => s.dispatch)
  const [text, setText] = useState(stored)
  const timer = useRef<number>(0)
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setText(stored)
  }, [stored])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <textarea
      className="notes"
      value={text}
      placeholder="Cómo te sentiste, ideas, pendientes…"
      maxLength={4000}
      onFocus={() => (focused.current = true)}
      onBlur={() => (focused.current = false)}
      onChange={e => {
        const v = e.target.value
        setText(v)
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => dispatch({ type: 'note.set', date, text: v }), 400)
      }}
    />
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
                    <motion.li key={e.id} layout className={cx('list-item', e.done && 'is-done')} style={{ '--c': `var(--cat-${e.cat})` } as CSSProperties} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                      <button type="button" className="tick" aria-label={e.done ? 'Marcar pendiente' : 'Marcar hecho'} onClick={ev => toggleEvent(e, ev.currentTarget)}>
                        <Check on={e.done} size={12} />
                      </button>
                      <button type="button" className="list-text" onClick={() => openSheet({ kind: 'event', event: e })}>{e.text}</button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            ) : (
              <p className="empty">Lo que escribas sin hora, como “Llamar al banco”, aparece aquí.</p>
            )}
          </section>
          <section className="panel">
            <header className="panel-head"><h3>Notas del día</h3></header>
            <Notes key={date} date={date} />
          </section>
        </aside>
      </motion.div>
    </div>
  )
}
