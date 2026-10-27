import { useState } from 'react'
import type { DragEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { InboxItem } from '@shared/model'
import { longDate } from '@shared/dates'
import { useStore } from '@/state/store'
import { burst, newId } from '@/lib/fx'
import { Icon, PriorityMark } from './primitives'

export const INBOX_MIME = 'application/x-misemana-inbox'

/** Turns an inbox item into an untimed task on `date`. */
export function scheduleInbox(id: string, date: string, from?: Element | null): void {
  const st = useStore.getState()
  const item = st.data?.inbox.find(i => i.id === id)
  if (!item) return
  const eventId = newId()
  st.dispatch({
    type: 'event.upsert',
    event: {
      id: eventId, date, start: '', end: '', text: item.text, cat: item.cat ?? st.lastCat, done: false, createdAt: Date.now(),
      ...(item.priority ? { priority: item.priority } : {}),
    },
  })
  st.dispatch({ type: 'inbox.delete', id })
  burst(from ?? null, 'var(--accent)')
  st.notify(`«${item.text}» programado para el ${longDate(date)}.`, () => {
    const s = useStore.getState()
    s.dispatch({ type: 'event.delete', id: eventId })
    s.dispatch({ type: 'inbox.upsert', item })
  })
}

/** Props that make an element accept inbox items dropped on it. */
export function dropTarget(date: string): {
  onDragOver: (e: DragEvent<HTMLElement>) => void
  onDragLeave: (e: DragEvent<HTMLElement>) => void
  onDrop: (e: DragEvent<HTMLElement>) => void
} {
  return {
    onDragOver: e => {
      if (!e.dataTransfer.types.includes(INBOX_MIME)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      e.currentTarget.classList.add('is-drop')
    },
    onDragLeave: e => e.currentTarget.classList.remove('is-drop'),
    onDrop: e => {
      const id = e.dataTransfer.getData(INBOX_MIME)
      e.currentTarget.classList.remove('is-drop')
      if (!id) return
      e.preventDefault()
      scheduleInbox(id, date, e.currentTarget)
    },
  }
}

/** Things to do with no date yet. Drag one onto a day, or plan it with details. */
export function Inbox() {
  const items = useStore(s => s.data!.inbox)
  const dispatch = useStore(s => s.dispatch)
  const openSheet = useStore(s => s.openSheet)
  const notify = useStore(s => s.notify)
  const date = useStore(s => s.date)
  const [text, setText] = useState('')

  const add = (): void => {
    const t = text.trim()
    if (!t) return
    dispatch({ type: 'inbox.upsert', item: { id: newId(), text: t, createdAt: Date.now() } })
    setText('')
  }
  const remove = (i: InboxItem): void => {
    dispatch({ type: 'inbox.delete', id: i.id })
    notify(`Quitado de la bandeja: ${i.text}`, () => dispatch({ type: 'inbox.upsert', item: i }))
  }

  return (
    <section className="today-section inbox" aria-label="Bandeja de tareas">
      <header className="panel-head">
        <h3>Bandeja</h3>
        {items.length > 0 && <span className="count">{items.length}</span>}
      </header>
      <form className="inbox-add" onSubmit={e => { e.preventDefault(); add() }}>
        {Icon.plus}
        <input value={text} maxLength={200} placeholder="Apunta algo sin fecha…" onChange={e => setText(e.target.value)} aria-label="Nueva tarea sin fecha" />
      </form>
      {items.length > 0 ? (
        <ul className="inbox-list">
          <AnimatePresence initial={false}>
            {[...items].sort((a, b) => b.createdAt - a.createdAt).map(i => (
              <motion.li
                key={i.id}
                layout
                className="inbox-item"
                initial={{ opacity: 0, y: -10, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 30, scale: 0.9, transition: { duration: 0.2 } }}
                transition={{ type: 'spring', stiffness: 420, damping: 26 }}
              >
                <div
                  className="inbox-row"
                  draggable
                  onDragStart={(e: DragEvent<HTMLDivElement>) => {
                    e.dataTransfer.setData(INBOX_MIME, i.id)
                    e.dataTransfer.effectAllowed = 'move'
                    document.documentElement.classList.add('is-dragging-inbox')
                  }}
                  onDragEnd={() => document.documentElement.classList.remove('is-dragging-inbox')}
                >
                  <span className="grip" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>
                  <span className="inbox-text">{i.text}</span>
                  <PriorityMark value={i.priority} />
                  <button
                    type="button"
                    className="inbox-btn"
                    title="Programar"
                    aria-label={`Programar ${i.text}`}
                    onClick={() => openSheet({ kind: 'event', preset: { date, text: i.text, inboxId: i.id } })}
                  >
                    {Icon.calendar}
                  </button>
                  <button type="button" className="inbox-btn" title="Quitar" aria-label={`Quitar ${i.text}`} onClick={() => remove(i)}>{Icon.close}</button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <p className="empty">Lo que no tiene fecha va aquí. Luego arrástralo a un día del calendario.</p>
      )}
    </section>
  )
}
