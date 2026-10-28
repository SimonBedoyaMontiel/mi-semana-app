import { memo, useMemo } from 'react'
import type { CSSProperties } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Variants } from 'motion/react'
import type { EventItem } from '@shared/events'
import { DAYS, DAYS_SHORT, MONTHS, fromIso, monthMatrix, toIso } from '@shared/dates'
import { evColor } from '@shared/events'
import { dayProgress } from '@shared/habits'
import { FinIcon } from '@/components/FinIcon'
import { useStore } from '@/state/store'
import { useCurrency, useEventIndex, useHolidays, useSubsIndex, useToday } from '@/state/hooks'
import type { Subscription } from '@shared/model'
import { fmtMoney } from '@shared/money'
import { Icon, PriorityMark, cx } from '@/components/primitives'
import { dropTarget } from '@/components/Inbox'

const MAX_CHIPS = 3

export const slide: Variants = {
  enter: (dir: number) => ({ x: dir * 48, opacity: 0, filter: 'blur(6px)' }),
  center: { x: 0, opacity: 1, filter: 'blur(0px)', transition: { type: 'spring', stiffness: 260, damping: 26 } },
  exit: (dir: number) => ({ x: dir * -32, opacity: 0, filter: 'blur(4px)', transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }),
}

/** Open a day with a shared-element morph: the cell gets a layoutId for one frame, then the view switches. */
export function openDayWithMorph(date: string): void {
  useStore.setState({ morph: date })
  requestAnimationFrame(() => useStore.getState().openDay(date))
  window.setTimeout(() => useStore.setState({ morph: null }), 700)
}

const MonthCell = memo(function MonthCell({
  iso, i, out, today, past, events, done, total, morph, holiday, subs, currency,
}: {
  iso: string; i: number; out: boolean; today: boolean; past: boolean
  events: readonly EventItem[]; done: number; total: number; morph: boolean; holiday?: string
  subs: readonly Subscription[]; currency: string
}) {
  const d = fromIso(iso)
  const openSheet = useStore(s => s.openSheet)
  return (
    <div
      className={cx('cell', 'spot', out && 'is-out', today && 'is-today', past && 'is-past', holiday && 'is-holiday')}
      style={{ '--i': i } as CSSProperties}
      role="button"
      tabIndex={0}
      title={holiday}
      {...dropTarget(iso)}
      aria-label={`${DAYS[(d.getDay() + 6) % 7]} ${d.getDate()} de ${MONTHS[d.getMonth()]}${holiday ? `, festivo: ${holiday}` : ''}: ${events.length} eventos`}
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
      {holiday && <span className="cell-hol">{Icon.star}<span>{holiday}</span></span>}
      <ul className="cell-evs">
        {events.slice(0, MAX_CHIPS).map(e => (
          <li
            key={e.id}
            className={cx('cell-ev', e.done && 'is-done', e.priority && `is-${e.priority}`, e.spanOf && 'is-span', e.spanFirst && 'span-first', e.spanLast && 'span-last')}
            style={{ '--c': evColor(e) } as CSSProperties}
          >
            <i />
            {e.start && <time>{e.start}</time>}
            <span>{e.text}</span>
            {e.link && <b className="cell-video" aria-label="Con enlace" />}
            <PriorityMark value={e.priority} />
          </li>
        ))}
        {events.length > MAX_CHIPS && <li className="cell-more">+{events.length - MAX_CHIPS}</li>}
        {subs.map(s => (
          <li key={s.id} className="cell-sub" style={{ '--c': `var(--${s.color})` } as CSSProperties} title={`${s.name}: ${fmtMoney(s.cents, currency)}`}>
            <FinIcon name={s.icon ?? 'tarjeta'} /><span>{s.name}</span>
          </li>
        ))}
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
  const holidayOf = useHolidays()
  const subsIdx = useSubsIndex()
  const currency = useCurrency()
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
                holiday={holidayOf(iso)}
                subs={subsIdx.get(iso) ?? NO_SUBS}
                currency={currency}
              />
            )
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

const EMPTY: readonly EventItem[] = []
const NO_SUBS: readonly Subscription[] = []
