import { useEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

const REST_STRETCH = 64
const PEAK_STRETCH = 132
const RADIUS = 240

/**
 * Display title set in a variable-width face. Letters roll in on change, and widen as the
 * cursor approaches — written straight to style in a rAF, so React never re-renders for it.
 */
export function KineticTitle({ text }: { text: string }) {
  const ref = useRef<HTMLHeadingElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el || reduce) return
    let raf = 0
    let px = -1e5
    let py = -1e5
    const apply = (): void => {
      raf = 0
      for (const ch of el.querySelectorAll<HTMLElement>('.kt-ch')) {
        const r = ch.getBoundingClientRect()
        const d = Math.hypot(px - (r.left + r.width / 2), py - (r.top + r.height / 2))
        const f = Math.max(0, 1 - d / RADIUS) ** 2
        ch.style.fontStretch = `${REST_STRETCH + (PEAK_STRETCH - REST_STRETCH) * f}%`
      }
    }
    const queue = (e?: PointerEvent): void => {
      px = e ? e.clientX : -1e5
      py = e ? e.clientY : -1e5
      if (!raf) raf = requestAnimationFrame(apply)
    }
    const move = (e: PointerEvent): void => queue(e)
    const leave = (): void => queue()
    window.addEventListener('pointermove', move, { passive: true })
    document.documentElement.addEventListener('pointerleave', leave)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', move)
      document.documentElement.removeEventListener('pointerleave', leave)
    }
  }, [reduce])

  const chars = Array.from(text)
  return (
    <h1 className="kt" ref={ref} aria-label={text}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={text} className="kt-line" aria-hidden="true">
          {chars.map((c, i) => (
            <span className="kt-mask" key={i}>
              <motion.span
                className="kt-ch"
                initial={{ y: '108%', rotate: 6 }}
                animate={{ y: '0%', rotate: 0, transition: { type: 'spring', stiffness: 320, damping: 30, delay: i * 0.028 } }}
                exit={{ y: '-108%', rotate: -4, transition: { duration: 0.28, ease: [0.7, 0, 0.84, 0], delay: i * 0.012 } }}
              >
                {c === ' ' ? ' ' : c}
              </motion.span>
            </span>
          ))}
        </motion.span>
      </AnimatePresence>
    </h1>
  )
}
