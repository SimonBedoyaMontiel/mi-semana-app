import { Notification } from 'electron'
import type { AppData } from '@shared/model'
import { remindersBetween } from '@shared/reminders'

const TICK_MS = 20_000
/** After sleep/hibernate, only catch up on what was due in the last few minutes. */
const MAX_CATCH_UP_MS = 10 * 60_000

export class ReminderService {
  private timer: NodeJS.Timeout | undefined
  private last = Date.now()
  private fired = new Set<string>()

  constructor(
    private readonly getData: () => AppData,
    private readonly onClick: (date: string) => void,
    private readonly icon: string,
  ) {}

  start(): void {
    this.stop()
    this.last = Date.now()
    this.timer = setInterval(() => this.tick(), TICK_MS)
  }

  stop(): void {
    clearInterval(this.timer)
  }

  tick(now = Date.now()): void {
    const from = Math.max(this.last, now - MAX_CATCH_UP_MS)
    this.last = now
    if (!Notification.isSupported()) return
    for (const r of remindersBetween(this.getData(), from, now)) {
      if (this.fired.has(r.key)) continue
      this.fired.add(r.key)
      const n = new Notification({ title: r.title, body: r.body, icon: this.icon, silent: false })
      n.on('click', () => this.onClick(r.date))
      n.show()
    }
    if (this.fired.size > 500) this.fired = new Set([...this.fired].slice(-200))
  }

  test(): void {
    const n = new Notification({ title: 'Mi Semana', body: 'Así se verán tus avisos.', icon: this.icon })
    n.show()
  }
}
