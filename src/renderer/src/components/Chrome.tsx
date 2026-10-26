import { motion } from 'motion/react'
import {
  DAYS, MONTHS, addDays, fromIso, isoWeek, mondayOf, sameMonth, toIso, weekRangeLabel, weekday,
} from '@shared/dates'
import type { View } from '@/state/store'
import { useStore } from '@/state/store'
import { useToday } from '@/state/hooks'
import { KineticTitle } from './KineticTitle'
import { Icon, Segmented } from './primitives'

const VIEWS: ReadonlyArray<{ value: View; label: string }> = [
  { value: 'month', label: 'Mes' },
  { value: 'week', label: 'Semana' },
  { value: 'day', label: 'Día' },
  { value: 'habits', label: 'Hábitos' },
]

export function TitleBar() {
  const view = useStore(s => s.view)
  const setView = useStore(s => s.setView)
  const openSheet = useStore(s => s.openSheet)
  const sidebar = useStore(s => s.data!.settings.sidebar)
  const settings = useStore(s => s.data!.settings)
  const dispatch = useStore(s => s.dispatch)
  return (
    <div className="titlebar">
      <div className="brand">
        <svg viewBox="0 0 32 32" className="brand-mark" aria-hidden="true">
          <circle cx="16" cy="16" r="10" className="brand-track" />
          <motion.circle cx="16" cy="16" r="10" className="brand-arc" initial={{ pathLength: 0 }} animate={{ pathLength: 0.78 }} transition={{ type: 'spring', stiffness: 60, damping: 16, delay: 0.2 }} transform="rotate(-90 16 16)" />
          <circle cx="6.2" cy="13.9" r="3.1" className="brand-dot" />
        </svg>
        <span>Mi Semana</span>
      </div>
      <div className="titlebar-center">
        <Segmented label="Vista" layoutId="view-pill" value={view} onChange={setView} options={VIEWS} />
      </div>
      <div className="titlebar-actions">
        <button
          type="button"
          className="icon-btn"
          aria-pressed={sidebar}
          title="Panel «Hoy»"
          aria-label="Mostrar u ocultar el panel «Hoy»"
          onClick={() => dispatch({ type: 'settings.set', settings: { ...settings, sidebar: !sidebar } })}
        >
          {Icon.panel}
        </button>
        <button type="button" className="icon-btn spin" title="Ajustes (Ctrl+,)" aria-label="Ajustes" onClick={() => openSheet({ kind: 'settings' })}>
          {Icon.gear}
        </button>
      </div>
    </div>
  )
}

function titleFor(view: View, date: string, today: string, eventsInMonth: number): { title: string; eyebrow: string; inPeriod: boolean } {
  const d = fromIso(date)
  const t = fromIso(today)
  switch (view) {
    case 'month':
      return { title: MONTHS[d.getMonth()]!, eyebrow: `${d.getFullYear()} · ${eventsInMonth} eventos`, inPeriod: sameMonth(d, t) }
    case 'week': {
      const mon = mondayOf(d)
      return { title: weekRangeLabel(d), eyebrow: `Semana ${isoWeek(mon)} · ${addDays(mon, 6).getFullYear()}`, inPeriod: toIso(mon) === toIso(mondayOf(t)) }
    }
    case 'day':
      return { title: `${DAYS[weekday(d)]} ${d.getDate()}`, eyebrow: `${MONTHS[d.getMonth()]} ${d.getFullYear()}${date === today ? ' · hoy' : ''}`, inPeriod: date === today }
    case 'habits':
      return { title: 'Hábitos', eyebrow: `Semana ${isoWeek(d)} · ${weekRangeLabel(d)}`, inPeriod: toIso(mondayOf(d)) === toIso(mondayOf(t)) }
  }
}

export function Header() {
  const view = useStore(s => s.view)
  const date = useStore(s => s.date)
  const shift = useStore(s => s.shift)
  const goToday = useStore(s => s.goToday)
  const back = useStore(s => s.back)
  const openSheet = useStore(s => s.openSheet)
  const eventsInMonth = useStore(s => {
    const prefix = s.date.slice(0, 7)
    return s.data!.events.reduce((n, e) => n + (e.date.startsWith(prefix) ? 1 : 0), 0)
  })
  const today = useToday()
  const { title, eyebrow, inPeriod } = titleFor(view, date, today, eventsInMonth)

  return (
    <header className="head">
      <div className="head-titles">
        <motion.div key={eyebrow} className="eyebrow" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          {view === 'day' && (
            <button type="button" className="back" onClick={back}>{Icon.left}<span>Volver</span></button>
          )}
          {eyebrow}
        </motion.div>
        <KineticTitle text={title} />
      </div>
      <div className="head-actions">
        <div className="nav">
          <motion.button type="button" className="icon-btn" whileTap={{ x: -3 }} onClick={() => shift(-1)} aria-label="Anterior" title="Anterior (←)">{Icon.left}</motion.button>
          <button type="button" className="btn ghost" disabled={inPeriod} onClick={goToday} title="Hoy (T)">Hoy</button>
          <motion.button type="button" className="icon-btn" whileTap={{ x: 3 }} onClick={() => shift(1)} aria-label="Siguiente" title="Siguiente (→)">{Icon.right}</motion.button>
        </div>
        <motion.button
          type="button"
          className="btn primary"
          whileTap={{ scale: 0.96 }}
          onClick={() => openSheet(view === 'habits' ? { kind: 'habit' } : { kind: 'event', preset: { date: view === 'month' && !inPeriod ? date : view === 'month' ? today : date } })}
          title={view === 'habits' ? 'Nuevo hábito (N)' : 'Nuevo evento (N)'}
        >
          {Icon.plus}
          <span>{view === 'habits' ? 'Nuevo hábito' : 'Nuevo evento'}</span>
        </motion.button>
      </div>
    </header>
  )
}
