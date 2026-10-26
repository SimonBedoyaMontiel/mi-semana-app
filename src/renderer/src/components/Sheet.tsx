import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { Icon } from './primitives'

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

/** Modal panel: focus is trapped inside, Escape closes, focus returns to the opener. */
export function Sheet({
  title, onClose, children, footer, wide,
}: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const el = panel.current
    const first = el?.querySelector<HTMLElement>('[data-autofocus]') ?? el?.querySelector<HTMLElement>(FOCUSABLE)
    window.setTimeout(() => first?.focus(), 30)
    return () => opener?.focus?.()
  }, [])

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !panel.current) return
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(n => n.offsetParent !== null)
    if (!items.length) return
    const [a, z] = [items[0]!, items[items.length - 1]!]
    if (e.shiftKey && document.activeElement === a) {
      e.preventDefault()
      z.focus()
    } else if (!e.shiftKey && document.activeElement === z) {
      e.preventDefault()
      a.focus()
    }
  }

  return (
    <div className="sheet-layer" onKeyDown={onKeyDown}>
      <motion.div
        className="sheet-backdrop"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.18 } }}
      />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={wide ? 'sheet sheet-wide' : 'sheet'}
        initial={{ opacity: 0, y: 28, scale: 0.97, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transition: { type: 'spring', stiffness: 380, damping: 32 } }}
        exit={{ opacity: 0, y: 16, scale: 0.98, filter: 'blur(6px)', transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
      >
        <header className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">{Icon.close}</button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-foot">{footer}</footer>}
      </motion.div>
    </div>
  )
}
