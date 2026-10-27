import { FinBadge } from '@/components/FinIcon'
import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { DAYS, MONTHS, MONTHS_SHORT, addDays, fmtDuration, fromIso, mondayOf, pad, toIso, toMin, weekday } from '@shared/dates'
import { evColor } from '@shared/events'
import { SLOT_ORDER, countOf, dayProgress, isActiveOn } from '@shared/habits'
import { useStore } from '@/state/store'
import { useCurrency, useEventIndex, useHolidays, useMinute, useNarrow, useSubsIndex, useToday } from '@/state/hooks'
import { fmtMoney } from '@shared/money'
import { toggleEvent } from '@/state/actions'
import { HabitTile } from './HabitTile'
import { FocusCard } from './Focus'
import { Inbox } from './Inbox'
import { MoodPicker } from './Journal'
import { Priorities } from './Priorities'
import { AnimatedNumber, Check, Icon, PriorityMark, Ring, cx } from './primitives'

/** HH:MM with rolling digits; the seconds bar is a pure CSS animation synced once per minute. */
function Clock() {
  const now = new Date(useMinute())
  const text = `${pad(now.getHours())}:${pad(now.getMinutes())}`
  return (
    <div className="clock" aria-label={`Son las ${text}`}>
      <div className="clock-digits" aria-hidden="true">
        {Array.from(text).map((c, i) => (
          <span key={i} className={cx('clock-slot', c === ':' && 'is-colon')}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={c}
                initial={{ y: '-100%', opacity: 0, filter: 'blur(4px)' }}
                animate={{ y: '0%', opacity: 1, filter: 'blur(0px)' }}
                exit={{ y: '100%', opacity: 0, filter: 'blur(4px)' }}
                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              >
                {c}
              </motion.span>
            </AnimatePresence>
          </span>
        ))}
      </div>
      <span className="clock-sec" key={text} style={{ animationDelay: `-${new Date().getSeconds()}s` } as CSSProperties} />
    </div>
  )
}

export function TodayPanel() {
  const today = useToday()
  const narrow = useNarrow()
  const minute = useMinute()
  const idx = useEventIndex()
  const habits = useStore(s => s.data!.habits)
  const log = useStore(s => s.data!.habitLog)
  const openDay = useStore(s => s.openDay)
  const openSheet = useStore(s => s.openSheet)
  const reviews = useStore(s => s.data!.reviews)
  const subsIdx = useSubsIndex()
  const currency = useCurrency()
  // Payments in the next week.
  const upcoming = Array.from({ length: 8 }, (_, i) => toIso(addDays(fromIso(today), i))).flatMap((day, i) => (subsIdx.get(day) ?? []).map(s => ({ s, day, i })))
  const events = idx.get(today) ?? []
  const d = fromIso(today)
  const holiday = useHolidays()(today)

  const nowMin = new Date(minute).getHours() * 60 + new Date(minute).getMinutes()
  const current = events.find(e => e.start && !e.done && toMin(e.start) <= nowMin && nowMin < toMin(e.end))
  const next = events.find(e => e.start && !e.done && toMin(e.start) > nowMin)
  const focus = current ?? next

  const active = useMemo(
    () => habits.filter(h => isActiveOn(h, today)).sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot)),
    [habits, today],
  )
  const hp = dayProgress(habits, log, today)
  const total = events.length + hp.total
  const done = events.filter(e => e.done).length + hp.done
  const pct = total ? Math.round((done / total) * 100) : 0
  // Sunday asks to close this week, Monday the one that just ended.
  const wd = weekday(d)
  const reviewWeek = wd === 6 ? toIso(mondayOf(d)) : wd === 0 ? toIso(mondayOf(addDays(d, -1))) : null
  const askReview = !!reviewWeek && !reviews[reviewWeek]

  return (
    <aside className="today" aria-label="Hoy">
      <Clock />
      <button type="button" className="today-date" onClick={() => openDay(today)}>
        {DAYS[weekday(d)]} {d.getDate()} de {MONTHS[d.getMonth()]}
      </button>
      {holiday && (
        <motion.div className="hol-banner" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          {Icon.star}<span>Hoy es festivo<b>{holiday}</b></span>
        </motion.div>
      )}

      <div className="today-progress">
        <Ring value={total ? done / total : 0} size={58} stroke={5} color="var(--accent)">
          <AnimatedNumber value={pct} suffix="%" />
        </Ring>
        <div>
          <b>{total ? `${done} de ${total} hechos` : 'Día libre'}</b>
          <span>{events.length} eventos · {hp.total} hábitos</span>
        </div>
      </div>

      <section className="today-section mood-today">
        <h3>¿Cómo va tu día?</h3>
        <MoodPicker date={today} compact />
      </section>

      <AnimatePresence initial={false}>
        {askReview && (
          <motion.button
            type="button"
            className="review-card"
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            whileHover={{ y: -2 }}
            onClick={() => {
              useStore.setState({ date: reviewWeek!, dir: 0 })
              useStore.getState().setView('stats')
            }}
          >
            {Icon.chart}
            <span><b>Cierra tu semana</b>Mira tu resumen y apunta qué salió bien y qué mejorar.</span>
          </motion.button>
        )}
      </AnimatePresence>

      <Priorities date={today} />

      <AnimatePresence mode="wait" initial={false}>
        {focus && (
          <motion.button
            key={focus.id + (current ? 'now' : 'next')}
            type="button"
            className={cx('focus-card', current && 'is-now')}
            style={{ '--c': evColor(focus) } as CSSProperties}
            onClick={() => openSheet({ kind: 'event', event: focus })}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            whileHover={{ y: -2 }}
          >
            <span className="focus-label">
              {current ? <><i className="live" />Ahora · quedan {fmtDuration(toMin(focus.end) - nowMin)}</> : <>Siguiente · en {fmtDuration(toMin(focus.start) - nowMin)}</>}
            </span>
            <span className="focus-title"><PriorityMark value={focus.priority} />{focus.text}</span>
            <span className="focus-time">{focus.start}–{focus.end}</span>
            {current && (
              <span className="focus-bar"><span style={{ transform: `scaleX(${(nowMin - toMin(focus.start)) / Math.max(1, toMin(focus.end) - toMin(focus.start))})` }} /></span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      <section className="today-section">
        <h3>Agenda</h3>
        {events.length ? (
          <ul className="agenda">
            <AnimatePresence initial={false}>
              {events.map((e, i) => (
                <motion.li
                  key={e.id}
                  layout
                  className={cx('agenda-item', e.done && 'is-done', e.start && toMin(e.end) <= nowMin && 'is-past')}
                  style={{ '--c': evColor(e) } as CSSProperties}
                  initial={{ opacity: 0, x: 16, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, scale: 1, transition: { type: 'spring', stiffness: 380, damping: 24, delay: i * 0.04 } }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <button type="button" className="tick" onClick={ev => toggleEvent(e, ev.currentTarget)} aria-label={e.done ? 'Marcar pendiente' : 'Marcar hecho'}>
                    <Check on={e.done} size={11} />
                  </button>
                  <button type="button" className="agenda-text" onClick={() => openSheet({ kind: 'event', event: e })}>
                    <time>{e.start || '—'}</time>
                    <span>{e.text}</span>
                  </button>
                  {e.from && <span className="from-tag" title="Pasó de un día anterior">del {fromIso(e.from).getDate()} {MONTHS_SHORT[fromIso(e.from).getMonth()]}</span>}
                  <PriorityMark value={e.priority} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        ) : (
          <p className="empty">{narrow ? 'Nada planeado. Toca + para añadir algo.' : 'Nada planeado. Pulsa N para añadir algo.'}</p>
        )}
      </section>

      {upcoming.length > 0 && (
        <section className="today-section">
          <h3>Próximos cobros</h3>
          <ul className="upcoming">
            {upcoming.map(({ s, day, i }) => (
              <motion.li key={`${s.id}${day}`} style={{ '--c': `var(--${s.color})` } as CSSProperties} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
                <button type="button" onClick={() => openSheet({ kind: 'sub', sub: s })}>
                  <FinBadge name={s.icon ?? 'tarjeta'} size="s" />
                  <span>{s.name}</span>
                  <em className={cx(i <= 1 && 'is-soon')}>{i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : `En ${i} días`}</em>
                  <b>{fmtMoney(s.cents, currency)}</b>
                </button>
              </motion.li>
            ))}
          </ul>
        </section>
      )}

      <FocusCard />

      {active.length > 0 && (
        <section className="today-section">
          <h3>Hábitos de hoy</h3>
          <div className="today-habits">
            {active.map(h => <HabitTile key={h.id} habit={h} date={today} count={countOf(log, h.id, today)} future={false} dense />)}
          </div>
        </section>
      )}

      <Inbox />
    </aside>
  )
}
