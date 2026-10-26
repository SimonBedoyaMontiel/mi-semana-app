import { Menu, Tray, nativeImage } from 'electron'

export function createTray(icon: string, actions: { show: () => void; newEvent: () => void; quit: () => void }): Tray {
  const tray = new Tray(nativeImage.createFromPath(icon).resize({ width: 16, height: 16, quality: 'best' }))
  tray.setToolTip('Mi Semana')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Abrir Mi Semana', click: actions.show },
      { label: 'Nuevo evento…', click: actions.newEvent },
      { type: 'separator' },
      { label: 'Salir', click: actions.quit },
    ]),
  )
  tray.on('click', actions.show)
  return tray
}
