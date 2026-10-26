import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'
import { app, dialog, ipcMain, shell } from 'electron'
import { promises as fs } from 'node:fs'
import { CommandSchema } from '@shared/commands'
import { IPC } from '@shared/ipc'
import type { AppInfo, ImportOutcome } from '@shared/ipc'
import { mergeBackup, parseBackup, toBackupFile } from '@shared/backup'
import { toIso } from '@shared/dates'
import type { Repository } from './repository'
import type { ReminderService } from './reminders'

/** Only frames that load the bundled app may talk to the main process. */
function trusted(e: IpcMainInvokeEvent): boolean {
  const url = e.senderFrame?.url ?? ''
  const dev = process.env.ELECTRON_RENDERER_URL
  return url.startsWith('file://') || (!!dev && url.startsWith(dev))
}

function guard<A extends unknown[], R>(fn: (e: IpcMainInvokeEvent, ...args: A) => R) {
  return (e: IpcMainInvokeEvent, ...args: A): R => {
    if (!trusted(e)) throw new Error('Untrusted sender')
    return fn(e, ...args)
  }
}

export function registerIpc(repo: Repository, reminders: ReminderService, getWindow: () => BrowserWindow | null): void {
  ipcMain.handle(IPC.load, guard(() => repo.snapshot))

  ipcMain.handle(
    IPC.dispatch,
    guard((_e, raw: unknown) => {
      const parsed = CommandSchema.safeParse(raw)
      if (!parsed.success) throw new Error(`Invalid command: ${parsed.error.issues[0]?.message ?? 'unknown'}`)
      repo.apply(parsed.data)
    }),
  )

  ipcMain.handle(
    IPC.exportFile,
    guard(async (): Promise<string | null> => {
      const win = getWindow()
      const opts = {
        title: 'Exportar copia de seguridad',
        defaultPath: `mi-semana-${toIso(new Date())}.json`,
        filters: [{ name: 'Copia de Mi Semana', extensions: ['json'] }],
      }
      const res = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
      if (res.canceled || !res.filePath) return null
      await fs.writeFile(res.filePath, toBackupFile(repo.snapshot), 'utf8')
      return res.filePath
    }),
  )

  ipcMain.handle(
    IPC.importFile,
    guard(async (): Promise<ImportOutcome | null> => {
      const win = getWindow()
      const opts = {
        title: 'Importar datos',
        properties: ['openFile' as const],
        filters: [{ name: 'Exportación de Mi Semana', extensions: ['json'] }],
      }
      const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
      const file = res.filePaths[0]
      if (res.canceled || !file) return null
      const stat = await fs.stat(file)
      if (stat.size > 20 * 1024 * 1024) throw new Error('El archivo es demasiado grande.')
      const payload = parseBackup(await fs.readFile(file, 'utf8'))
      const merged = mergeBackup(repo.snapshot, payload)
      repo.replace(merged.data)
      await repo.flush()
      return merged
    }),
  )

  ipcMain.handle(IPC.openDataFolder, guard(async () => void (await shell.openPath(repo.dir))))
  ipcMain.handle(IPC.info, guard((): AppInfo => ({ version: app.getVersion(), dataPath: repo.dir })))
  ipcMain.handle(IPC.testNotification, guard(() => reminders.test()))
}
