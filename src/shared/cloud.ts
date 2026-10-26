/**
 * Supabase adapter shared by the desktop main process and the mobile web app.
 * Tables and policies: supabase/schema.sql.
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

const PAGE = 1000
/** Re-read a few seconds before the cursor: rows committed late with an older timestamp still arrive. */
const OVERLAP_MS = 5000

const ERRORS: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'Correo o contraseña incorrectos.'],
  [/email not confirmed/i, 'Confirma tu correo: revisa la bandeja de entrada y pulsa el enlace de Supabase.'],
  [/user already registered/i, 'Ya existe una cuenta con ese correo. Usa «Entrar».'],
  [/password should be at least/i, 'La contraseña debe tener al menos 6 caracteres.'],
  [/rate limit/i, 'Demasiados intentos. Espera un minuto y vuelve a probar.'],
  [/fetch failed|failed to fetch|network/i, 'Sin conexión con el servidor.'],
]

export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e)
  return ERRORS.find(([re]) => re.test(msg))?.[1] ?? msg
}

export class Cloud {
  readonly client: SupabaseClient

  constructor(cfg: CloudConfig, storage: AuthStorage) {
    this.client = createClient(cfg.url, cfg.key, {
      auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'mi-semana-auth' },
    })
  }

  async email(): Promise<string | null> {
    const { data } = await this.client.auth.getSession()
    return data.session?.user.email ?? null
  }

  onAuthChange(cb: (email: string | null) => void): () => void {
    const { data } = this.client.auth.onAuthStateChange((_event, session) => cb(session?.user.email ?? null))
    return () => data.subscription.unsubscribe()
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await this.client.auth.signInWithPassword({ email, password })
    if (error) throw new Error(friendlyError(error))
  }

  /** Returns true when the account still needs its e-mail confirmed. */
  async signUp(email: string, password: string): Promise<boolean> {
    const { data, error } = await this.client.auth.signUp({ email, password })
    if (error) throw new Error(friendlyError(error))
    return !data.session
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut()
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
