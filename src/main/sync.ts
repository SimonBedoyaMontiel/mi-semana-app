import { powerMonitor, safeStorage } from 'electron'
import { promises as fs, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AppData } from '@shared/model'
import { Cloud, friendlyError } from '@shared/cloud'
import type { AuthStorage, CloudConfig } from '@shared/cloud'
import { SyncEngine, emptySyncState } from '@shared/sync'
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
      replace: data => {
        this.applyingRemote = true
        this.repo.replace(data)
        this.applyingRemote = false
        this.onRemoteData(data)
      },
      loadState: () => this.readState(),
      saveState: s => void fs.writeFile(this.stateFile, JSON.stringify(s)).catch(() => undefined),
    })
    this.repo.onChange(() => {
      if (!this.applyingRemote) this.schedule(AFTER_CHANGE_MS)
    })
    powerMonitor.on('resume', () => this.schedule(1500))
    this.cloud.onAuthChange(email => this.set({ email, phase: email ? this.status.phase === 'signed-out' ? 'idle' : this.status.phase : 'signed-out' }))
    const email = await this.cloud.email()
    this.set({ email, phase: email ? 'idle' : 'signed-out' })
    if (email) this.start()
  }

  private readState(): SyncState {
    try {
      return { ...emptySyncState(), ...JSON.parse(readFileSync(this.stateFile, 'utf8')) }
    } catch {
      return emptySyncState()
    }
  }

  private set(patch: Partial<SyncStatus>): void {
    this.status = { ...this.status, ...patch }
    this.broadcast(this.status)
  }

  private start(): void {
    clearInterval(this.timer)
    this.timer = setInterval(() => void this.run(), INTERVAL_MS)
    void this.run()
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

  async signIn(email: string, password: string): Promise<void> {
    if (!this.cloud) throw new Error('La sincronización no está configurada.')
    await this.cloud.signIn(email.trim(), password)
    this.set({ email: email.trim(), phase: 'idle', error: null })
    this.start()
  }

  async signUp(email: string, password: string): Promise<boolean> {
    if (!this.cloud) throw new Error('La sincronización no está configurada.')
    const needsConfirmation = await this.cloud.signUp(email.trim(), password)
    if (!needsConfirmation) {
      this.set({ email: email.trim(), phase: 'idle', error: null })
      this.start()
    }
    return needsConfirmation
  }

  async signOut(): Promise<void> {
    clearInterval(this.timer)
    clearTimeout(this.debounce)
    await this.cloud?.signOut()
    // A different account must not inherit this account's upload bookkeeping.
    await fs.unlink(this.stateFile).catch(() => undefined)
    this.set({ email: null, phase: 'signed-out', lastSync: null, error: null })
  }

  stop(): void {
    clearInterval(this.timer)
    clearTimeout(this.debounce)
  }
}
