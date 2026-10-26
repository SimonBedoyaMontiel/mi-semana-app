import { memo, useRef } from 'react'
import type { CSSProperties } from 'react'
import { motion } from 'motion/react'
import type { Habit } from '@shared/model'
import { habitMeta } from '@shared/habits'
import { tapHabit } from '@/state/actions'
import { Check, Ring, cx } from './primitives'

export const HabitTile = memo(function HabitTile({
  habit, date, count, future, dense,
}: { habit: Habit; date: string; count: number; future: boolean; dense?: boolean }) {
  const ringRef = useRef<HTMLSpanElement>(null)
  const done = count >= habit.target
  const multi = habit.target > 1
  return (
    <div className={cx('htile', done && 'is-done', dense && 'is-dense')} style={{ '--c': `var(--${habit.color})` } as CSSProperties}>
      <motion.button
        type="button"
        className="htile-main"
        disabled={future}
        whileTap={{ scale: 0.97 }}
        onClick={() => tapHabit(habit, date, ringRef.current)}
        aria-label={`${habit.name}: ${count} de ${habit.target}${done ? ', completado' : ''}`}
      >
        <span className="htile-ring" ref={ringRef}>
          <Ring value={count / habit.target} size={dense ? 34 : 40} stroke={3.5} color="var(--c)">
            <motion.span className="htile-core" initial={false} animate={{ scale: done ? 1 : 0 }} transition={{ type: 'spring', stiffness: 520, damping: 22 }} />
            {done || !multi ? <Check on={done} size={dense ? 13 : 15} /> : <span className="htile-n">{count}</span>}
          </Ring>
        </span>
        <span className="htile-text">
          <span className="htile-name">
            {habit.name}
            {habit.kind === 'suplemento' && <span className="tag">supl.</span>}
          </span>
          {!dense && <span className="htile-meta">{habitMeta(habit)}{multi ? ` · ${count}/${habit.target}` : ''}</span>}
        </span>
      </motion.button>
      {multi && count > 0 && !future && (
        <motion.button
          type="button"
          className="mini"
          aria-label={`Quitar uno de ${habit.name}`}
          onClick={() => tapHabit(habit, date, null, -1)}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileTap={{ scale: 0.85 }}
        >
          −
        </motion.button>
      )}
    </div>
  )
})
