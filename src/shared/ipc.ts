import type { Command } from './commands'
import type { AppData } from './model'
import type { SyncStatus } from './sync'

export const IPC = {
  load: 'data:load',
  dispatch: 'data:dispatch',
  external: 'data:external',
  exportFile: 'data:export',
  importFile: 'data:import',
  openDataFolder: 'app:open-data-folder',
  info: 'app:info',
  testNotification: 'app:test-notification',
  openDate: 'app:open-date',
  shortcut: 'app:shortcut',
  syncStatus: 'sync:status',
  syncSignIn: 'sync:sign-in',
  syncSignUp: 'sync:sign-up',
  syncSignOut: 'sync:sign-out',
  syncNow: 'sync:now',
  updateStatus: 'update:status',
  updateInstall: 'update:install',
} as const

export interface ImportOutcome {
  data: AppData
  added: { events: number; habits: number; days: number }
}

export interface AppInfo {
  version: string
  dataPath: string
}

export type ShortcutAction = 'new-event'
export type Platform = 'desktop' | 'web'

export interface UpdateStatus {
  phase: 'idle' | 'downloading' | 'ready'
  version?: string
  percent?: number
}

/** The only surface the renderer can reach. Desktop: preload via contextBridge. Web: src/web/api.ts. */
export interface MiSemanaApi {
  readonly platform: Platform
  load(): Promise<AppData>
  dispatch(cmd: Command): Promise<void>
  /** Data changed outside this window (sync from another device). */
  onExternalData(cb: (data: AppData) => void): () => void
  exportFile(): Promise<string | null>
  importFile(): Promise<ImportOutcome | null>
  openDataFolder(): Promise<void>
  info(): Promise<AppInfo>
  testNotification(): Promise<void>
  onOpenDate(cb: (date: string) => void): () => void
  onShortcut(cb: (action: ShortcutAction) => void): () => void
  sync: {
    status(): Promise<SyncStatus>
    signIn(email: string, password: string): Promise<void>
    /** Resolves true when the account must confirm its e-mail before signing in. */
    signUp(email: string, password: string): Promise<boolean>
    signOut(): Promise<void>
    now(): Promise<void>
    onStatus(cb: (s: SyncStatus) => void): () => void
  }
  updates: {
    status(): Promise<UpdateStatus>
    install(): Promise<void>
    onStatus(cb: (s: UpdateStatus) => void): () => void
  }
}
