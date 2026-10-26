import type { BrowserWindow } from 'electron'
import { app, Menu, nativeTheme } from 'electron'
import { join } from 'node:path'
import iconPath from '../../resources/icon.png?asset'
import { IPC } from '@shared/ipc'
import type { ShortcutAction } from '@shared/ipc'
import type { Settings } from '@shared/model'
import { Repository } from './repository'
import { ReminderService } from './reminders'
import { registerIpc } from './ipc'
import { createTray } from './tray'
import { createMainWindow, rendererEntry } from './window'

const APP_ID = 'app.misemana.desktop'
const startedHidden = process.argv.includes('--hidden')

// Spanish (Spain) locale: 24-hour time pickers and Spanish spell-check regardless of the OS region.
app.commandLine.appendSwitch('lang', 'es-ES')

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.setAppUserModelId(APP_ID)
  Menu.setApplicationMenu(null)

  let win: BrowserWindow | null = null
  let quitting = false
  const repo = new Repository(join(app.getPath('userData'), 'data'))

  const show = (): void => {
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  }
  const send = (channel: string, payload: unknown): void => {
    show()
    win?.webContents.send(channel, payload)
  }

  const reminders = new ReminderService(() => repo.snapshot, date => send(IPC.openDate, date), iconPath)

  const applySettings = (s: Settings): void => {
    nativeTheme.themeSource = s.theme
    if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: s.launchAtLogin, args: ['--hidden'] })
  }

  app.on('second-instance', show)

  app.whenReady().then(async () => {
    const data = await repo.init()
    applySettings(data.settings)

    let lastSettings = data.settings
    repo.onChange(next => {
      if (next.settings !== lastSettings) {
        lastSettings = next.settings
        applySettings(next.settings)
      }
    })

    win = createMainWindow({
      stateFile: join(app.getPath('userData'), 'window-state.json'),
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      show: !startedHidden,
    })
    const entry = rendererEntry(import.meta.dirname)
    if (entry.url) void win.loadURL(entry.url)
    else void win.loadFile(entry.file!)

    win.on('close', e => {
      if (!quitting && repo.snapshot.settings.closeToTray) {
        e.preventDefault()
        win?.hide()
      }
    })
    win.on('closed', () => {
      win = null
    })

    registerIpc(repo, reminders, () => win)
    reminders.start()
    createTray(iconPath, {
      show,
      newEvent: () => send(IPC.shortcut, 'new-event' satisfies ShortcutAction),
      quit: () => {
        quitting = true
        app.quit()
      },
    })
  })

  app.on('before-quit', () => {
    quitting = true
    reminders.stop()
    repo.flushSync()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && !repo.snapshot.settings.closeToTray) app.quit()
  })
}
