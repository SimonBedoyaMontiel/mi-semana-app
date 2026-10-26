import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Settings } from '@shared/model'
import type { AppInfo } from '@shared/ipc'
import { useStore } from '@/state/store'
import { Sheet } from '@/components/Sheet'
import { Segmented, Switch, cx } from '@/components/primitives'
import { TimeField } from '@/components/TimeField'

const SLOT_FIELDS = [
  ['manana', 'Mañana'],
  ['mediodia', 'Mediodía'],
  ['tarde', 'Tarde'],
  ['noche', 'Noche'],
] as const

const cleanError = (e: unknown): string =>
  e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : 'Algo salió mal.'

function SyncSection() {
  const sync = useStore(s => s.sync)
  const notify = useStore(s => s.notify)
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)

  if (!sync?.configured) {
    return (
      <section>
        <h3>Sincronización</h3>
        <p className="hint">Esta copia de Mi Semana se compiló sin las claves de Supabase, así que sincronizar no está disponible.</p>
      </section>
    )
  }

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'in') {
        await window.api.sync.signIn(email, password)
        notify('Sesión iniciada. Sincronizando tus datos…')
      } else if (await window.api.sync.signUp(email, password)) {
        setPending(email)
        setMode('in')
      } else notify('Cuenta creada. Sincronizando tus datos…')
      setPassword('')
    } catch (err) {
      setError(cleanError(err))
    } finally {
      setBusy(false)
    }
  }

  if (sync.email) {
    return (
      <section>
        <h3>Sincronización</h3>
        <div className="account">
          <span className={cx('account-dot', `is-${sync.phase}`)} />
          <div>
            <b>{sync.email}</b>
            <span>
              {sync.phase === 'syncing' ? 'Sincronizando…'
                : sync.phase === 'error' ? sync.error
                  : sync.lastSync ? `Última sincronización: ${new Date(sync.lastSync).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : 'Conectado'}
            </span>
          </div>
        </div>
        <p className="hint">Tus eventos, hábitos y notas se mantienen iguales en todos los dispositivos donde entres con esta cuenta. Los ajustes de cada dispositivo no se comparten.</p>
        <div className="btn-row">
          <button type="button" className="btn" disabled={sync.phase === 'syncing'} onClick={() => void window.api.sync.now()}>Sincronizar ahora</button>
          <button type="button" className="btn ghost" onClick={() => void window.api.sync.signOut()}>Cerrar sesión</button>
        </div>
      </section>
    )
  }

  return (
    <section>
      <h3>Sincronización</h3>
      <p className="hint">Entra con la misma cuenta en el PC y en el móvil para tener todo igual en los dos. Lo que ya tengas aquí se sube al entrar.</p>
      <AnimatePresence>
        {pending && (
          <motion.p className="notice" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            Te enviamos un correo a <b>{pending}</b>. Pulsa el enlace para confirmar la cuenta y después entra aquí.
          </motion.p>
        )}
      </AnimatePresence>
      <Segmented label="Cuenta" layoutId="auth-mode" size="s" value={mode} onChange={m => { setMode(m); setError(null) }} options={[{ value: 'in', label: 'Entrar' }, { value: 'up', label: 'Crear cuenta' }]} />
      <form className="auth" onSubmit={e => void submit(e)}>
        <label className="field"><span>Correo</span><input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label className="field"><span>Contraseña</span><input type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required minLength={6} value={password} onChange={e => setPassword(e.target.value)} /></label>
        <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Un momento…' : mode === 'in' ? 'Entrar' : 'Crear cuenta'}</button>
      </form>
      <AnimatePresence>{error && <motion.p className="error" role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{error}</motion.p>}</AnimatePresence>
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
        <SyncSection />

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
