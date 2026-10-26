import { lazy, Suspense, useEffect } from 'react'
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from 'motion/react'
import { useStore } from '@/state/store'
import type { View } from '@/state/store'
import { TitleBar, Header } from '@/components/Chrome'
import { TodayPanel } from '@/components/TodayPanel'
import { ToastHost } from '@/components/ToastHost'
import { MonthView } from '@/views/MonthView'
import { WeekView } from '@/views/WeekView'
import { DayView } from '@/views/DayView'

// Less frequent surfaces load on demand.
const HabitsView = lazy(() => import('@/views/HabitsView').then(m => ({ default: m.HabitsView })))
const EventSheet = lazy(() => import('@/sheets/EventSheet').then(m => ({ default: m.EventSheet })))
const HabitSheet = lazy(() => import('@/sheets/HabitSheet').then(m => ({ default: m.HabitSheet })))
const SettingsSheet = lazy(() => import('@/sheets/SettingsSheet').then(m => ({ default: m.SettingsSheet })))

const VIEW_KEYS: Record<string, View> = { '1': 'month', '2': 'week', '3': 'day', '4': 'habits' }

function useShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const s = useStore.getState()
      if (e.ctrlKey && e.key === ',') {
        e.preventDefault()
        s.openSheet({ kind: 'settings' })
        return
      }
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement).tagName)
      if (typing || s.sheet || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'ArrowLeft') s.shift(-1)
      else if (e.key === 'ArrowRight') s.shift(1)
      else if (e.key === 't' || e.key === 'T') s.goToday()
      else if (e.key === 'Escape') s.back()
      else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        s.openSheet(s.view === 'habits' ? { kind: 'habit' } : { kind: 'event', preset: { date: s.date } })
      } else if (VIEW_KEYS[e.key]) s.setView(VIEW_KEYS[e.key]!)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

function useMainProcessEvents(): void {
  useEffect(() => {
    const offDate = window.api.onOpenDate(date => useStore.getState().openDay(date))
    const offShortcut = window.api.onShortcut(action => {
      if (action === 'new-event') useStore.getState().openSheet({ kind: 'event', preset: { date: useStore.getState().date } })
    })
    return () => {
      offDate()
      offShortcut()
    }
  }, [])
}

function CurrentView() {
  const view = useStore(s => s.view)
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={view}
        className="view"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 32 } }}
        exit={{ opacity: 0, transition: { duration: 0.15 } }}
      >
        <Suspense fallback={null}>
          {view === 'month' && <MonthView />}
          {view === 'week' && <WeekView />}
          {view === 'day' && <DayView />}
          {view === 'habits' && <HabitsView />}
        </Suspense>
      </motion.div>
    </AnimatePresence>
  )
}

function SheetHost() {
  const sheet = useStore(s => s.sheet)
  return (
    <Suspense fallback={null}>
      <AnimatePresence>
        {sheet?.kind === 'event' && <EventSheet key="event" event={sheet.event} preset={sheet.preset} />}
        {sheet?.kind === 'habit' && <HabitSheet key="habit" habit={sheet.habit} />}
        {sheet?.kind === 'settings' && <SettingsSheet key="settings" />}
      </AnimatePresence>
    </Suspense>
  )
}

export function App() {
  const ready = useStore(s => s.data !== null)
  const error = useStore(s => s.error)
  const sidebar = useStore(s => s.data?.settings.sidebar ?? true)
  useShortcuts()
  useMainProcessEvents()

  useEffect(() => {
    void useStore.getState().init()
  }, [])

  if (error) return <div className="boot">No se pudieron cargar tus datos: {error}</div>
  if (!ready) return <div className="boot" aria-busy="true"><span className="boot-mark" /></div>

  return (
    <MotionConfig reducedMotion="user">
      <div className="app">
        <TitleBar />
        <div className={sidebar ? 'body' : 'body no-sidebar'}>
          <main className="main">
            <Header />
            <div className="scroller">
              <LayoutGroup>
                <CurrentView />
              </LayoutGroup>
            </div>
          </main>
          <AnimatePresence initial={false}>
            {sidebar && (
              <motion.div
                className="sidebar"
                initial={{ x: 40, opacity: 0 }}
                animate={{ x: 0, opacity: 1, transition: { type: 'spring', stiffness: 280, damping: 30 } }}
                exit={{ x: 40, opacity: 0, transition: { duration: 0.18 } }}
              >
                <TodayPanel />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <SheetHost />
        <ToastHost />
      </div>
    </MotionConfig>
  )
}
