import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { motion } from 'motion/react'
import type { Energy, Journal } from '@shared/model'
import { ENERGY, ENERGY_LABEL, JOURNAL_PROMPTS, MOODS, MOOD_LABEL } from '@shared/constants'
import { useStore } from '@/state/store'
import { burst } from '@/lib/fx'
import { Segmented, cx } from './primitives'

export const MOOD_COLOR: Record<number, string> = {
  1: 'var(--vermilion)',
  2: 'var(--amber)',
  3: 'var(--cat-otro)',
  4: 'var(--teal)',
  5: 'var(--green)',
}

const EMPTY_ENTRY: Journal = { gratitude: [], answer: '' }

/** The day's question: picked from the date, so every device asks the same one. */
export function promptFor(date: string): string {
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number)
  const n = Math.round(Date.UTC(y, m - 1, d) / 864e5)
  return JOURNAL_PROMPTS[n % JOURNAL_PROMPTS.length]!
}

const isEmpty = (e: Journal): boolean => !e.mood && !e.energy && !e.gratitude.some(g => g.trim()) && !e.answer.trim()

/** A face drawn from strokes; the mouth morphs between moods. */
export function MoodFace({ mood, size = 26 }: { mood: number; size?: number }) {
  const k = (mood - 3) * 2.4
  return (
    <svg className="mood-face" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" />
      <motion.circle cx="8.8" cy="10" r="1.1" className="mood-eye" animate={{ cy: mood <= 2 ? 10.5 : 10 }} />
      <motion.circle cx="15.2" cy="10" r="1.1" className="mood-eye" animate={{ cy: mood <= 2 ? 10.5 : 10 }} />
      <motion.path
        initial={false}
        animate={{ d: `M8 ${15 - k / 3} Q12 ${15 + k} 16 ${15 - k / 3}` }}
        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
      />
    </svg>
  )
}

function useEntry(date: string): [Journal, (patch: Partial<Journal>) => void] {
  const stored = useStore(s => s.data!.journal[date])
  const dispatch = useStore(s => s.dispatch)
  const entry = stored ?? EMPTY_ENTRY
  const set = (patch: Partial<Journal>): void => {
    const latest = useStore.getState().data!.journal[date] ?? EMPTY_ENTRY
    const next = { ...latest, ...patch }
    dispatch({ type: 'journal.set', date, entry: isEmpty(next) ? null : next })
  }
  return [entry, set]
}

/** Five faces; the chosen one fills with its colour and bounces. */
export function MoodPicker({ date, compact }: { date: string; compact?: boolean }) {
  const [entry, set] = useEntry(date)
  return (
    <div className={cx('moods', compact && 'is-compact')} role="radiogroup" aria-label="Ánimo del día">
      {MOODS.map(m => {
        const on = entry.mood === m
        return (
          <motion.button
            key={m}
            type="button"
            role="radio"
            aria-checked={on}
            title={MOOD_LABEL[m]}
            aria-label={MOOD_LABEL[m]}
            className={cx('mood', on && 'is-on')}
            style={{ '--c': MOOD_COLOR[m] } as CSSProperties}
            whileHover={{ y: -3, scale: 1.12 }}
            whileTap={{ scale: 0.85 }}
            animate={on ? { scale: [1, 1.3, 1], rotate: [0, -8, 0] } : { scale: 1, rotate: 0 }}
            transition={{ duration: 0.4 }}
            onClick={e => {
              set({ mood: on ? undefined : m })
              if (!on) burst(e.currentTarget, MOOD_COLOR[m])
            }}
          >
            <MoodFace mood={m} size={compact ? 24 : 30} />
            {!compact && <span>{MOOD_LABEL[m]}</span>}
          </motion.button>
        )
      })}
    </div>
  )
}

/** Text that saves itself a moment after typing stops, and follows other devices when not focused. */
function useDraft(value: string, save: (v: string) => void): [string, (v: string) => void, { onFocus: () => void; onBlur: () => void }] {
  const [text, setText] = useState(value)
  const timer = useRef(0)
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setText(value)
  }, [value])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const change = (v: string): void => {
    setText(v)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => save(v), 450)
  }
  return [text, change, { onFocus: () => (focused.current = true), onBlur: () => (focused.current = false) }]
}

function Gratitude({ date, i, value, onSave }: { date: string; i: number; value: string; onSave: (i: number, v: string) => void }) {
  const [text, change, focus] = useDraft(value, v => onSave(i, v))
  return (
    <label className="grat-row">
      <span className="grat-n">{i + 1}</span>
      <input key={date} value={text} maxLength={140} placeholder={['Algo bueno de hoy…', 'Otra cosa…', 'Y una más…'][i]} onChange={e => change(e.target.value)} {...focus} />
    </label>
  )
}

function Notes({ date }: { date: string }) {
  const stored = useStore(s => s.data!.notes[date] ?? '')
  const dispatch = useStore(s => s.dispatch)
  const [text, change, focus] = useDraft(stored, v => dispatch({ type: 'note.set', date, text: v }))
  return (
    <textarea className="notes" value={text} placeholder="Cómo te sentiste, ideas, pendientes…" maxLength={4000} onChange={e => change(e.target.value)} {...focus} />
  )
}

/** The day's journal: mood, energy, three good things, the day's question and a free note. */
export function JournalPanel({ date }: { date: string }) {
  const [entry, set] = useEntry(date)
  const [answer, changeAnswer, answerFocus] = useDraft(entry.answer, v => set({ answer: v }))
  const saveGratitude = (i: number, v: string): void => {
    const g = [0, 1, 2].map(k => (k === i ? v : (useStore.getState().data!.journal[date]?.gratitude[k] ?? '')))
    while (g.length && !g[g.length - 1]!.trim()) g.pop()
    set({ gratitude: g })
  }
  return (
    <div className="journal">
      <div className="j-block">
        <span className="j-label">Ánimo</span>
        <MoodPicker date={date} />
      </div>
      <div className="j-block">
        <span className="j-label">Energía</span>
        <Segmented<Energy | 'none'>
          label="Energía"
          layoutId={`energy-${date}`}
          size="s"
          value={entry.energy ?? 'none'}
          onChange={v => set({ energy: v === 'none' ? undefined : v })}
          options={[{ value: 'none', label: 'Sin indicar' }, ...ENERGY.map(e => ({ value: e, label: ENERGY_LABEL[e] }))]}
        />
      </div>
      <div className="j-block">
        <span className="j-label">Tres cosas buenas</span>
        {[0, 1, 2].map(i => <Gratitude key={`${date}-${i}`} date={date} i={i} value={entry.gratitude[i] ?? ''} onSave={saveGratitude} />)}
      </div>
      <div className="j-block">
        <span className="j-label j-prompt">{promptFor(date)}</span>
        <textarea className="notes short" value={answer} maxLength={1000} placeholder="Tu respuesta…" onChange={e => changeAnswer(e.target.value)} {...answerFocus} />
      </div>
      <div className="j-block">
        <span className="j-label">Notas</span>
        <Notes date={date} />
      </div>
    </div>
  )
}
