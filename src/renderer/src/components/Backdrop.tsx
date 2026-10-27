import { AnimatePresence, motion } from 'motion/react'
import type { Backdrop as Kind } from '@shared/model'
import { usePhoto } from '@/lib/appearance'

/**
 * Blurred scenery behind the calendar. Gradient scenes are four large soft blobs that drift on
 * the compositor; the own picture is shown enlarged and blurred. Colours live in app.css, keyed by
 * the html[data-backdrop] attribute, so light and dark mode each get their own mix.
 */
export function Backdrop({ kind }: { kind: Kind }) {
  const photo = usePhoto()
  const show = kind === 'photo' ? !!photo : kind !== 'none'
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key={kind === 'photo' ? `photo-${photo?.length ?? 0}` : kind}
          className="backdrop"
          aria-hidden="true"
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1, transition: { duration: 1.1, ease: [0.22, 1, 0.36, 1] } }}
          exit={{ opacity: 0, transition: { duration: 0.6 } }}
        >
          {kind === 'photo' && photo ? (
            <img className="backdrop-photo" src={photo} alt="" />
          ) : (
            <>
              <i className="blob b1" />
              <i className="blob b2" />
              <i className="blob b3" />
              <i className="blob b4" />
            </>
          )}
          <span className="backdrop-veil" />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
