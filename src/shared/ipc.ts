import type { Command } from './commands'
import type { AppData } from './model'

export const IPC = {
  load: 'data:load',
  dispatch: 'data:dispatch',
  exportFile: 'data:export',
  importFile: 'data:import',
  openDataFolder: 'app:open-data-folder',
  info: 'app:info',
  testNotification: 'app:test-notification',
  openDate: 'app:open-date',
  shortcut: 'app:shortcut',
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

/** The only surface the renderer can reach. Exposed by the preload through contextBridge. */
export interface MiSemanaApi {
  load(): Promise<AppData>
  dispatch(cmd: Command): Promise<void>
  exportFile(): Promise<string | null>
  importFile(): Promise<ImportOutcome | null>
  openDataFolder(): Promise<void>
  info(): Promise<AppInfo>
  testNotification(): Promise<void>
  onOpenDate(cb: (date: string) => void): () => void
  onShortcut(cb: (action: ShortcutAction) => void): () => void
}
