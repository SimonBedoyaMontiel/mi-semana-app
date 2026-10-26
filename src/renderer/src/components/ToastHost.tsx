import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useStore } from '@/state/store'

const VISIBLE_MS = 5200

export function ToastHost() {
  const toast = useStore(s => s.toast)

  useEffect(() => {
    if (!toast || toast.sticky) return
    const t = window.setTimeout(() => {
      if (useStore.getState().toast?.id === toast.id) useStore.setState({ toast: null })
    }, VISIBLE_MS)
    return () => window.clearTimeout(t)
  }, [toast])

  return (
    <div className="toast-host" role="status" aria-live="polite">
      <AnimatePresence mode="popLayout">
        {toast && (
          <motion.div
            key={toast.id}
            className="toast"
            layout
            initial={{ opacity: 0, y: 24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 460, damping: 30 } }}
            exit={{ opacity: 0, y: 10, scale: 0.96, transition: { duration: 0.16 } }}
          >
            <span>{toast.text}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action!.run()
                  useStore.setState({ toast: null })
                }}
              >
                {toast.action.label}
              </button>
            )}
            {toast.sticky ? (
              <button type="button" className="toast-close" aria-label="Cerrar" onClick={() => useStore.setState({ toast: null })}>×</button>
            ) : (
              <motion.i
                className="toast-timer"
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: VISIBLE_MS / 1000, ease: 'linear' }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
