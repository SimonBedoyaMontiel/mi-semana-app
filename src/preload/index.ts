import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { IPC } from '@shared/ipc'
import type { MiSemanaApi, ShortcutAction, UpdateStatus } from '@shared/ipc'
import type { AppData } from '@shared/model'
import type { SyncStatus } from '@shared/sync'

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_e: IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: MiSemanaApi = {
  platform: 'desktop',
  load: () => ipcRenderer.invoke(IPC.load),
  dispatch: cmd => ipcRenderer.invoke(IPC.dispatch, cmd),
  onExternalData: cb => subscribe<AppData>(IPC.external, cb),
  exportFile: () => ipcRenderer.invoke(IPC.exportFile),
  importFile: () => ipcRenderer.invoke(IPC.importFile),
  openDataFolder: () => ipcRenderer.invoke(IPC.openDataFolder),
  info: () => ipcRenderer.invoke(IPC.info),
  testNotification: () => ipcRenderer.invoke(IPC.testNotification),
  onOpenDate: cb => subscribe<string>(IPC.openDate, cb),
  onShortcut: cb => subscribe<ShortcutAction>(IPC.shortcut, cb),
  sync: {
    status: () => ipcRenderer.invoke(IPC.syncStatus),
    signIn: (email, password) => ipcRenderer.invoke(IPC.syncSignIn, email, password),
    signUp: (email, password) => ipcRenderer.invoke(IPC.syncSignUp, email, password),
    signOut: opts => ipcRenderer.invoke(IPC.syncSignOut, opts),
    signInWithGoogle: () => ipcRenderer.invoke(IPC.syncGoogle),
    resetPassword: email => ipcRenderer.invoke(IPC.syncReset, email),
    updatePassword: password => ipcRenderer.invoke(IPC.syncUpdatePassword, password),
    now: () => ipcRenderer.invoke(IPC.syncNow),
    onStatus: cb => subscribe<SyncStatus>(IPC.syncStatus, cb),
  },
  updates: {
    status: () => ipcRenderer.invoke(IPC.updateStatus),
    install: () => ipcRenderer.invoke(IPC.updateInstall),
    onStatus: cb => subscribe<UpdateStatus>(IPC.updateStatus, cb),
  },
}

contextBridge.exposeInMainWorld('api', api)
