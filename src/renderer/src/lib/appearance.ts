/**
 * Applies the chosen look to <html>: light/dark mode, palette, accent and backdrop are data
 * attributes and custom properties that tokens.css reads. The last look is cached so the next
 * start paints with it from the first frame, before the data has loaded.
 */
import { useEffect, useSyncExternalStore } from 'react'
import type { Look, Settings } from '@shared/model'
import { DEFAULT_SETTINGS, HEX } from '@shared/constants'

const LOOK_KEY = 'mi-semana:look'
const PHOTO_KEY = 'mi-semana:photo'
const PHOTO_EVENT = 'mi-semana:photo'

type Mode = 'light' | 'dark'
interface Cached { theme: Settings['theme']; look: Look }

const dark = matchMedia('(prefers-color-scheme: dark)')

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

function paint(theme: Settings['theme'], look: Look): void {
  const root = document.documentElement
  const mode: Mode = theme === 'system' ? (dark.matches ? 'dark' : 'light') : theme
  root.dataset.mode = mode
  root.dataset.palette = look.palette
  root.dataset.backdrop = look.backdrop
  root.dataset.moving = String(look.moving)
  root.style.setProperty('--glow', String(look.glow / 100))
  if (look.accent && HEX.test(look.accent)) {
    root.dataset.accent = 'custom'
    root.style.setProperty('--accent-user', look.accent)
    // Light accents (yellow, mint) need dark text on them.
    root.style.setProperty('--on-accent-user', luminance(look.accent) > 0.45 ? '#15171b' : '#ffffff')
  } else {
    delete root.dataset.accent
    root.style.removeProperty('--accent-user')
    root.style.removeProperty('--on-accent-user')
  }
  const meta = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim()
  for (const m of meta) {
    m.content = bg
    m.removeAttribute('media')
  }
}

/** First paint: the cached look, or the defaults. */
export function paintCached(): void {
  let cached: Cached = { theme: DEFAULT_SETTINGS.theme, look: DEFAULT_SETTINGS.look }
  try {
    cached = { ...cached, ...(JSON.parse(localStorage.getItem(LOOK_KEY) ?? '{}') as Partial<Cached>) }
  } catch { /* no cache yet */ }
  paint(cached.theme, { ...DEFAULT_SETTINGS.look, ...cached.look })
}

/** Keeps <html> in step with the settings and with the system's light/dark switch. */
export function useAppearance(settings: Settings | undefined): void {
  const theme = settings?.theme
  const look = settings?.look
  useEffect(() => {
    if (!theme || !look) return
    const run = (): void => paint(theme, look)
    run()
    try {
      localStorage.setItem(LOOK_KEY, JSON.stringify({ theme, look } satisfies Cached))
    } catch { /* storage blocked */ }
    dark.addEventListener('change', run)
    return () => dark.removeEventListener('change', run)
  }, [theme, look])
}

// ---- Own picture: stays on this device (it is too heavy to sync) ----

const readPhoto = (): string | null => {
  try {
    return localStorage.getItem(PHOTO_KEY)
  } catch {
    return null
  }
}

const subscribe = (cb: () => void): (() => void) => {
  window.addEventListener(PHOTO_EVENT, cb)
  return () => window.removeEventListener(PHOTO_EVENT, cb)
}

export const usePhoto = (): string | null => useSyncExternalStore(subscribe, readPhoto)

/**
 * Downscales the picture (it is shown blurred, so 1400 px is plenty) and keeps it as a JPEG data
 * URL. Throws with a message for the user when the file is not an image or does not fit.
 */
export async function savePhoto(file: File): Promise<void> {
  if (!file.type.startsWith('image/')) throw new Error('Elige un archivo de imagen.')
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('No se pudo abrir la imagen.')
  })
  const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const url = canvas.toDataURL('image/jpeg', 0.8)
  try {
    localStorage.setItem(PHOTO_KEY, url)
  } catch {
    throw new Error('La imagen es demasiado grande para guardarla en este equipo.')
  }
  window.dispatchEvent(new Event(PHOTO_EVENT))
}

export function removePhoto(): void {
  try {
    localStorage.removeItem(PHOTO_KEY)
  } catch { /* storage blocked */ }
  window.dispatchEvent(new Event(PHOTO_EVENT))
}
