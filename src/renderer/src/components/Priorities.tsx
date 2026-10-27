import { useState } from 'react'
import type { CSSProperties } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Top } from '@shared/model'
import { useStore } from '@/state/store'
import { burst, celebrate, newId } from '@/lib/fx'
import { Check, Icon, cx } from './primitives'

const EMPTY: readonly Top[] = []

/** The day's three most important things. Typing fills the next free slot; all three done is celebrated. */
export function Priorities({ date }: { date: string }) {
  const items = useStore(s => s.data!.priorities[date] ?? EMPTY)
  const dispatch = useStore(s => s.dispatch)
  const notify = useStore(s => s.notify)
  const [draft, setDraft] = useState('')

  const save = (next: Top[]): void => dispatch({ type: 'priorities.set', date, items: next })

  const toggle = (t: Top, el: Element): void => {
    const next = items.map(x => (x.id === t.id ? { ...x, done: !x.done } : x))
    save(next)
    if (t.done) return
    burst(el, 'var(--accent)')
    if (next.length === 3 && next.every(x => x.done)) {
      window.setTimeout(() => {
        celebrate()
        notify('Cumpliste tus tres prioridades. Gran día.')
      }, 260)
    }
  }

  const add = (): void => {
    const text = draft.trim()
    if (!text || items.length >= 3) return
    save([...items, { id: newId(), text, done: false }])
    setDraft('')
  }

  const remove = (t: Top): void => save(items.filter(x => x.id !== t.id))
  const done = items.filter(x => x.done).length

  return (
    <section className="today-section prios" aria-label="Prioridades del día">
      <header className="panel-head">
        <h3>Prioridades</h3>
        <span className="prio-dots" aria-label={`${done} de ${items.length || 3} cumplidas`}>
          {[0, 1, 2].map(i => (
            <motion.i key={i} className={cx(i < items.length && 'is-set', i < done && 'is-done')} animate={{ scale: i < done ? [1, 1.5, 1] : 1 }} transition={{ duration: 0.35 }} />
          ))}
        </span>
      </header>
      <ol className="prio-list">
        <AnimatePresence initial={false}>
          {items.map((t, i) => (
            <motion.li
              key={t.id}
              layout
              className={cx('prio-item', t.done && 'is-done')}
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            >
              <span className="prio-n">{i + 1}</span>
              <button type="button" className="tick" style={{ '--c': 'var(--accent)' } as CSSProperties} aria-label={t.done ? 'Marcar pendiente' : 'Marcar hecha'} onClick={e => toggle(t, e.currentTarget)}>
                <Check on={t.done} size={11} />
              </button>
              <span className="prio-text">{t.text}</span>
              <button type="button" className="prio-x" aria-label={`Quitar ${t.text}`} onClick={() => remove(t)}>{Icon.close}</button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
      <AnimatePresence initial={false}>
        {items.length < 3 && (
          <motion.form
            className="prio-add"
            onSubmit={e => { e.preventDefault(); add() }}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <span className="prio-n">{items.length + 1}</span>
            <input
              value={draft}
              maxLength={120}
              placeholder={items.length ? 'Otra prioridad…' : '¿Qué es lo más importante hoy?'}
              onChange={e => setDraft(e.target.value)}
              aria-label="Nueva prioridad"
            />
          </motion.form>
        )}
      </AnimatePresence>
    </section>
  )
}
