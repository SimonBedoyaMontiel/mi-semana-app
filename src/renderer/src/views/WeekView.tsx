import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { DAYS_SHORT, fromIso, toIso, weekDates } from '@shared/dates'
import { dayProgress } from '@shared/habits'
import { useStore } from '@/state/store'
import { useEventIndex, useToday } from '@/state/hooks'
import { cx } from '@/components/primitives'
import { Timeline } from './Timeline'
import { slide } from './MonthView'

export function WeekView() {
  const date = useStore(s => s.date)
  const dir = useStore(s => s.dir)
  const openDay = useStore(s => s.openDay)
  const openSheet = useStore(s => s.openSheet)
  const habits = useStore(s => s.data!.habits)
  const log = useStore(s => s.data!.habitLog)
  const idx = useEventIndex()
  const today = useToday()
  const days = useMemo(() => weekDates(fromIso(date)).map(toIso), [date])
  const key = days[0]!

  return (
    <AnimatePresence mode="popLayout" initial={false} custom={dir}>
      <motion.div key={key} className="week" custom={dir} variants={slide} initial="enter" animate="center" exit="exit">
        <div className="week-head">
          <span />
          {days.map((d, i) => {
            const p = d <= today ? dayProgress(habits, log, d) : { done: 0, total: 0 }
            return (
              <button key={d} type="button" className={cx('wh', d === today && 'is-today', d < today && 'is-past')} onClick={() => openDay(d)} style={{ '--i': i } as CSSProperties}>
                <span className="wh-dn">{DAYS_SHORT[i]}</span>
                <span className="wh-num">{fromIso(d).getDate()}</span>
                <span className={cx('wh-meter', p.total > 0 && p.done === p.total && 'is-full')}>
                  <span style={{ transform: `scaleX(${p.total ? p.done / p.total : 0})` }} />
                </span>
              </button>
            )
          })}
          <span className="week-allday-label">sin hora</span>
          {days.map(d => (
            <div key={d} className="week-allday">
              {(idx.get(d) ?? []).filter(e => !e.start).map(e => (
                <button key={e.id} type="button" className={cx('pill-ev', e.done && 'is-done')} style={{ '--c': `var(--cat-${e.cat})` } as CSSProperties} onClick={() => openSheet({ kind: 'event', event: e })}>
                  {e.text}
                </button>
              ))}
            </div>
          ))}
        </div>
        <Timeline days={days} idx={idx} hh={52} today={today} compact />
      </motion.div>
    </AnimatePresence>
  )
}
