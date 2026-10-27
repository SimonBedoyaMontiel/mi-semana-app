import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { FOCUS_CHOICES } from '@shared/constants'
import { toMin } from '@shared/dates'
import { useStore } from '@/state/store'
import { useEventIndex, useToday } from '@/state/hooks'
import { finishFocus, fmtClock, leftOf, useFocus } from '@/lib/focus'
import { AnimatedNumber, Chip, Icon, Ring, cx } from './primitives'

/** Mounted once: counts down, reports progress outside the page and ends the block at zero. */
export function FocusTicker() {
  const block = useFocus(s => s.block)
  useEffect(() => {
    if (!block) return
    const tick = (): void => {
      const left = leftOf(block)
      const total = block.minutes * 60_000
      if (block.endsAt && left <= 0) {
        finishFocus()
        return
      }
      window.api.focusProgress(1 - left / total, { label: `${fmtClock(left)} ${block.label}` })
    }
    tick()
    if (!block.endsAt) return
    const t = window.setInterval(tick, 1000)
    return () => window.clearInterval(t)
  }, [block])
  return null
}

/** Re-renders every second while a block runs. */
function useSecond(on: boolean): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!on) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [on])
  return now
}

export function FocusCard() {
  const block = useFocus(s => s.block)
  const { start, pause, resume, stop } = useFocus.getState()
  const defaultMinutes = useStore(s => s.data!.settings.focusMinutes)
  const focusLog = useStore(s => s.data!.focus)
  const today = useToday()
  const idx = useEventIndex()
  const now = useSecond(!!block?.endsAt)
  const [minutes, setMinutes] = useState(defaultMinutes)
  const [label, setLabel] = useState('')

  // Suggest what is on now, or next.
  const suggestion = useMemo(() => {
    const d = new Date()
    const m = d.getHours() * 60 + d.getMinutes()
    return (idx.get(today) ?? []).find(e => !e.done && (!e.start || toMin(e.end) > m))
  }, [idx, today])
  const todayMinutes = (focusLog[today] ?? []).reduce((n, s) => n + s.minutes, 0)

  const left = block ? leftOf(block, now) : 0
  const progress = block ? 1 - left / (block.minutes * 60_000) : 0

  return (
    <section className="today-section focus" aria-label="Modo enfoque">
      <header className="panel-head">
        <h3>Modo enfoque</h3>
        {todayMinutes > 0 && <span className="count"><AnimatedNumber value={todayMinutes} suffix=" min hoy" /></span>}
      </header>
      <AnimatePresence mode="wait" initial={false}>
        {block ? (
          <motion.div
            key="running"
            className={cx('focus-run', !block.endsAt && 'is-paused')}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
          >
            <Ring value={progress} size={92} stroke={6} className="focus-ring">
              <span className="focus-time-left">{fmtClock(left)}</span>
            </Ring>
            <div className="focus-info">
              <b>{block.label}</b>
              <span>{block.endsAt ? `Bloque de ${block.minutes} min` : 'En pausa'}</span>
              <div className="btn-row">
                {block.endsAt
                  ? <button type="button" className="btn small" onClick={pause}>Pausar</button>
                  : <button type="button" className="btn small primary" onClick={resume}>Seguir</button>}
                <button type="button" className="btn small ghost" onClick={stop}>Detener</button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="idle" className="focus-idle" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            <input
              className="focus-label-input"
              placeholder={suggestion ? suggestion.text : '¿En qué te vas a concentrar?'}
              value={label}
              maxLength={200}
              onChange={e => setLabel(e.target.value)}
              aria-label="En qué te vas a concentrar"
            />
            <div className="chips">
              {FOCUS_CHOICES.map(m => <Chip key={m} active={minutes === m} onClick={() => setMinutes(m)}>{m} min</Chip>)}
            </div>
            <button
              type="button"
              className="btn primary block"
              onClick={() => {
                const text = label || suggestion?.text || 'Enfoque'
                start(minutes, text, !label && suggestion ? (suggestion.seriesId ?? suggestion.id) : undefined)
                setLabel('')
              }}
            >
              {Icon.play}Empezar {minutes} min
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
