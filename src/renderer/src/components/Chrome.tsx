import { AnimatePresence, motion } from 'motion/react'
import {
  DAYS, MONTHS, addDays, capitalize, fromIso, isoWeek, mondayOf, sameMonth, toIso, weekRangeLabel, weekday,
} from '@shared/dates'
import type { View } from '@/state/store'
import { useStore } from '@/state/store'
import { useEventIndex, useHolidays, useNarrow, useToday } from '@/state/hooks'
import { KineticTitle } from './KineticTitle'
import { Icon, Segmented, cx } from './primitives'

const DESKTOP_VIEWS: ReadonlyArray<{ value: View; label: string }> = [
  { value: 'month', label: 'Mes' },
  { value: 'week', label: 'Semana' },
  { value: 'day', label: 'Día' },
  { value: 'habits', label: 'Hábitos' },
  { value: 'journal', label: 'Diario' },
  { value: 'stats', label: 'Resumen' },
]
const PHONE_VIEWS: ReadonlyArray<{ value: View; label: string }> = [
  { value: 'today', label: 'Hoy' },
  { value: 'month', label: 'Mes' },
  { value: 'week', label: 'Semana' },
  { value: 'habits', label: 'Hábitos' },
  { value: 'journal', label: 'Diario' },
  { value: 'stats', label: 'Resumen' },
]

const ago = (t: number): string => {
  const m = Math.round((Date.now() - t) / 60000)
  return m < 1 ? 'hace un momento' : m < 60 ? `hace ${m} min` : `hace ${Math.round(m / 60)} h`
}

/**
 * Account entry point. Signed out: a quiet "Entrar". Signed in: the account's initial, ringed by the
 * sync state (a turning arc while syncing, a red mark on error).
 */
function AccountButton() {
  const sync = useStore(s => s.sync)
  const openSheet = useStore(s => s.openSheet)
  if (!sync?.configured) return null
  if (!sync.email) {
    return (
      <button type="button" className="btn ghost small" onClick={() => openSheet({ kind: 'account' })}>
        Entrar
      </button>
    )
  }
  const label =
    sync.phase === 'syncing' ? 'Sincronizando…'
      : sync.phase === 'error' ? `Error al sincronizar: ${sync.error ?? ''}`
        : sync.lastSync ? `${sync.email} · sincronizado ${ago(sync.lastSync)}` : sync.email
  return (
    <button type="button" className={cx('account-btn', `is-${sync.phase}`)} title={label} aria-label={`Cuenta: ${label}`} onClick={() => openSheet({ kind: 'account' })}>
      <svg viewBox="0 0 34 34" className="account-ring" aria-hidden="true">
        <circle cx="17" cy="17" r="15.5" />
        {sync.phase === 'syncing' && (
          <motion.circle cx="17" cy="17" r="15.5" className="account-arc" initial={{ rotate: 0 }} animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }} style={{ originX: '50%', originY: '50%' }} />
        )}
      </svg>
      <span className="avatar">{(sync.email ?? '?').charAt(0).toUpperCase()}</span>
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
        <AccountButton />
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
        <button type="button" className="icon-btn" title="Personalizar el diseño" aria-label="Personalizar el diseño" onClick={() => openSheet({ kind: 'settings', tab: 'design' })}>
          {Icon.palette}
        </button>
        <button type="button" className="icon-btn" title="Ajustes (Ctrl+,)" aria-label="Ajustes" onClick={() => openSheet({ kind: 'settings' })}>
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
      return { title: capitalize(MONTHS[d.getMonth()]!), eyebrow: `${d.getFullYear()} · ${eventsInMonth} eventos`, inPeriod: sameMonth(d, t) }
    case 'week': {
      const mon = mondayOf(d)
      return { title: weekRangeLabel(d), eyebrow: `Semana ${isoWeek(mon)} · ${addDays(mon, 6).getFullYear()}`, inPeriod: toIso(mon) === toIso(mondayOf(t)) }
    }
    case 'day':
      return { title: `${DAYS[weekday(d)]} ${d.getDate()}`, eyebrow: `${capitalize(MONTHS[d.getMonth()]!)} ${d.getFullYear()}${date === today ? ' · Hoy' : ''}`, inPeriod: date === today }
    case 'habits':
      return { title: 'Hábitos', eyebrow: `Semana ${isoWeek(d)} · ${weekRangeLabel(d)}`, inPeriod: toIso(mondayOf(d)) === toIso(mondayOf(t)) }
    case 'journal':
      return { title: 'Diario', eyebrow: `${d.getFullYear()} · tus días por escrito`, inPeriod: d.getFullYear() === t.getFullYear() }
    case 'stats':
      return { title: 'Resumen', eyebrow: `Semana ${isoWeek(d)} · ${weekRangeLabel(d)}`, inPeriod: toIso(mondayOf(d)) === toIso(mondayOf(t)) }
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
  const holiday = useHolidays()(view === 'today' ? today : date)
  const showHoliday = !!holiday && (view === 'day' || view === 'today')
  const prefix = date.slice(0, 7)
  let eventsInMonth = 0
  for (const [d, list] of idx) if (d.startsWith(prefix)) eventsInMonth += list.length
  const { title, eyebrow, inPeriod } = titleFor(view, date, today, eventsInMonth)
  const newLabel = view === 'habits' ? 'Nuevo hábito' : view === 'journal' ? 'Escribir hoy' : 'Nuevo evento'

  return (
    <header className="head">
      <div className="head-titles">
        <motion.div key={eyebrow} className="eyebrow" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          {view === 'day' && (
            <button type="button" className="back" onClick={back}>{Icon.left}<span>Volver</span></button>
          )}
          {eyebrow}
          {showHoliday && (
            <motion.span className="hol-chip" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 22, delay: 0.15 }}>
              {Icon.star}{holiday}
            </motion.span>
          )}
        </motion.div>
        <KineticTitle text={title} />
      </div>
      <div className="head-actions">
        {view !== 'today' && (
          <div className="nav">
            <motion.button type="button" className="icon-btn magnet nudge-left" whileTap={{ x: -4 }} onClick={() => shift(-1)} aria-label="Anterior" title="Anterior (←)">{Icon.left}</motion.button>
            <button type="button" className="btn ghost" disabled={inPeriod} onClick={goToday} title="Hoy (T)">Hoy</button>
            <motion.button type="button" className="icon-btn magnet nudge-right" whileTap={{ x: 4 }} onClick={() => shift(1)} aria-label="Siguiente" title="Siguiente (→)">{Icon.right}</motion.button>
          </div>
        )}
        <motion.button
          type="button"
          className={cx('btn', 'primary', 'magnet', narrow && 'fab')}
          whileTap={{ scale: 0.94 }}
          onClick={() => {
            if (view === 'journal') useStore.getState().openDay(today)
            else openSheet(view === 'habits' ? { kind: 'habit' } : { kind: 'event', preset: { date: view === 'today' || (view === 'month' && inPeriod) ? today : date } })
          }}
          title={`${newLabel} (N)`}
          aria-label={newLabel}
        >
          {view === 'journal' ? Icon.book : Icon.plus}
          <AnimatePresence initial={false}>{!narrow && <span>{newLabel}</span>}</AnimatePresence>
        </motion.button>
      </div>
    </header>
  )
}
