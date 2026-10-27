/**
 * Browser implementation of the app API (the phone/PWA build). Plays the role the Electron main
 * process plays on desktop: owns the stored document, applies commands, syncs with Supabase.
 */
import type { AppInfo, ImportOutcome, MiSemanaApi, UpdateStatus } from '@shared/ipc'
import { CommandSchema } from '@shared/commands'
import { applyCommand } from '@shared/reducer'
import type { AppData } from '@shared/model'
import { emptyData } from '@shared/model'
import { sanitize } from '@shared/sanitize'
import { mergeBackup, parseBackup, toBackupFile } from '@shared/backup'
import { Cloud, friendlyError } from '@shared/cloud'
import type { Identity } from '@shared/cloud'
import { SyncEngine, adoptAccount, emptySyncState } from '@shared/sync'
import type { SyncState, SyncStatus } from '@shared/sync'
import { toIso } from '@shared/dates'

const DATA_KEY = 'mi-semana:data'
const SYNC_KEY = 'mi-semana:sync'
const SAVE_MS = 250
const SYNC_AFTER_CHANGE_MS = 2500
const SYNC_EVERY_MS = 60_000

type Listener<T> = (v: T) => void

function readData(): AppData {
  try {
    const raw = localStorage.getItem(DATA_KEY)
    return raw ? sanitize(JSON.parse(raw)) : emptyData()
  } catch {
    return emptyData()
  }
}

function readSyncState(): SyncState {
  try {
    return { ...emptySyncState(), ...JSON.parse(localStorage.getItem(SYNC_KEY) ?? '{}') }
  } catch {
    return emptySyncState()
  }
}

function pickFile(): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true })
    input.addEventListener('cancel', () => resolve(null), { once: true })
    input.click()
  })
}

export function createWebApi(): MiSemanaApi {
  let data = readData()
  let saveTimer = 0
  const dataListeners = new Set<Listener<AppData>>()
  const syncListeners = new Set<Listener<SyncStatus>>()

  const persist = (): void => {
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(DATA_KEY, JSON.stringify(data))
      } catch (e) {
        console.error('[web] could not save', e)
      }
    }, SAVE_MS)
  }
  const flushNow = (): void => {
    window.clearTimeout(saveTimer)
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(data))
    } catch { /* storage full or blocked */ }
  }
  window.addEventListener('pagehide', flushNow)

  // Another tab of the app changed the data.
  window.addEventListener('storage', e => {
    if (e.key !== DATA_KEY || !e.newValue) return
    data = readData()
    for (const fn of dataListeners) fn(data)
  })

  // ---- Sync ----
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_KEY
  // detectSessionInUrl: Google and e-mail links come back to this page with ?code=…
  const cloud = url && key ? new Cloud({ url, key }, window.localStorage, { detectSessionInUrl: true }) : null
  const here = (): string => `${location.origin}${location.pathname}`
  let status: SyncStatus = { configured: !!cloud, phase: cloud ? 'signed-out' : 'off', email: null, lastSync: null, error: null }
  const setStatus = (patch: Partial<SyncStatus>): void => {
    status = { ...status, ...patch }
    for (const fn of syncListeners) fn(status)
  }
  const replaceLocal = (next: AppData): void => {
    data = next
    flushNow()
    for (const fn of dataListeners) fn(data)
  }
  const engine = cloud
    ? new SyncEngine(cloud.transport, {
        get: () => data,
        replace: replaceLocal,
        loadState: readSyncState,
        saveState: s => localStorage.setItem(SYNC_KEY, JSON.stringify(s)),
      })
    : null

  let syncTimer = 0
  let interval = 0
  const runSync = async (): Promise<void> => {
    if (!engine || !status.email || !navigator.onLine) return
    setStatus({ phase: 'syncing' })
    try {
      await engine.run()
      setStatus({ phase: 'idle', lastSync: Date.now(), error: null })
    } catch (e) {
      setStatus({ phase: 'error', error: friendlyError(e) })
    }
  }
  const scheduleSync = (ms: number): void => {
    window.clearTimeout(syncTimer)
    syncTimer = window.setTimeout(() => void runSync(), ms)
  }
  let adopted: string | null = null
  const signedIn = async (who: Identity): Promise<void> => {
    if (adopted === who.id) return
    adopted = who.id
    const { state, clearLocal } = adoptAccount(readSyncState(), who.id)
    if (clearLocal) replaceLocal({ ...emptyData(), settings: data.settings })
    localStorage.setItem(SYNC_KEY, JSON.stringify(state))
    setStatus({ email: who.email, phase: 'idle', error: null })
    window.clearInterval(interval)
    interval = window.setInterval(() => void runSync(), SYNC_EVERY_MS)
    await runSync()
  }
  if (cloud) {
    cloud.onAuthChange((who, event) => {
      if (event === 'recovery') setStatus({ recovery: true })
      // Supabase holds its auth lock during this callback: defer any call back into it.
      if (who) window.setTimeout(() => void signedIn(who), 0)
      else if (event === 'signed-out') {
        adopted = null
        setStatus({ email: null, phase: 'signed-out', lastSync: null })
      }
      // Drop ?code=… from the address bar once the session is in.
      if (who && /[?&]code=/.test(location.search)) history.replaceState(null, '', here())
    })
    void cloud.identity().then(who => who && signedIn(who))
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && scheduleSync(300))
    window.addEventListener('online', () => scheduleSync(300))
  }

  const noop = (): (() => void) => () => undefined
  const idleUpdate: UpdateStatus = { phase: 'idle' }

  return {
    platform: 'web',
    load: async () => data,
    dispatch: async raw => {
      const parsed = CommandSchema.safeParse(raw)
      if (!parsed.success) throw new Error('Invalid command')
      data = applyCommand(data, parsed.data)
      persist()
      scheduleSync(SYNC_AFTER_CHANGE_MS)
    },
    onExternalData: cb => {
      dataListeners.add(cb)
      return () => dataListeners.delete(cb)
    },
    exportFile: async () => {
      const name = `mi-semana-${toIso(new Date())}.json`
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([toBackupFile(data)], { type: 'application/json' }))
      a.download = name
      a.click()
      window.setTimeout(() => URL.revokeObjectURL(a.href), 4000)
      return name
    },
    importFile: async (): Promise<ImportOutcome | null> => {
      const file = await pickFile()
      if (!file) return null
      if (file.size > 20 * 1024 * 1024) throw new Error('El archivo es demasiado grande.')
      const merged = mergeBackup(data, parseBackup(await file.text()))
      data = merged.data
      flushNow()
      scheduleSync(500)
      return merged
    },
    openDataFolder: async () => undefined,
    info: async (): Promise<AppInfo> => ({ version: __APP_VERSION__, dataPath: 'este navegador' }),
    testNotification: async () => undefined,
    onOpenDate: noop,
    onShortcut: noop,
    sync: {
      status: async () => status,
      signIn: async (email, password) => {
        if (!cloud) throw new Error('La sincronización no está configurada.')
        await signedIn(await cloud.signIn(email.trim(), password))
      },
      signUp: async (email, password) => {
        if (!cloud) throw new Error('La sincronización no está configurada.')
        const who = await cloud.signUp(email.trim(), password, here())
        if (who) await signedIn(who)
        return !who
      },
      signInWithGoogle: async () => {
        if (!cloud) throw new Error('La sincronización no está configurada.')
        flushNow()
        location.assign(await cloud.googleUrl(here()))
      },
      resetPassword: async email => {
        if (!cloud) throw new Error('La sincronización no está configurada.')
        await cloud.resetPassword(email.trim(), here())
      },
      updatePassword: async password => {
        if (!cloud) throw new Error('La sincronización no está configurada.')
        await cloud.updatePassword(password)
        setStatus({ recovery: false })
      },
      signOut: async opts => {
        window.clearInterval(interval)
        await cloud?.signOut()
        adopted = null
        if (opts?.clearLocal) {
          replaceLocal({ ...emptyData(), settings: data.settings })
          localStorage.removeItem(SYNC_KEY)
        }
        setStatus({ email: null, phase: 'signed-out', lastSync: null, error: null })
      },
      now: runSync,
      onStatus: cb => {
        syncListeners.add(cb)
        return () => syncListeners.delete(cb)
      },
    },
    updates: {
      status: async () => idleUpdate,
      install: async () => undefined,
      onStatus: noop,
    },
  }
}
