import { AnimatePresence, motion } from 'motion/react'
import {
  DAYS, MONTHS, addDays, fromIso, isoWeek, mondayOf, sameMonth, toIso, weekRangeLabel, weekday,
} from '@shared/dates'
import type { View } from '@/state/store'
import { useStore } from '@/state/store'
import { useEventIndex, useNarrow, useToday } from '@/state/hooks'
import { KineticTitle } from './KineticTitle'
import { Icon, Segmented, cx } from './primitives'

const DESKTOP_VIEWS: ReadonlyArray<{ value: View; label: string }> = [
  { value: 'month', label: 'Mes' },
  { value: 'week', label: 'Semana' },
  { value: 'day', label: 'Día' },
  { value: 'habits', label: 'Hábitos' },
]
const PHONE_VIEWS: ReadonlyArray<{ value: View; label: string }> = [
  { value: 'today', label: 'Hoy' },
  { value: 'month', label: 'Mes' },
  { value: 'week', label: 'Semana' },
  { value: 'habits', label: 'Hábitos' },
]

const ago = (t: number): string => {
  const m = Math.round((Date.now() - t) / 60000)
  return m < 1 ? 'hace un momento' : m < 60 ? `hace ${m} min` : `hace ${Math.round(m / 60)} h`
}

/** Cloud status: spins while syncing, turns red on error, opens Ajustes on click. */
function SyncBadge() {
  const sync = useStore(s => s.sync)
  const openSheet = useStore(s => s.openSheet)
  if (!sync?.configured) return null
  const label =
    sync.phase === 'signed-out' ? 'Sincronización: sin iniciar sesión'
      : sync.phase === 'syncing' ? 'Sincronizando…'
        : sync.phase === 'error' ? `Error al sincronizar: ${sync.error ?? ''}`
          : sync.lastSync ? `Sincronizado ${ago(sync.lastSync)}` : 'Sincronizado'
  return (
    <button type="button" className={cx('icon-btn', 'sync-badge', `is-${sync.phase}`)} title={label} aria-label={label} onClick={() => openSheet({ kind: 'settings' })}>
      <svg viewBox="0 0 24 24" className="ico" aria-hidden="true">
        <path d="M7 18h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.6 9.1 4.5 4.5 0 0 0 7 18z" />
        {sync.phase === 'syncing' && <motion.path d="M12 10.5v4M10 12.5l2 2 2-2" initial={{ y: -3, opacity: 0 }} animate={{ y: [-3, 1, -3], opacity: 1 }} transition={{ repeat: Infinity, duration: 1.1 }} />}
        {sync.phase === 'idle' && <motion.path d="M9.5 13.2l1.8 1.8 3.4-3.6" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4 }} />}
        {sync.phase === 'error' && <path d="M12 10.5v3M12 15.8v.2" />}
        {sync.phase === 'signed-out' && <path d="M9.5 15.5l5-5" />}
      </svg>
    </button>
  )
}

export function TitleBar() {
  const view = useStore(s => s.view)
  const setView = useStore(s => s.setView)
  const openSheet = useStore(s => s.openSheet)
  const settings = useStore(s => s.data!.settings)
  const dispatch = useStore(s => s.dispatch)
  const narrow = useNarrow()
  const views = narrow ? PHONE_VIEWS : DESKTOP_VIEWS
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
        <Segmented label="Vista" layoutId="view-pill" value={view === 'day' && narrow ? 'today' : view} onChange={setView} options={views} />
      </div>
      <div className="titlebar-actions">
        <SyncBadge />
        {!narrow && (
          <button
            type="button"
            className="icon-btn"
            aria-pressed={settings.sidebar}
            title="Panel «Hoy»"
            aria-label="Mostrar u ocultar el panel «Hoy»"
            onClick={() => dispatch({ type: 'settings.set', settings: { ...settings, sidebar: !settings.sidebar } })}
          >
            {Icon.panel}
          </button>
        )}
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
    case 'today':
      return { title: 'Hoy', eyebrow: `${DAYS[weekday(t)]} ${t.getDate()} de ${MONTHS[t.getMonth()]}`, inPeriod: true }
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
  const idx = useEventIndex()
  const today = useToday()
  const narrow = useNarrow()
  const prefix = date.slice(0, 7)
  let eventsInMonth = 0
  for (const [d, list] of idx) if (d.startsWith(prefix)) eventsInMonth += list.length
  const { title, eyebrow, inPeriod } = titleFor(view, date, today, eventsInMonth)
  const newLabel = view === 'habits' ? 'Nuevo hábito' : 'Nuevo evento'

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
        {view !== 'today' && (
          <div className="nav">
            <motion.button type="button" className="icon-btn" whileTap={{ x: -3 }} onClick={() => shift(-1)} aria-label="Anterior" title="Anterior (←)">{Icon.left}</motion.button>
            <button type="button" className="btn ghost" disabled={inPeriod} onClick={goToday} title="Hoy (T)">Hoy</button>
            <motion.button type="button" className="icon-btn" whileTap={{ x: 3 }} onClick={() => shift(1)} aria-label="Siguiente" title="Siguiente (→)">{Icon.right}</motion.button>
          </div>
        )}
        <motion.button
          type="button"
          className={cx('btn', 'primary', narrow && 'fab')}
          whileTap={{ scale: 0.94 }}
          onClick={() => openSheet(view === 'habits' ? { kind: 'habit' } : { kind: 'event', preset: { date: view === 'today' || (view === 'month' && inPeriod) ? today : date } })}
          title={`${newLabel} (N)`}
          aria-label={newLabel}
        >
          {Icon.plus}
          <AnimatePresence initial={false}>{!narrow && <span>{newLabel}</span>}</AnimatePresence>
        </motion.button>
      </div>
    </header>
  )
}
