import { lazy, Suspense, useEffect } from 'react'
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from 'motion/react'
import { useStore } from '@/state/store'
import { useNarrow } from '@/state/hooks'
import type { UpdateStatus } from '@shared/ipc'
import type { SyncStatus } from '@shared/sync'
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
const AccountSheet = lazy(() => import('@/sheets/AccountSheet').then(m => ({ default: m.AccountSheet })))

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
    const offData = window.api.onExternalData(data => useStore.getState().receiveExternal(data))
    const onSync = (sync: SyncStatus): void => {
      useStore.setState({ sync })
      // Arrived from a password-reset e-mail: go straight to choosing a new password.
      if (sync.recovery && useStore.getState().sheet?.kind !== 'account') useStore.getState().openSheet({ kind: 'account' })
    }
    const offSync = window.api.sync.onStatus(onSync)
    void window.api.sync.status().then(onSync)
    const onUpdate = (update: UpdateStatus): void => {
      const prev = useStore.getState().update
      useStore.setState({ update })
      if (update.phase === 'ready' && prev.phase !== 'ready') {
        useStore.getState().toastWith({
          text: `Mi Semana ${update.version ?? ''} está lista.`,
          action: { label: 'Reiniciar ahora', run: () => void window.api.updates.install() },
          sticky: true,
        })
      }
    }
    const offUpdate = window.api.updates.onStatus(onUpdate)
    void window.api.updates.status().then(onUpdate)
    return () => {
      offDate()
      offShortcut()
      offData()
      offSync()
      offUpdate()
    }
  }, [])
}

/** The phone layout has no side panel: "Hoy" becomes its own view, the default one. */
function usePhoneLayout(narrow: boolean): void {
  useEffect(() => {
    const s = useStore.getState()
    if (narrow && s.view === 'month' && !s.sheet) useStore.setState({ view: 'today', prevView: 'today' })
    if (!narrow && s.view === 'today') useStore.setState({ view: 'month', prevView: 'month' })
  }, [narrow])
}

function CurrentView() {
  const view = useStore(s => s.view)
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={view}
        className="view"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } }}
        exit={{ opacity: 0, transition: { duration: 0.12 } }}
      >
        <Suspense fallback={null}>
          {view === 'today' && <TodayPanel />}
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
        {sheet?.kind === 'account' && <AccountSheet key="account" />}
      </AnimatePresence>
    </Suspense>
  )
}

export function App() {
  const ready = useStore(s => s.data !== null)
  const error = useStore(s => s.error)
  const narrow = useNarrow()
  const sidebar = useStore(s => s.data?.settings.sidebar ?? true) && !narrow
  useShortcuts()
  useMainProcessEvents()
  usePhoneLayout(narrow)

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
