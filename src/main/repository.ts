import { promises as fs, writeFileSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import type { Command } from '@shared/commands'
import { applyCommand } from '@shared/reducer'
import type { AppData } from '@shared/model'
import { emptyData } from '@shared/model'
import { sanitize } from '@shared/sanitize'
import { toIso } from '@shared/dates'

const SAVE_DEBOUNCE_MS = 300
const SNAPSHOTS_KEPT = 14

type Listener = (data: AppData) => void

/**
 * Single JSON document on disk, owned by the main process.
 * Writes are debounced, serialized, fsync'd and swapped in atomically (tmp → rename), with the
 * previous version kept as `.bak` and one dated snapshot per day under `backups/`.
 */
export class Repository {
  private data: AppData = emptyData()
  private chain: Promise<void> = Promise.resolve()
  private timer: NodeJS.Timeout | undefined
  private dirty = false
  private listeners = new Set<Listener>()

  constructor(readonly dir: string) {}

  get file(): string {
    return join(this.dir, 'data.json')
  }

  get snapshot(): AppData {
    return this.data
  }

  async init(): Promise<AppData> {
    await fs.mkdir(join(this.dir, 'backups'), { recursive: true })
    this.data = await this.read()
    return this.data
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  apply(cmd: Command): void {
    this.set(applyCommand(this.data, cmd))
  }

  replace(data: AppData): void {
    this.set(data)
  }

  private set(next: AppData): void {
    if (next === this.data) return
    this.data = next
    this.dirty = true
    clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.flush(), SAVE_DEBOUNCE_MS)
    for (const fn of this.listeners) fn(next)
  }

  flush(): Promise<void> {
    clearTimeout(this.timer)
    if (!this.dirty) return this.chain
    this.dirty = false
    const payload = JSON.stringify(this.data)
    this.chain = this.chain
      .then(() => this.write(payload))
      .catch(err => {
        this.dirty = true
        console.error('[repository] write failed', err)
      })
    return this.chain
  }

  /** Last-chance synchronous save on quit, when the event loop may not run again. */
  flushSync(): void {
    clearTimeout(this.timer)
    if (!this.dirty) return
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify(this.data), 'utf8')
    renameSync(tmp, this.file)
    this.dirty = false
  }

  private async write(payload: string): Promise<void> {
    const tmp = `${this.file}.tmp`
    const fh = await fs.open(tmp, 'w')
    try {
      await fh.writeFile(payload, 'utf8')
      await fh.sync()
    } finally {
      await fh.close()
    }
    await fs.copyFile(this.file, `${this.file}.bak`).catch(() => undefined)
    await fs.rename(tmp, this.file)
    await this.snapshotDaily(payload)
  }

  private async snapshotDaily(payload: string): Promise<void> {
    const dir = join(this.dir, 'backups')
    const target = join(dir, `data-${toIso(new Date())}.json`)
    try {
      await fs.writeFile(target, payload, { encoding: 'utf8', flag: 'wx' })
    } catch {
      return // today's snapshot already exists
    }
    const files = (await fs.readdir(dir)).filter(f => /^data-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort()
    await Promise.all(files.slice(0, -SNAPSHOTS_KEPT).map(f => fs.unlink(join(dir, f)).catch(() => undefined)))
  }

  private async read(): Promise<AppData> {
    for (const f of [this.file, `${this.file}.bak`]) {
      let text: string
      try {
        text = await fs.readFile(f, 'utf8')
      } catch {
        continue
      }
      try {
        return sanitize(JSON.parse(text))
      } catch (err) {
        console.error('[repository] unreadable file, keeping a copy aside', f, err)
        await fs.copyFile(f, `${f}.corrupt-${Date.now()}`).catch(() => undefined)
      }
    }
    return emptyData()
  }
}

export { sanitize }
