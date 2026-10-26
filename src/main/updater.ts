import { app } from 'electron'
import electronUpdater from 'electron-updater'
import type { UpdateStatus } from '@shared/ipc'

const { autoUpdater } = electronUpdater
const FIRST_CHECK_MS = 20_000
const EVERY_MS = 6 * 60 * 60_000

/**
 * Checks the GitHub Releases of the repo (electron-builder.yml → publish), downloads in the
 * background and installs on quit — or right away when the user presses "Reiniciar".
 */
export class Updater {
  private status: UpdateStatus = { phase: 'idle' }

  constructor(private readonly broadcast: (s: UpdateStatus) => void) {}

  get current(): UpdateStatus {
    return this.status
  }

  start(): void {
    if (!app.isPackaged) return
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.logger = null
    autoUpdater.on('update-available', info => this.set({ phase: 'downloading', version: info.version, percent: 0 }))
    autoUpdater.on('download-progress', p => this.set({ ...this.status, phase: 'downloading', percent: Math.round(p.percent) }))
    autoUpdater.on('update-downloaded', info => this.set({ phase: 'ready', version: info.version }))
    autoUpdater.on('error', () => {
      if (this.status.phase !== 'ready') this.set({ phase: 'idle' })
    })
    const check = (): void => void autoUpdater.checkForUpdates().catch(() => undefined)
    setTimeout(check, FIRST_CHECK_MS)
    setInterval(check, EVERY_MS)
  }

  install(): void {
    if (this.status.phase === 'ready') autoUpdater.quitAndInstall(true, true)
  }

  private set(s: UpdateStatus): void {
    this.status = s
    this.broadcast(s)
  }
}
