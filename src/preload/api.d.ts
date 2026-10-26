import type { MiSemanaApi } from '../shared/ipc'

declare global {
  interface Window {
    api: MiSemanaApi
  }
}

export {}
