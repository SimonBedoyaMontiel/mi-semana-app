import { memo, useMemo, useRef } from 'react'
import type { CSSProperties } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Habit, HabitLog } from '@shared/model'
import { DAYS_LETTER, addDays, fromIso, mondayOf, toIso, weekDates } from '@shared/dates'
import { SUGGESTIONS, countOf, dayProgress, habitMeta, isActiveOn, streak } from '@shared/habits'
import { useStore } from '@/state/store'
import { useToday } from '@/state/hooks'
import { tapHabit } from '@/state/actions'
import { burst, newId } from '@/lib/fx'
import { Check, Icon, Ring, cx } from '@/components/primitives'

const HEAT_WEEKS = 18

const Cell = memo(function Cell({ habit, date, count, future }: { habit: Habit; date: string; count: number; future: boolean }) {
  const ref = useRef<HTMLButtonElement>(null)
  const done = count >= habit.target
  return (
    <motion.button
      ref={ref}
      type="button"
      className={cx('hc', done && 'is-done')}
      disabled={future}
      whileTap={{ scale: 0.82 }}
      whileHover={future ? undefined : { scale: 1.12 }}
      onClick={() => tapHabit(habit, date, ref.current)}
      aria-label={`${habit.name}, ${date}: ${count} de ${habit.target}`}
    >
      <Ring value={count / habit.target} size={34} stroke={3} color="var(--c)">
        <motion.span className="hc-core" initial={false} animate={{ scale: done ? 1 : 0 }} transition={{ type: 'spring', stiffness: 520, damping: 22 }} />
        {done || habit.target === 1 ? <Check on={done} size={13} /> : count > 0 ? <span className="hc-n">{count}</span> : null}
      </Ring>
    </motion.button>
  )
})

function Heatmap({ habits, log, today }: { habits: readonly Habit[]; log: HabitLog; today: string }) {
  const weeks = useMemo(() => {
    const end = mondayOf(fromIso(today))
    return Array.from({ length: HEAT_WEEKS }, (_, w) => {
      const mon = addDays(end, (w - HEAT_WEEKS + 1) * 7)
      return Array.from({ length: 7 }, (_, d) => {
        const iso = toIso(addDays(mon, d))
        if (iso > today) return { iso, v: -1 }
        const p = dayProgress(habits, log, iso)
        return { iso, v: p.total ? p.done / p.total : -1 }
      })
    })
  }, [habits, log, today])

  return (
    <div className="heat" role="img" aria-label={`Constancia de las últimas ${HEAT_WEEKS} semanas`}>
      <div className="heat-days" aria-hidden="true">{DAYS_LETTER.map(d => <span key={d}>{d}</span>)}</div>
      <div className="heat-grid">
        {weeks.map((week, w) => (
          <div key={w} className="heat-col">
            {week.map(c => (
              <span
                key={c.iso}
                title={c.v < 0 ? c.iso : `${c.iso}: ${Math.round(c.v * 100)}%`}
                className={cx('heat-cell', c.v < 0 && 'is-empty', c.v === 1 && 'is-full')}
                style={{ '--v': Math.max(0, c.v), '--i': w * 7 } as CSSProperties}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="heat-legend" aria-hidden="true"><span>menos</span>{[0.15, 0.4, 0.7, 1].map(v => <i key={v} style={{ '--v': v } as CSSProperties} />)}<span>más</span></div>
    </div>
  )
}

export function HabitsView() {
  const date = useStore(s => s.date)
  const habits = useStore(s => s.data!.habits)
  const log = useStore(s => s.data!.habitLog)
  const dispatch = useStore(s => s.dispatch)
  const openSheet = useStore(s => s.openSheet)
  const notify = useStore(s => s.notify)
  const today = useToday()
  const days = useMemo(() => weekDates(fromIso(date)).map(toIso), [date])
  const names = new Set(habits.map(h => h.name.toLowerCase()))
  const ideas = SUGGESTIONS.filter(s => !names.has(s.name.toLowerCase()))

  return (
    <div className="habits">
      <section className="panel habits-table">
        <div className="ht-scroll">
          <div className="ht" style={{ '--days': days.length } as CSSProperties}>
            <span className="ht-h ht-name-h">Hábito</span>
            {days.map((d, i) => (
              <span key={d} className={cx('ht-h', d === today && 'is-today')}>
                {DAYS_LETTER[i]}<b>{fromIso(d).getDate()}</b>
              </span>
            ))}
            <span className="ht-h">Semana</span>
            <AnimatePresence initial={false}>
              {habits.map((h, r) => {
                const s = streak(h, log, today)
                let ok = 0
                let due = 0
                for (const d of days) if (d <= today && isActiveOn(h, d)) { due++; if (countOf(log, h.id, d) >= h.target) ok++ }
                return (
                  <motion.div key={h.id} className="ht-row" style={{ '--c': `var(--${h.color})`, '--i': r } as CSSProperties} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <div className="ht-name">
                      <span className="ht-sw" />
                      <div>
                        <div className="ht-title">
                          {h.name}
                          {h.kind === 'suplemento' && <span className="tag">supl.</span>}
                          {s > 1 && <span className="streak">{Icon.flame}{s}</span>}
                        </div>
                        <div className="ht-meta">{habitMeta(h)}</div>
                      </div>
                    </div>
                    {days.map(d => (
                      <div key={d} className={cx('ht-cell', d === today && 'is-today')}>
                        {isActiveOn(h, d) ? <Cell habit={h} date={d} count={countOf(log, h.id, d)} future={d > today} /> : <i className="ht-off" />}
                      </div>
                    ))}
                    <div className="ht-end">
                      <span className="ht-score">{ok}/{due}</span>
                      <button type="button" className="icon-btn" aria-label={`Editar ${h.name}`} onClick={() => openSheet({ kind: 'habit', habit: h })}>{Icon.pen}</button>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </div>
        {!habits.length && (
          <div className="habits-empty">
            <div className="orbit" aria-hidden="true"><i /><i /><i /></div>
            <p>Sigue suplementos, agua, ejercicio o cualquier rutina. Elige una idea de abajo o crea la tuya.</p>
          </div>
        )}
        {ideas.length > 0 && (
          <div className="ideas">
            <span>Ideas rápidas</span>
            {ideas.map(s => (
              <motion.button
                key={s.name}
                type="button"
                className="idea"
                style={{ '--c': `var(--${s.color})` } as CSSProperties}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.92 }}
                onClick={e => {
                  burst(e.currentTarget, `var(--${s.color})`)
                  dispatch({
                    type: 'habit.upsert',
                    habit: {
                      id: newId(), name: s.name, kind: s.kind, dose: s.dose ?? '', target: s.target ?? 1, unit: s.unit ?? '',
                      slot: s.slot, days: s.days ?? [0, 1, 2, 3, 4, 5, 6], color: s.color, createdAt: today,
                    },
                  })
                  notify(`Añadido: ${s.name}. Puedes editar la dosis o los días con el lápiz.`)
                }}
              >
                <b aria-hidden="true"><svg viewBox="0 0 12 12" width="10" height="10"><path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg></b>{s.name}{s.dose && <em>{s.dose}</em>}
              </motion.button>
            ))}
          </div>
        )}
      </section>
      {habits.length > 0 && (
        <section className="panel">
          <header className="panel-head"><h3>Constancia</h3><span className="count">últimas {HEAT_WEEKS} semanas</span></header>
          <Heatmap habits={habits} log={log} today={today} />
        </section>
      )}
    </div>
  )
}
