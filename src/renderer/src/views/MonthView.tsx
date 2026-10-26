import { memo, useMemo } from 'react'
import type { CSSProperties } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Variants } from 'motion/react'
import type { CalendarEvent } from '@shared/model'
import { DAYS, DAYS_SHORT, MONTHS, fromIso, monthMatrix, toIso } from '@shared/dates'
import { dayProgress } from '@shared/habits'
import { useStore } from '@/state/store'
import { useEventIndex, useToday } from '@/state/hooks'
import { cx } from '@/components/primitives'

const MAX_CHIPS = 3

export const slide: Variants = {
  enter: (dir: number) => ({ x: dir * 80, opacity: 0, filter: 'blur(6px)' }),
  center: { x: 0, opacity: 1, filter: 'blur(0px)', transition: { type: 'spring', stiffness: 260, damping: 32 } },
  exit: (dir: number) => ({ x: dir * -80, opacity: 0, filter: 'blur(6px)', transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }),
}

/** Open a day with a shared-element morph: the cell gets a layoutId for one frame, then the view switches. */
export function openDayWithMorph(date: string): void {
  useStore.setState({ morph: date })
  requestAnimationFrame(() => useStore.getState().openDay(date))
  window.setTimeout(() => useStore.setState({ morph: null }), 700)
}

const MonthCell = memo(function MonthCell({
  iso, i, out, today, past, events, done, total, morph,
}: {
  iso: string; i: number; out: boolean; today: boolean; past: boolean
  events: readonly CalendarEvent[]; done: number; total: number; morph: boolean
}) {
  const d = fromIso(iso)
  const openSheet = useStore(s => s.openSheet)
  return (
    <div
      className={cx('cell', out && 'is-out', today && 'is-today', past && 'is-past')}
      style={{ '--i': i } as CSSProperties}
      role="button"
      tabIndex={0}
      aria-label={`${DAYS[(d.getDay() + 6) % 7]} ${d.getDate()} de ${MONTHS[d.getMonth()]}: ${events.length} eventos`}
      onClick={() => openDayWithMorph(iso)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          openDayWithMorph(iso)
        }
      }}
    >
      {morph ? <motion.span layoutId={`day-${iso}`} className="cell-bg" style={{ borderRadius: 14 }} /> : <span className="cell-bg" />}
      <div className="cell-top">
        <span className="cell-num">{d.getDate()}</span>
        <button
          type="button"
          className="cell-add"
          tabIndex={-1}
          aria-label="Añadir evento"
          onClick={e => {
            e.stopPropagation()
            openSheet({ kind: 'event', preset: { date: iso } })
          }}
        >
          +
        </button>
      </div>
      <ul className="cell-evs">
        {events.slice(0, MAX_CHIPS).map(e => (
          <li key={e.id} className={cx('cell-ev', e.done && 'is-done')} style={{ '--c': `var(--cat-${e.cat})` } as CSSProperties}>
            <i />
            {e.start && <time>{e.start}</time>}
            <span>{e.text}</span>
          </li>
        ))}
        {events.length > MAX_CHIPS && <li className="cell-more">+{events.length - MAX_CHIPS}</li>}
      </ul>
      {total > 0 && (
        <div className={cx('cell-meter', done === total && 'is-full')} title={`Hábitos ${done}/${total}`}>
          <span style={{ transform: `scaleX(${done / total})` }} />
        </div>
      )}
    </div>
  )
})

export function MonthView() {
  const date = useStore(s => s.date)
  const dir = useStore(s => s.dir)
  const morph = useStore(s => s.morph)
  const habits = useStore(s => s.data!.habits)
  const log = useStore(s => s.data!.habitLog)
  const idx = useEventIndex()
  const today = useToday()
  const monthKey = date.slice(0, 7)
  const cells = useMemo(() => monthMatrix(fromIso(`${monthKey}-01`)).map(toIso), [monthKey])

  return (
    <div className="month">
      <div className="month-wd" aria-hidden="true">
        {DAYS_SHORT.map(d => <span key={d}>{d}</span>)}
      </div>
      <AnimatePresence mode="popLayout" initial={false} custom={dir}>
        <motion.div
          key={monthKey}
          className={cx('month-grid', dir === 0 && 'is-fresh')}
          style={{ gridTemplateRows: `repeat(${cells.length / 7}, minmax(0, 1fr))` }}
          custom={dir}
          variants={slide}
          initial="enter"
          animate="center"
          exit="exit"
        >
          {cells.map((iso, i) => {
            const p = iso <= today ? dayProgress(habits, log, iso) : { done: 0, total: 0 }
            return (
              <MonthCell
                key={iso}
                iso={iso}
                i={i}
                out={iso.slice(0, 7) !== monthKey}
                today={iso === today}
                past={iso < today}
                events={idx.get(iso) ?? EMPTY}
                done={p.done}
                total={p.total}
                morph={morph === iso}
              />
            )
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

const EMPTY: readonly CalendarEvent[] = []
