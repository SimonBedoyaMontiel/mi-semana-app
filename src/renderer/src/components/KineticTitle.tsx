import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

const REST_STRETCH = 68
const PEAK_STRETCH = 135
const RADIUS = 240
const POP = { type: 'spring', stiffness: 320, damping: 17, mass: 0.7 } as const

/**
 * Display title set in a variable-width face. Letters widen as the cursor approaches (written
 * straight to style in a rAF, so React never re-renders for it) and roll in one by one, with a
 * little overshoot, whenever the text changes.
 */
export function KineticTitle({ text }: { text: string }) {
  const ref = useRef<HTMLHeadingElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el || reduce || !matchMedia('(hover: hover)').matches) return
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
            <span className="kt-mask" key={i} style={{ '--i': i } as CSSProperties}>
              <motion.span
                className="kt-ch"
                initial={{ y: '110%', rotate: 8, filter: 'blur(5px)' }}
                animate={{ y: '0%', rotate: 0, filter: 'blur(0px)', transition: { ...POP, delay: i * 0.03 } }}
                exit={{ y: '-110%', rotate: -5, filter: 'blur(4px)', transition: { duration: 0.26, ease: [0.7, 0, 0.84, 0], delay: i * 0.012 } }}
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
