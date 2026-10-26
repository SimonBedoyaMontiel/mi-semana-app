import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { IPC } from '@shared/ipc'
import type { MiSemanaApi, ShortcutAction } from '@shared/ipc'

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_e: IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: MiSemanaApi = {
  load: () => ipcRenderer.invoke(IPC.load),
  dispatch: cmd => ipcRenderer.invoke(IPC.dispatch, cmd),
  exportFile: () => ipcRenderer.invoke(IPC.exportFile),
  importFile: () => ipcRenderer.invoke(IPC.importFile),
  openDataFolder: () => ipcRenderer.invoke(IPC.openDataFolder),
  info: () => ipcRenderer.invoke(IPC.info),
  testNotification: () => ipcRenderer.invoke(IPC.testNotification),
  onOpenDate: cb => subscribe<string>(IPC.openDate, cb),
  onShortcut: cb => subscribe<ShortcutAction>(IPC.shortcut, cb),
}

contextBridge.exposeInMainWorld('api', api)
