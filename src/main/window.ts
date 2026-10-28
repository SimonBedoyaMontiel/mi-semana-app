import { BrowserWindow, nativeTheme, screen, shell } from 'electron'
import { promises as fs, readFileSync } from 'node:fs'
import { join } from 'node:path'

interface Bounds {
  x?: number
  y?: number
  width: number
  height: number
  maximized: boolean
}

const DEFAULT_BOUNDS: Bounds = { width: 1360, height: 880, maximized: false }
export const TITLEBAR_HEIGHT = 48

/** Paint colours shared with the renderer tokens so the first frame never flashes. */
const CHROME = {
  light: { bg: '#e8e9ec', symbol: '#15171b' },
  dark: { bg: '#131313', symbol: '#ececec' },
}

export const chrome = (): (typeof CHROME)['light'] => (nativeTheme.shouldUseDarkColors ? CHROME.dark : CHROME.light)

function loadBounds(file: string): Bounds {
  try {
    const b = { ...DEFAULT_BOUNDS, ...JSON.parse(readFileSync(file, 'utf8')) } as Bounds
    // Drop a saved position that is no longer on any connected display.
    const visible = b.x !== undefined && b.y !== undefined && screen.getAllDisplays().some(d => {
      const a = d.workArea
      return b.x! < a.x + a.width - 80 && b.x! + b.width > a.x + 80 && b.y! >= a.y - 10 && b.y! < a.y + a.height - 80
    })
    return visible ? b : { ...b, x: undefined, y: undefined }
  } catch {
    return DEFAULT_BOUNDS
  }
}

export function createMainWindow(opts: { stateFile: string; preload: string; show: boolean }): BrowserWindow {
  const b = loadBounds(opts.stateFile)
  const c = chrome()
  const win = new BrowserWindow({
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    minWidth: 900,
    minHeight: 620,
    show: false,
    backgroundColor: c.bg,
    title: 'Mi Semana',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#00000000', symbolColor: c.symbol, height: TITLEBAR_HEIGHT },
    webPreferences: {
      preload: opts.preload,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: true,
      backgroundThrottling: true,
    },
  })

  if (b.maximized) win.maximize()
  win.once('ready-to-show', () => {
    if (opts.show) win.show()
  })

  nativeTheme.on('updated', () => {
    if (win.isDestroyed()) return
    const n = chrome()
    win.setBackgroundColor(n.bg)
    win.setTitleBarOverlay({ color: '#00000000', symbolColor: n.symbol, height: TITLEBAR_HEIGHT })
  })

  // Security: the window only ever shows the bundled app. External web links go to the browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (url !== win.webContents.getURL()) e.preventDefault()
  })
  win.webContents.session.setPermissionRequestHandler((_wc, _perm, cb) => cb(false))
  win.webContents.session.setSpellCheckerLanguages(['es'])

  let saveTimer: NodeJS.Timeout | undefined
  const persist = (): void => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      if (win.isDestroyed()) return
      const nb = win.getNormalBounds()
      void fs.writeFile(opts.stateFile, JSON.stringify({ ...nb, maximized: win.isMaximized() })).catch(() => undefined)
    }, 400)
  }
  win.on('resize', persist)
  win.on('move', persist)
  win.on('maximize', persist)
  win.on('unmaximize', persist)

  return win
}

export const rendererEntry = (dir: string): { url?: string; file?: string } =>
  process.env.ELECTRON_RENDERER_URL ? { url: process.env.ELECTRON_RENDERER_URL } : { file: join(dir, '../renderer/index.html') }
