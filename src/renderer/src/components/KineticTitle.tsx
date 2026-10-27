import { AnimatePresence, motion } from 'motion/react'

const EASE = [0.22, 1, 0.36, 1] as const

/**
 * View title. On change the old text slides up and out while the new one rises in, letter by
 * letter, each behind its own mask — a short, typographic transition rather than an effect.
 */
export function KineticTitle({ text }: { text: string }) {
  const chars = Array.from(text)
  return (
    <h1 className="kt" aria-label={text}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={text} className="kt-line" aria-hidden="true">
          {chars.map((c, i) => (
            <span className="kt-mask" key={i}>
              <motion.span
                className="kt-ch"
                initial={{ y: '105%' }}
                animate={{ y: '0%', transition: { duration: 0.5, ease: EASE, delay: i * 0.018 } }}
                exit={{ y: '-105%', transition: { duration: 0.22, ease: [0.55, 0, 0.75, 0], delay: i * 0.008 } }}
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
