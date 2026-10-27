import { lazy, Suspense, useEffect } from 'react'
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from 'motion/react'
import { useStore } from '@/state/store'
import { useNarrow, useToday } from '@/state/hooks'
import { useCarryOver } from '@/state/carry'
import { useSubscriptionPayments } from '@/state/subs'
import { FocusTicker } from '@/components/Focus'
import type { UpdateStatus } from '@shared/ipc'
import type { SyncStatus } from '@shared/sync'
import type { View } from '@/state/store'
import { TitleBar, Header } from '@/components/Chrome'
import { TodayPanel } from '@/components/TodayPanel'
import { ToastHost } from '@/components/ToastHost'
import { MonthView } from '@/views/MonthView'
import { WeekView } from '@/views/WeekView'
import { DayView } from '@/views/DayView'
import { Backdrop } from '@/components/Backdrop'
import { useAppearance } from '@/lib/appearance'
import { installPointerFx } from '@/lib/fx'

// Less frequent surfaces load on demand.
const HabitsView = lazy(() => import('@/views/HabitsView').then(m => ({ default: m.HabitsView })))
const EventSheet = lazy(() => import('@/sheets/EventSheet').then(m => ({ default: m.EventSheet })))
const HabitSheet = lazy(() => import('@/sheets/HabitSheet').then(m => ({ default: m.HabitSheet })))
const SettingsSheet = lazy(() => import('@/sheets/SettingsSheet').then(m => ({ default: m.SettingsSheet })))
const JournalView = lazy(() => import('@/views/JournalView').then(m => ({ default: m.JournalView })))
const StatsView = lazy(() => import('@/views/StatsView').then(m => ({ default: m.StatsView })))
const MoneyView = lazy(() => import('@/views/MoneyView').then(m => ({ default: m.MoneyView })))
const TxSheet = lazy(() => import('@/sheets/FinanceSheets').then(m => ({ default: m.TxSheet })))
const SubSheet = lazy(() => import('@/sheets/FinanceSheets').then(m => ({ default: m.SubSheet })))
const WalletSheet = lazy(() => import('@/sheets/FinanceSheets').then(m => ({ default: m.WalletSheet })))
const GoalSheet = lazy(() => import('@/sheets/FinanceSheets').then(m => ({ default: m.GoalSheet })))
const AccountSheet = lazy(() => import('@/sheets/AccountSheet').then(m => ({ default: m.AccountSheet })))

const VIEW_KEYS: Record<string, View> = { '1': 'month', '2': 'week', '3': 'day', '4': 'habits', '5': 'journal', '6': 'stats', '7': 'money' }

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
        initial={{ opacity: 0, y: 16, scale: 0.985, filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transition: { type: 'spring', stiffness: 240, damping: 24 } }}
        exit={{ opacity: 0, scale: 0.99, filter: 'blur(4px)', transition: { duration: 0.16 } }}
      >
        <Suspense fallback={null}>
          {view === 'today' && <TodayPanel />}
          {view === 'month' && <MonthView />}
          {view === 'week' && <WeekView />}
          {view === 'day' && <DayView />}
          {view === 'habits' && <HabitsView />}
          {view === 'journal' && <JournalView />}
          {view === 'stats' && <StatsView />}
          {view === 'money' && <MoneyView />}
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
        {sheet?.kind === 'settings' && <SettingsSheet key="settings" tab={sheet.tab} />}
        {sheet?.kind === 'account' && <AccountSheet key="account" />}
        {sheet?.kind === 'tx' && <TxSheet key="tx" tx={sheet.tx} preset={sheet.preset} />}
        {sheet?.kind === 'sub' && <SubSheet key="sub" sub={sheet.sub} />}
        {sheet?.kind === 'wallet' && <WalletSheet key="wallet" wallet={sheet.wallet} />}
        {sheet?.kind === 'goal' && <GoalSheet key="goal" goal={sheet.goal} />}
      </AnimatePresence>
    </Suspense>
  )
}

export function App() {
  const ready = useStore(s => s.data !== null)
  const error = useStore(s => s.error)
  const narrow = useNarrow()
  const sidebar = useStore(s => s.data?.settings.sidebar ?? true) && !narrow
  const settings = useStore(s => s.data?.settings)
  useAppearance(settings)
  const today = useToday()
  useCarryOver(today, ready, settings?.carryOver ?? false)
  useSubscriptionPayments(today, ready)
  useShortcuts()
  useMainProcessEvents()
  usePhoneLayout(narrow)

  useEffect(() => {
    void useStore.getState().init()
    return installPointerFx()
  }, [])

  if (error) return <div className="boot">No se pudieron cargar tus datos: {error}</div>
  if (!ready) return <div className="boot" aria-busy="true"><span className="boot-mark" /></div>

  return (
    <MotionConfig reducedMotion="user">
      <Backdrop kind={settings!.look.backdrop} />
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
        <FocusTicker />
      </div>
    </MotionConfig>
  )
}
