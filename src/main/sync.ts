import { powerMonitor, safeStorage, shell } from 'electron'
import { promises as fs, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AppData } from '@shared/model'
import { DESKTOP_AUTH_CALLBACK, WEB_APP_URL, emptyData } from '@shared/model'
import { Cloud, friendlyError } from '@shared/cloud'
import type { AuthStorage, CloudConfig, Identity } from '@shared/cloud'
import { SyncEngine, adoptAccount, emptySyncState } from '@shared/sync'
import type { SyncState, SyncStatus } from '@shared/sync'
import type { Repository } from './repository'

const INTERVAL_MS = 60_000
const AFTER_CHANGE_MS = 2_500

/** Supabase session persisted with Windows DPAPI (safeStorage), never as plain text. */
function encryptedStorage(file: string): AuthStorage {
  let cache: Record<string, string> = {}
  try {
    const raw = readFileSync(file)
    cache = JSON.parse(safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : raw.toString('utf8'))
  } catch {
    cache = {}
  }
  const persist = async (): Promise<void> => {
    const text = JSON.stringify(cache)
    await fs.writeFile(file, safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(text) : text)
  }
  return {
    getItem: key => cache[key] ?? null,
    setItem: async (key, value) => {
      cache[key] = value
      await persist()
    },
    removeItem: async key => {
      delete cache[key]
      await persist()
    },
  }
}

export class SyncService {
  private cloud: Cloud | null = null
  private engine: SyncEngine | null = null
  private timer: NodeJS.Timeout | undefined
  private debounce: NodeJS.Timeout | undefined
  private applyingRemote = false
  private status: SyncStatus
  private readonly stateFile: string

  constructor(
    private readonly repo: Repository,
    private readonly dir: string,
    private readonly config: CloudConfig | null,
    private readonly broadcast: (s: SyncStatus) => void,
    private readonly onRemoteData: (data: AppData) => void,
  ) {
    this.stateFile = join(dir, 'sync-state.json')
    this.status = { configured: !!config, phase: config ? 'signed-out' : 'off', email: null, lastSync: null, error: null }
  }

  get current(): SyncStatus {
    return this.status
  }

  async init(): Promise<void> {
    if (!this.config) return
    this.cloud = new Cloud(this.config, encryptedStorage(join(this.dir, 'auth.bin')))
    this.engine = new SyncEngine(this.cloud.transport, {
      get: () => this.repo.snapshot,
      replace: data => this.replaceLocal(data),
      loadState: () => this.readState(),
      saveState: s => this.writeState(s),
    })
    this.repo.onChange(() => {
      if (!this.applyingRemote) this.schedule(AFTER_CHANGE_MS)
    })
    powerMonitor.on('resume', () => this.schedule(1500))
    this.cloud.onAuthChange(who => {
      if (!who && this.status.email) this.set({ email: null, phase: 'signed-out' })
    })
    const who = await this.cloud.identity()
    if (who) await this.signedIn(who)
  }

  private replaceLocal(data: AppData): void {
    this.applyingRemote = true
    this.repo.replace(data)
    this.applyingRemote = false
    this.onRemoteData(data)
  }

  private readState(): SyncState {
    try {
      return { ...emptySyncState(), ...JSON.parse(readFileSync(this.stateFile, 'utf8')) }
    } catch {
      return emptySyncState()
    }
  }

  private writeState(s: SyncState): void {
    void fs.writeFile(this.stateFile, JSON.stringify(s)).catch(() => undefined)
  }

  private set(patch: Partial<SyncStatus>): void {
    this.status = { ...this.status, ...patch }
    this.broadcast(this.status)
  }

  /** Every way of signing in ends here: claim the local data for this account, then sync. */
  private async signedIn(who: Identity): Promise<void> {
    const { state, clearLocal } = adoptAccount(this.readState(), who.id)
    if (clearLocal) this.replaceLocal({ ...emptyData(), settings: this.repo.snapshot.settings })
    this.writeState(state)
    this.set({ email: who.email, phase: 'idle', error: null, waitingForBrowser: false })
    clearInterval(this.timer)
    this.timer = setInterval(() => void this.run(), INTERVAL_MS)
    await this.run()
  }

  schedule(ms: number): void {
    if (!this.status.email) return
    clearTimeout(this.debounce)
    this.debounce = setTimeout(() => void this.run(), ms)
  }

  async run(): Promise<void> {
    if (!this.engine || !this.status.email) return
    this.set({ phase: 'syncing' })
    try {
      await this.engine.run()
      this.set({ phase: 'idle', lastSync: Date.now(), error: null })
    } catch (e) {
      this.set({ phase: 'error', error: friendlyError(e) })
    }
  }

  private need(): Cloud {
    if (!this.cloud) throw new Error('La sincronización no está configurada.')
    return this.cloud
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.signedIn(await this.need().signIn(email.trim(), password))
  }

  async signUp(email: string, password: string): Promise<boolean> {
    const who = await this.need().signUp(email.trim(), password, WEB_APP_URL)
    if (who) await this.signedIn(who)
    return !who
  }

  /** Opens Google in the default browser; the app gets the result through misemana://auth-callback. */
  async signInWithGoogle(): Promise<void> {
    const url = await this.need().googleUrl(DESKTOP_AUTH_CALLBACK)
    this.set({ waitingForBrowser: true, error: null })
    await shell.openExternal(url)
  }

  async completeBrowserSignIn(callbackUrl: string): Promise<void> {
    try {
      await this.signedIn(await this.need().exchange(callbackUrl))
    } catch (e) {
      this.set({ waitingForBrowser: false, phase: 'signed-out', error: friendlyError(e) })
    }
  }

  async resetPassword(email: string): Promise<void> {
    await this.need().resetPassword(email.trim(), WEB_APP_URL)
  }

  async updatePassword(password: string): Promise<void> {
    await this.need().updatePassword(password)
    this.set({ recovery: false })
  }

  async signOut(clearLocal: boolean): Promise<void> {
    clearInterval(this.timer)
    clearTimeout(this.debounce)
    await this.cloud?.signOut()
    if (clearLocal) {
      this.replaceLocal({ ...emptyData(), settings: this.repo.snapshot.settings })
      this.writeState(emptySyncState())
    }
    this.set({ email: null, phase: 'signed-out', lastSync: null, error: null })
  }

  stop(): void {
    clearInterval(this.timer)
    clearTimeout(this.debounce)
  }
}
