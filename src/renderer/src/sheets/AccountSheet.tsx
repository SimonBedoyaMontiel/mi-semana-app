import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useStore } from '@/state/store'
import { Sheet } from '@/components/Sheet'
import { Segmented, cx } from '@/components/primitives'
import { legalUrl } from '@/lib/legal'

type Mode = 'signin' | 'signup' | 'reset'

const cleanError = (e: unknown): string =>
  e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : 'Algo salió mal. Vuelve a intentarlo.'

const fade = { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 }, transition: { duration: 0.2 } }

/** Google's own four-colour mark, as their sign-in button guidelines require. */
const GoogleMark = (
  <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
    <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
  </svg>
)

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function SignedIn() {
  const sync = useStore(s => s.sync)!
  const close = useStore(s => s.closeSheet)
  const notify = useStore(s => s.notify)
  const [confirming, setConfirming] = useState(false)
  const web = window.api.platform === 'web'
  const initial = (sync.email ?? '?').charAt(0).toUpperCase()

  const signOut = async (clearLocal: boolean): Promise<void> => {
    await window.api.sync.signOut({ clearLocal })
    close()
    notify(clearLocal ? 'Sesión cerrada y datos borrados de este navegador.' : 'Sesión cerrada. Tus datos siguen en este equipo.')
  }

  return (
    <div className="account-view">
      <div className="account-card">
        <span className="avatar avatar-lg" aria-hidden="true">{initial}</span>
        <div className="account-card-text">
          <b>{sync.email}</b>
          <span className={cx('sync-line', `is-${sync.phase}`)}>
            <i />
            {sync.phase === 'syncing' ? 'Sincronizando…'
              : sync.phase === 'error' ? sync.error
                : sync.lastSync ? `Sincronizado a las ${new Date(sync.lastSync).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : 'Conectado'}
          </span>
        </div>
        <button type="button" className="btn" disabled={sync.phase === 'syncing'} onClick={() => void window.api.sync.now()}>
          Sincronizar
        </button>
      </div>
      <p className="hint">
        Tus eventos, hábitos y notas son los mismos en cualquier equipo donde entres con esta cuenta. El tema y los avisos son de cada equipo.
      </p>
      <AnimatePresence mode="wait" initial={false}>
        {confirming ? (
          <motion.div key="confirm" className="confirm" {...fade}>
            <p>¿Quieres borrar también los datos de este navegador? Hazlo si el equipo no es tuyo. Siguen guardados en tu cuenta.</p>
            <div className="btn-row">
              <button type="button" className="btn danger-solid" onClick={() => void signOut(true)}>Cerrar sesión y borrar</button>
              <button type="button" className="btn" onClick={() => void signOut(false)}>Solo cerrar sesión</button>
              <button type="button" className="btn ghost" onClick={() => setConfirming(false)}>Cancelar</button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="actions" className="btn-row" {...fade}>
            <button type="button" className="btn ghost danger" onClick={() => (web ? setConfirming(true) : void signOut(false))}>
              Cerrar sesión
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function NewPassword() {
  const notify = useStore(s => s.notify)
  const close = useStore(s => s.closeSheet)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await window.api.sync.updatePassword(password)
      notify('Contraseña cambiada.')
      close()
    } catch (err) {
      setError(cleanError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={e => void submit(e)}>
      <p className="lead">Escribe tu nueva contraseña.</p>
      <Field label="Nueva contraseña">
        <input data-autofocus type="password" autoComplete="new-password" minLength={6} required value={password} onChange={e => setPassword(e.target.value)} />
      </Field>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" className="btn primary block" disabled={busy}>{busy ? 'Guardando…' : 'Guardar contraseña'}</button>
    </form>
  )
}

function SignedOut() {
  const sync = useStore(s => s.sync)!
  const notify = useStore(s => s.notify)
  const close = useStore(s => s.closeSheet)
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<'google' | 'form' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<{ kind: 'confirm' | 'reset'; email: string } | null>(null)

  const google = async (): Promise<void> => {
    setBusy('google')
    setError(null)
    try {
      await window.api.sync.signInWithGoogle()
    } catch (err) {
      setError(cleanError(err))
      setBusy(null)
    }
  }

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setBusy('form')
    setError(null)
    try {
      if (mode === 'reset') {
        await window.api.sync.resetPassword(email)
        setSent({ kind: 'reset', email })
      } else if (mode === 'signup') {
        if (await window.api.sync.signUp(email, password)) setSent({ kind: 'confirm', email })
        else {
          notify('Cuenta creada. Sincronizando tus datos…')
          close()
        }
      } else {
        await window.api.sync.signIn(email, password)
        notify('Sesión iniciada.')
        close()
      }
    } catch (err) {
      setError(cleanError(err))
    } finally {
      setBusy(null)
    }
  }

  if (sent) {
    return (
      <motion.div className="sent" {...fade}>
        <span className="sent-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="ico"><path d="M3.5 6.5h17v11h-17z" /><path d="M3.5 7l8.5 6.5L20.5 7" /></svg>
        </span>
        <p className="lead">Revisa tu correo</p>
        <p className="hint">
          {sent.kind === 'confirm'
            ? <>Enviamos un enlace a <b>{sent.email}</b>. Ábrelo para activar la cuenta y después entra aquí.</>
            : <>Si <b>{sent.email}</b> tiene una cuenta, recibirá un enlace para elegir una contraseña nueva.</>}
        </p>
        <button type="button" className="btn" onClick={() => { setSent(null); setMode('signin') }}>Volver a entrar</button>
      </motion.div>
    )
  }

  return (
    <div className="auth">
      <button type="button" className="btn google block" disabled={busy !== null} onClick={() => void google()}>
        {GoogleMark}
        {busy === 'google' || sync.waitingForBrowser ? 'Continúa en el navegador…' : 'Continuar con Google'}
      </button>
      <div className="divider"><span>o con tu correo</span></div>
      {mode !== 'reset' && (
        <Segmented
          label="Cuenta"
          layoutId="auth-mode"
          size="s"
          value={mode}
          onChange={m => { setMode(m); setError(null) }}
          options={[{ value: 'signin', label: 'Entrar' }, { value: 'signup', label: 'Crear cuenta' }]}
        />
      )}
      <form className="auth-form" onSubmit={e => void submit(e)}>
        {mode === 'reset' && <p className="lead">Te enviaremos un enlace para elegir una contraseña nueva.</p>}
        <Field label="Correo">
          <input data-autofocus type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </Field>
        <AnimatePresence initial={false}>
          {mode !== 'reset' && (
            <motion.div key="pw" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
              <Field label="Contraseña">
                <input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={6} required value={password} onChange={e => setPassword(e.target.value)} />
              </Field>
            </motion.div>
          )}
        </AnimatePresence>
        {(error || sync.error) && <p className="error" role="alert">{error ?? sync.error}</p>}
        <button type="submit" className="btn primary block" disabled={busy !== null}>
          {busy === 'form' ? 'Un momento…' : mode === 'signin' ? 'Entrar' : mode === 'signup' ? 'Crear cuenta' : 'Enviar enlace'}
        </button>
        {mode === 'signin' && <button type="button" className="link" onClick={() => { setMode('reset'); setError(null) }}>¿Olvidaste tu contraseña?</button>}
        {mode === 'reset' && <button type="button" className="link" onClick={() => setMode('signin')}>Volver</button>}
      </form>
      <p className="legal">
        Al continuar aceptas las <a href={legalUrl('terminos')} target="_blank" rel="noopener">Condiciones de uso</a> y la{' '}
        <a href={legalUrl('privacidad')} target="_blank" rel="noopener">Política de privacidad</a>.
      </p>
    </div>
  )
}

export function AccountSheet() {
  const close = useStore(s => s.closeSheet)
  const sync = useStore(s => s.sync)
  const title = sync?.recovery ? 'Nueva contraseña' : sync?.email ? 'Tu cuenta' : 'Entrar en Mi Semana'
  return (
    <Sheet title={title} onClose={close}>
      {!sync?.configured ? (
        <p className="hint">Esta copia de Mi Semana se compiló sin conexión a la nube, así que las cuentas no están disponibles.</p>
      ) : sync.recovery ? (
        <NewPassword />
      ) : sync.email ? (
        <SignedIn />
      ) : (
        <SignedOut />
      )}
    </Sheet>
  )
}
