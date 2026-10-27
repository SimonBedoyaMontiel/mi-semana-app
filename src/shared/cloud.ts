/**
 * Supabase adapter shared by the desktop main process and the web app.
 * Tables and policies: supabase/schema.sql. Auth uses the PKCE flow everywhere, so the same code
 * works for a browser redirect (web) and a custom-protocol callback (desktop).
 */
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { RecordRow, SyncTransport } from './sync'

export interface AuthStorage {
  getItem(key: string): Promise<string | null> | string | null
  setItem(key: string, value: string): Promise<void> | void
  removeItem(key: string): Promise<void> | void
}

export interface CloudConfig {
  url: string
  key: string
}

export interface Identity {
  id: string
  email: string | null
}

export type AuthEvent = 'signed-in' | 'signed-out' | 'recovery'

const PAGE = 1000
/** Re-read a few seconds before the cursor: rows committed late with an older timestamp still arrive. */
const OVERLAP_MS = 5000

const ERRORS: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'Correo o contraseña incorrectos.'],
  [/email not confirmed/i, 'Todavía no confirmaste tu correo. Abre el enlace que te enviamos y vuelve a entrar.'],
  [/user already registered/i, 'Ya existe una cuenta con ese correo. Entra con ella.'],
  [/password should be at least/i, 'La contraseña debe tener al menos 6 caracteres.'],
  [/same password|different from the old/i, 'La contraseña nueva tiene que ser distinta de la anterior.'],
  [/provider is not enabled|unsupported provider/i, 'El acceso con Google todavía no está activado en el servidor.'],
  [/rate limit|too many/i, 'Demasiados intentos. Espera un minuto y vuelve a probar.'],
  [/code verifier|invalid flow state|auth code/i, 'El enlace de acceso caducó. Vuelve a intentarlo.'],
  [/fetch failed|failed to fetch|network/i, 'Sin conexión con el servidor.'],
]

export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e)
  return ERRORS.find(([re]) => re.test(msg))?.[1] ?? msg
}

export class Cloud {
  readonly client: SupabaseClient

  constructor(cfg: CloudConfig, storage: AuthStorage, opts: { detectSessionInUrl?: boolean } = {}) {
    this.client = createClient(cfg.url, cfg.key, {
      auth: {
        storage,
        persistSession: true,
        autoRefreshToken: true,
        flowType: 'pkce',
        detectSessionInUrl: opts.detectSessionInUrl ?? false,
        storageKey: 'mi-semana-auth',
      },
    })
  }

  async identity(): Promise<Identity | null> {
    const { data } = await this.client.auth.getSession()
    const u = data.session?.user
    return u ? { id: u.id, email: u.email ?? null } : null
  }

  onAuthChange(cb: (who: Identity | null, event: AuthEvent | null) => void): () => void {
    const { data } = this.client.auth.onAuthStateChange((event, session) => {
      const who = session?.user ? { id: session.user.id, email: session.user.email ?? null } : null
      cb(who, event === 'PASSWORD_RECOVERY' ? 'recovery' : event === 'SIGNED_IN' ? 'signed-in' : event === 'SIGNED_OUT' ? 'signed-out' : null)
    })
    return () => data.subscription.unsubscribe()
  }

  async signIn(email: string, password: string): Promise<Identity> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password })
    if (error) throw new Error(friendlyError(error))
    return { id: data.user.id, email: data.user.email ?? null }
  }

  /** Returns the new identity, or null when the account must confirm its e-mail first. */
  async signUp(email: string, password: string, confirmRedirect: string): Promise<Identity | null> {
    const { data, error } = await this.client.auth.signUp({ email, password, options: { emailRedirectTo: confirmRedirect } })
    if (error) throw new Error(friendlyError(error))
    // Supabase answers an existing e-mail with an empty identity list instead of an error.
    if (data.user && !data.user.identities?.length) throw new Error(friendlyError('User already registered'))
    return data.session && data.user ? { id: data.user.id, email: data.user.email ?? null } : null
  }

  /** URL of Google's consent screen; the caller decides how to open it (redirect or system browser). */
  async googleUrl(redirectTo: string): Promise<string> {
    const { data, error } = await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
    })
    if (error || !data.url) throw new Error(friendlyError(error ?? 'No se pudo abrir Google.'))
    return data.url
  }

  /** Finishes an OAuth or e-mail link that came back with `?code=…`. */
  async exchange(callbackUrl: string): Promise<Identity> {
    const url = new URL(callbackUrl)
    const failure = url.searchParams.get('error_description') ?? new URLSearchParams(url.hash.slice(1)).get('error_description')
    if (failure) throw new Error(friendlyError(failure))
    const code = url.searchParams.get('code')
    if (!code) throw new Error('El enlace de acceso no es válido.')
    const { data, error } = await this.client.auth.exchangeCodeForSession(code)
    if (error) throw new Error(friendlyError(error))
    return { id: data.user.id, email: data.user.email ?? null }
  }

  async resetPassword(email: string, redirectTo: string): Promise<void> {
    const { error } = await this.client.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) throw new Error(friendlyError(error))
  }

  async updatePassword(password: string): Promise<void> {
    const { error } = await this.client.auth.updateUser({ password })
    if (error) throw new Error(friendlyError(error))
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut({ scope: 'local' })
  }

  readonly transport: SyncTransport = {
    pull: async cursor => {
      const since = cursor ? new Date(new Date(cursor).getTime() - OVERLAP_MS).toISOString() : null
      const rows: RecordRow[] = []
      for (let from = 0; ; from += PAGE) {
        let q = this.client.from('records').select('key,value,deleted,updated_at,modified_at').order('modified_at').range(from, from + PAGE - 1)
        if (since) q = q.gt('modified_at', since)
        const { data, error } = await q
        if (error) throw new Error(friendlyError(error))
        rows.push(...(data as RecordRow[]).map(r => ({ ...r, updated_at: Number(r.updated_at) })))
        if (data.length < PAGE) return rows
      }
    },
    push: async rows => {
      const items = rows.map(({ key, value, deleted, updated_at }) => ({ key, value, deleted, updated_at }))
      const { error } = await this.client.rpc('push_records', { items })
      if (error) throw new Error(friendlyError(error))
    },
  }
}
