import type { CSSProperties } from 'react'
import { AnimatePresence, motion } from 'motion/react'


/**
 * View title. On change the old text tips back and out while the new one rolls in letter by
 * letter, each behind its own mask, coming into focus as it lands. On hover the letters ripple.
 */
export function KineticTitle({ text }: { text: string }) {
  const chars = Array.from(text)
  return (
    <h1 className="kt" aria-label={text}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={text} className="kt-line" aria-hidden="true">
          {chars.map((c, i) => (
            <span className="kt-mask" key={i} style={{ '--i': i } as CSSProperties}>
              <motion.span
                className="kt-ch"
                initial={{ y: '110%', rotateX: -75, opacity: 0, filter: 'blur(6px)' }}
                animate={{
                  y: '0%', rotateX: 0, opacity: 1, filter: 'blur(0px)',
                  transition: { type: 'spring', stiffness: 260, damping: 22, mass: 0.8, delay: i * 0.028 },
                }}
                exit={{ y: '-110%', rotateX: 60, opacity: 0, filter: 'blur(4px)', transition: { duration: 0.22, ease: [0.55, 0, 0.75, 0], delay: i * 0.01 } }}
              >
                {c === ' ' ? '\u00a0' : c}
              </motion.span>
            </span>
          ))}
        </motion.span>
      </AnimatePresence>
    </h1>
  )
}
