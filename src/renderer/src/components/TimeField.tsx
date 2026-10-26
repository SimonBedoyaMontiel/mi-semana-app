import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { fromMin, parseClock as parseTime, toMin } from '@shared/dates'
import { cx } from './primitives'

const STEP = 5
const LIST_STEP = 15
const LAST = 23 * 60 + 59
const OPTIONS = Array.from({ length: (24 * 60) / LIST_STEP }, (_, i) => fromMin(i * LIST_STEP))

/**
 * 24-hour time field, independent of the Windows region format. Type freely, nudge with the
 * mouse wheel or ↑/↓ (Shift = 1 h), or pick from the list that opens on focus.
 */
export function TimeField({
  id, value, onChange, invalid, disabled, label,
}: { id?: string; value: string; onChange: (v: string) => void; invalid?: boolean; disabled?: boolean; label?: string }) {
  const autoId = useId()
  const inputId = id ?? autoId
  const listId = `${inputId}-list`
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [text, setText] = useState(value)
  const [open, setOpen] = useState(false)

  useEffect(() => setText(value), [value])

  const commit = (v: string | null): void => {
    if (v) {
      setText(v)
      if (v !== value) onChange(v)
    } else setText(value)
  }
  const nudge = (delta: number): void => {
    const base = value ? toMin(value) : 9 * 60
    commit(fromMin(Math.max(0, Math.min(LAST, Math.round((base + delta) / STEP) * STEP))))
  }

  useEffect(() => {
    const el = input.current
    if (!el) return
    const onWheel = (e: WheelEvent): void => {
      if (disabled) return
      e.preventDefault()
      nudge(e.deltaY < 0 ? STEP : -STEP)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  // Centre the list on the current value when it opens.
  useLayoutEffect(() => {
    if (!open || !list.current) return
    const target = value ? Math.floor(toMin(value) / LIST_STEP) : 36
    const row = list.current.children[target] as HTMLElement | undefined
    if (row) list.current.scrollTop = row.offsetTop - list.current.clientHeight / 2 + row.offsetHeight / 2
  }, [open, value])

  return (
    <div className={cx('timefield', invalid && 'is-invalid', open && 'is-open')}>
      <input
        ref={input}
        id={inputId}
        className="timefield-input"
        value={text}
        disabled={disabled}
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        maxLength={7}
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        onFocus={e => {
          e.target.select()
          setOpen(true)
        }}
        onBlur={() => {
          setOpen(false)
          commit(parseTime(text))
        }}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            nudge((e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 60 : STEP))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            commit(parseTime(text))
            setOpen(false)
          } else if (e.key === 'Escape' && open) {
            e.stopPropagation()
            setOpen(false)
          }
        }}
      />
      <AnimatePresence>
        {open && (
          <motion.div
            ref={list}
            id={listId}
            role="listbox"
            className="timefield-list"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
            transition={{ type: 'spring', stiffness: 500, damping: 34 }}
          >
            {OPTIONS.map(t => (
              <button
                key={t}
                type="button"
                role="option"
                aria-selected={t === value}
                tabIndex={-1}
                className={cx('timefield-opt', t === value && 'is-selected', t.endsWith(':00') && 'is-hour')}
                onMouseDown={e => {
                  e.preventDefault() // keep focus in the input until we commit
                  commit(t)
                  setOpen(false)
                  input.current?.blur()
                }}
              >
                {t}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
