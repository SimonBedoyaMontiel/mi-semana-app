import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import type { Settings } from '@shared/model'
import type { AppInfo } from '@shared/ipc'
import { useStore } from '@/state/store'
import { Sheet } from '@/components/Sheet'
import { Segmented, Switch } from '@/components/primitives'
import { TimeField } from '@/components/TimeField'

const SLOT_FIELDS = [
  ['manana', 'Mañana'],
  ['mediodia', 'Mediodía'],
  ['tarde', 'Tarde'],
  ['noche', 'Noche'],
] as const

const cleanError = (e: unknown): string =>
  e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : 'Algo salió mal.'

function AccountSection() {
  const sync = useStore(s => s.sync)
  const openSheet = useStore(s => s.openSheet)
  if (!sync?.configured) return null
  return (
    <section>
      <h3>Cuenta</h3>
      <div className="setting-row">
        <div>
          <b>{sync.email ?? 'Sin cuenta'}</b>
          <span>{sync.email ? 'Tus datos se sincronizan entre equipos.' : 'Entra con Google o con tu correo para usar tus datos en cualquier equipo.'}</span>
        </div>
        <button type="button" className="btn" onClick={() => openSheet({ kind: 'account' })}>{sync.email ? 'Gestionar' : 'Entrar'}</button>
      </div>
    </section>
  )
}

function UpdateSection({ version }: { version: string }) {
  const update = useStore(s => s.update)
  return (
    <section>
      <h3>Actualizaciones</h3>
      <p className="hint">
        {update.phase === 'ready' ? `La versión ${update.version} está descargada.`
          : update.phase === 'downloading' ? `Descargando la versión ${update.version ?? 'nueva'}… ${update.percent ?? 0}%`
            : `Tienes la versión ${version}. Mi Semana busca versiones nuevas sola y las instala al reiniciar.`}
      </p>
      {update.phase === 'downloading' && <div className="progress"><motion.span animate={{ scaleX: (update.percent ?? 0) / 100 }} /></div>}
      {update.phase === 'ready' && <button type="button" className="btn primary" onClick={() => void window.api.updates.install()}>Reiniciar y actualizar</button>}
    </section>
  )
}

export function SettingsSheet() {
  const close = useStore(s => s.closeSheet)
  const settings = useStore(s => s.data!.settings)
  const dispatch = useStore(s => s.dispatch)
  const notify = useStore(s => s.notify)
  const replaceData = useStore(s => s.replaceData)
  const [info, setInfo] = useState<AppInfo | null>(null)
  const desktop = window.api.platform === 'desktop'

  useEffect(() => {
    void window.api.info().then(setInfo)
  }, [])

  const set = (patch: Partial<Settings>): void => dispatch({ type: 'settings.set', settings: { ...settings, ...patch } })

  const doExport = async (): Promise<void> => {
    try {
      const path = await window.api.exportFile()
      if (path) notify('Copia de seguridad guardada.')
    } catch {
      notify('No se pudo exportar.')
    }
  }
  const doImport = async (): Promise<void> => {
    try {
      const res = await window.api.importFile()
      if (!res) return
      replaceData(res.data)
      const { events, habits, days } = res.added
      notify(events + habits + days ? `Importado: ${events} eventos, ${habits} hábitos, ${days} días de registros.` : 'Todo lo del archivo ya estaba en la app.')
    } catch (e) {
      notify(cleanError(e))
    }
  }

  return (
    <Sheet title="Ajustes" onClose={close} wide>
      <div className="settings">
        <AccountSection />

        <section>
          <h3>Apariencia</h3>
          <Segmented
            label="Tema"
            layoutId="theme"
            value={settings.theme}
            onChange={theme => set({ theme })}
            options={[{ value: 'system', label: 'Sistema' }, { value: 'light', label: 'Claro' }, { value: 'dark', label: 'Oscuro' }]}
          />
          {desktop && <Switch label="Mostrar el panel «Hoy»" on={settings.sidebar} onChange={sidebar => set({ sidebar })} />}
        </section>

        {desktop && (
          <section>
            <h3>Avisos</h3>
            <Switch label="Avisar antes de cada evento" on={settings.eventReminders} onChange={eventReminders => set({ eventReminders })} />
            <label className="field inline">
              <span>Cuánto antes</span>
              <select value={settings.eventLeadMinutes} disabled={!settings.eventReminders} onChange={e => set({ eventLeadMinutes: Number(e.target.value) })}>
                {[0, 5, 10, 15, 30, 60].map(m => <option key={m} value={m}>{m ? `${m} min` : 'Al empezar'}</option>)}
              </select>
            </label>
            <Switch label="Recordar hábitos y suplementos pendientes" on={settings.habitReminders} onChange={habitReminders => set({ habitReminders })} />
            <div className="slot-times">
              {SLOT_FIELDS.map(([k, label]) => (
                <div key={k} className="field">
                  <span>{label}</span>
                  <TimeField
                    label={`Aviso de ${label.toLowerCase()}`}
                    value={settings.slotTimes[k]}
                    disabled={!settings.habitReminders}
                    onChange={v => set({ slotTimes: { ...settings.slotTimes, [k]: v } })}
                  />
                </div>
              ))}
            </div>
            <button type="button" className="btn" onClick={() => void window.api.testNotification()}>Probar un aviso</button>
          </section>
        )}

        {desktop && (
          <section>
            <h3>Sistema</h3>
            <Switch label="Abrir al iniciar Windows" on={settings.launchAtLogin} onChange={launchAtLogin => set({ launchAtLogin })} />
            <Switch label="Al cerrar, seguir en la bandeja (para recibir avisos)" on={settings.closeToTray} onChange={closeToTray => set({ closeToTray })} />
          </section>
        )}

        {desktop && info && <UpdateSection version={info.version} />}

        <section>
          <h3>Tus datos</h3>
          <p className="hint">
            {desktop
              ? 'Todo se guarda en este PC. Cada día se crea una copia automática, y se conservan las de las últimas dos semanas.'
              : 'Todo se guarda en este dispositivo y, si inicias sesión, también en tu cuenta.'}
          </p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => void doExport()}>Exportar copia…</button>
            <button type="button" className="btn" onClick={() => void doImport()}>Importar…</button>
            {desktop && <button type="button" className="btn ghost" onClick={() => void window.api.openDataFolder()}>Abrir carpeta</button>}
          </div>
          <p className="hint">Importar solo añade lo que falta: no borra ni sobrescribe nada.</p>
        </section>

        {info && <p className="version">Mi Semana {info.version}</p>}
      </div>
    </Sheet>
  )
}
