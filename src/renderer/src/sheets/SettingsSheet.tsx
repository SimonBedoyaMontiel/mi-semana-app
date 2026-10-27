import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Backdrop, Country, Look, Palette, Settings } from '@shared/model'
import { ACCENTS, BACKDROPS, BACKDROP_LABEL, COUNTRY_LABEL, HEX, HOLIDAY_COUNTRIES, PALETTES, PALETTE_LABEL } from '@shared/constants'
import { holidaysOf } from '@shared/holidays'
import { MONTHS_SHORT, fromIso, todayIso } from '@shared/dates'
import type { AppInfo } from '@shared/ipc'
import type { SettingsTab } from '@/state/store'
import { useStore } from '@/state/store'
import { Sheet } from '@/components/Sheet'
import { Icon, SPRING, Segmented, Switch, cx } from '@/components/primitives'
import { TimeField } from '@/components/TimeField'
import { legalUrl } from '@/lib/legal'
import { removePhoto, savePhoto, usePhoto } from '@/lib/appearance'

const SLOT_FIELDS = [
  ['manana', 'Mañana'],
  ['mediodia', 'Mediodía'],
  ['tarde', 'Tarde'],
  ['noche', 'Noche'],
] as const

/** Swatches for the theme cards, so each card previews its palette whatever is active. */
const PALETTE_PREVIEW: Record<Palette, Record<'light' | 'dark', [bg: string, card: string, ink: string, accent: string]>> = {
  grafito: { light: ['#e8e9ec', '#fbfbfc', '#15171b', '#2442e6'], dark: ['#131313', '#1b1b1b', '#ececec', '#5a7bff'] },
  papel: { light: ['#ece7de', '#fbf9f5', '#1f1b16', '#b5532f'], dark: ['#161412', '#1e1b18', '#efe9e1', '#e58a63'] },
  bosque: { light: ['#e3e8e2', '#f9fbf8', '#141a16', '#2c7a4f'], dark: ['#0f1411', '#161c18', '#e6ede8', '#5cc08a'] },
  oceano: { light: ['#e1e8ec', '#f8fbfc', '#121a1f', '#0f7a8a'], dark: ['#0d1417', '#131c20', '#e4eef1', '#4cc3d1'] },
  ciruela: { light: ['#ebe4e9', '#fcf9fb', '#1d1519', '#a03a76'], dark: ['#151013', '#1d161a', '#f0e6eb', '#e07ab4'] },
  medianoche: { light: ['#e3e5ee', '#fafbfe', '#13152a', '#4446d6'], dark: ['#0c0e1a', '#141626', '#e8e9f6', '#8e90ff'] },
}

const ACCENT_NAMES: Record<(typeof ACCENTS)[number], string> = {
  '#2442e6': 'Cobalto',
  '#d2593c': 'Bermellón',
  '#c08a12': 'Ámbar',
  '#2f8a59': 'Verde',
  '#1f8a8d': 'Turquesa',
  '#7259cf': 'Violeta',
  '#bd4c86': 'Magenta',
  '#33363d': 'Grafito',
}

const TABS: ReadonlyArray<{ value: SettingsTab; label: string; icon: ReactNode; desktopOnly?: boolean }> = [
  { value: 'general', label: 'General', icon: Icon.sliders },
  { value: 'design', label: 'Diseño', icon: Icon.palette },
  { value: 'alerts', label: 'Avisos', icon: Icon.bell, desktopOnly: true },
  { value: 'data', label: 'Datos', icon: Icon.database },
]

const cleanError = (e: unknown): string =>
  e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : 'Algo salió mal.'

function AccountSection() {
  const sync = useStore(s => s.sync)
  const openSheet = useStore(s => s.openSheet)
  if (!sync?.configured) return null
  return (
    <section>
      <h3>{Icon.user}Cuenta</h3>
      <div className="setting-row">
        <div>
          <b>{sync.email ?? 'Sin cuenta'}</b>
          <span>{sync.email ? 'Tus datos y tu diseño se sincronizan entre equipos.' : 'Entra con Google o con tu correo para usar tus datos en cualquier equipo.'}</span>
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

function NextHolidays({ country }: { country: Country }) {
  const iso = todayIso()
  const year = Number(iso.slice(0, 4))
  const next = [...holidaysOf(country, year), ...holidaysOf(country, year + 1)].filter(([d]) => d >= iso).slice(0, 3)
  if (!next.length) return null
  return (
    <ul className="next-hols">
      {next.map(([d, name], i) => (
        <motion.li key={d} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0, transition: { delay: i * 0.06 } }}>
          {Icon.star}
          <time>{fromIso(d).getDate()} {MONTHS_SHORT[fromIso(d).getMonth()]}</time>
          <span>{name}</span>
        </motion.li>
      ))}
    </ul>
  )
}

function DesignPane({ settings, set }: { settings: Settings; set: (patch: Partial<Settings>) => void }) {
  const notify = useStore(s => s.notify)
  const photo = usePhoto()
  const file = useRef<HTMLInputElement>(null)
  const custom = useRef<HTMLInputElement>(null)
  const mode = document.documentElement.dataset.mode === 'dark' ? 'dark' : 'light'
  const look = settings.look
  const setLook = (patch: Partial<Look>): void => set({ look: { ...look, ...patch } })
  const isCustom = !!look.accent && !ACCENTS.some(a => a.toLowerCase() === look.accent.toLowerCase())

  const pickPhoto = async (f: File | undefined): Promise<void> => {
    if (!f) return
    try {
      await savePhoto(f)
      setLook({ backdrop: 'photo' })
    } catch (e) {
      notify(cleanError(e))
    }
  }

  const chooseBackdrop = (b: Backdrop): void => {
    if (b === 'photo' && !photo) file.current?.click()
    else setLook({ backdrop: b })
  }

  return (
    <>
      <section>
        <h3>Modo</h3>
        <Segmented
          label="Modo"
          layoutId="theme"
          value={settings.theme}
          onChange={theme => set({ theme })}
          options={[{ value: 'system', label: 'Sistema' }, { value: 'light', label: 'Claro' }, { value: 'dark', label: 'Oscuro' }]}
        />
      </section>

      <section>
        <h3>Tema</h3>
        <div className="theme-grid">
          {PALETTES.map((p, i) => {
            const [bg, card, ink, accent] = PALETTE_PREVIEW[p][mode]
            const on = look.palette === p
            return (
              <motion.button
                key={p}
                type="button"
                className={cx('theme-card', on && 'is-active')}
                aria-pressed={on}
                onClick={() => setLook({ palette: p })}
                style={{ '--pv-bg': bg, '--pv-card': card, '--pv-ink': ink, '--pv-accent': look.accent || accent } as CSSProperties}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { delay: i * 0.035, ...SPRING } }}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.96 }}
              >
                <span className="pv" aria-hidden="true">
                  <span className="pv-card"><i /><b /><b /></span>
                  <span className="pv-card"><b /><i /><b /></span>
                  <span className="pv-dot" />
                </span>
                <span className="theme-name">{PALETTE_LABEL[p]}</span>
                {on && <motion.span layoutId="theme-ring" className="theme-ring" transition={SPRING} />}
              </motion.button>
            )
          })}
        </div>
      </section>

      <section>
        <h3>Color de acento</h3>
        <div className="swatches accent-swatches">
          <motion.button
            type="button"
            className={cx('swatch swatch-auto', !look.accent && 'is-active')}
            aria-label="El del tema"
            title="El del tema"
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setLook({ accent: '' })}
          />
          {ACCENTS.map(a => (
            <motion.button
              key={a}
              type="button"
              className={cx('swatch', look.accent.toLowerCase() === a.toLowerCase() && 'is-active')}
              style={{ '--c': a } as CSSProperties}
              aria-label={ACCENT_NAMES[a]}
              title={ACCENT_NAMES[a]}
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setLook({ accent: a })}
            />
          ))}
          <motion.button
            type="button"
            className={cx('swatch swatch-custom', isCustom && 'is-active')}
            style={isCustom ? ({ '--c': look.accent } as CSSProperties) : undefined}
            aria-label="Otro color"
            title="Otro color"
            whileHover={{ scale: 1.12, rotate: 45 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => custom.current?.click()}
          >
            {!isCustom && Icon.plus}
          </motion.button>
          <input
            ref={custom}
            type="color"
            className="visually-hidden"
            tabIndex={-1}
            value={HEX.test(look.accent) ? look.accent : '#2442e6'}
            onChange={e => setLook({ accent: e.target.value })}
          />
        </div>
      </section>

      <section>
        <h3>Fondo</h3>
        <div className="backdrop-grid">
          {BACKDROPS.map((b, i) => (
            <motion.button
              key={b}
              type="button"
              className={cx('bd-card', `bd-${b}`, look.backdrop === b && 'is-active')}
              aria-pressed={look.backdrop === b}
              onClick={() => chooseBackdrop(b)}
              style={b === 'photo' && photo ? ({ '--photo': `url("${photo}")` } as CSSProperties) : undefined}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1, transition: { delay: i * 0.03, ...SPRING } }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="bd-pv" aria-hidden="true">{b === 'photo' && !photo && Icon.image}</span>
              <span className="theme-name">{BACKDROP_LABEL[b]}</span>
              {look.backdrop === b && <motion.span layoutId="bd-ring" className="theme-ring" transition={SPRING} />}
            </motion.button>
          ))}
        </div>
        <input ref={file} type="file" accept="image/*" className="visually-hidden" tabIndex={-1} onChange={e => { void pickPhoto(e.target.files?.[0]); e.target.value = '' }} />
        <AnimatePresence initial={false}>
          {look.backdrop !== 'none' && (
            <motion.div className="bd-options" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 32 }}>
              <label className="field range-field">
                <span>Intensidad <b>{look.glow}%</b></span>
                <input type="range" min={10} max={100} step={5} value={look.glow} onChange={e => setLook({ glow: Number(e.target.value) })} style={{ '--v': `${look.glow}%` } as CSSProperties} />
              </label>
              <Switch label="Fondo en movimiento" on={look.moving} onChange={moving => setLook({ moving })} />
              {look.backdrop === 'photo' && (
                <div className="btn-row">
                  <button type="button" className="btn" onClick={() => file.current?.click()}>{Icon.image}Cambiar imagen</button>
                  {photo && <button type="button" className="btn ghost danger" onClick={() => { removePhoto(); setLook({ backdrop: 'none' }) }}>Quitar imagen</button>}
                </div>
              )}
              {look.backdrop === 'photo' && <p className="hint">Tu imagen se guarda solo en este equipo. El resto del diseño viaja con tu cuenta.</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </>
  )
}

export function SettingsSheet({ tab: initialTab }: { tab?: SettingsTab }) {
  const close = useStore(s => s.closeSheet)
  const settings = useStore(s => s.data!.settings)
  const dispatch = useStore(s => s.dispatch)
  const notify = useStore(s => s.notify)
  const replaceData = useStore(s => s.replaceData)
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [tab, setTab] = useState<SettingsTab>(initialTab ?? 'general')
  const desktop = window.api.platform === 'desktop'
  const tabs = TABS.filter(t => desktop || !t.desktopOnly)

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
      <nav className="settings-tabs" role="tablist" aria-label="Secciones de ajustes">
        {tabs.map(t => (
          <button key={t.value} type="button" role="tab" aria-selected={tab === t.value} className={cx('stab', tab === t.value && 'is-active')} onClick={() => setTab(t.value)}>
            {tab === t.value && <motion.span layoutId="stab-pill" className="stab-pill" transition={SPRING} />}
            <span className="stab-label">{t.icon}{t.label}</span>
          </button>
        ))}
      </nav>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          className="settings"
          initial={{ opacity: 0, x: 14, filter: 'blur(4px)' }}
          animate={{ opacity: 1, x: 0, filter: 'blur(0px)', transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
          exit={{ opacity: 0, x: -10, filter: 'blur(3px)', transition: { duration: 0.14 } }}
        >
          {tab === 'general' && (
            <>
              <AccountSection />
              <section>
                <h3>{Icon.star}Días festivos</h3>
                <label className="field inline">
                  <span>País</span>
                  <select value={settings.holidays} onChange={e => set({ holidays: e.target.value as Country })}>
                    {HOLIDAY_COUNTRIES.map(c => <option key={c} value={c}>{COUNTRY_LABEL[c]}</option>)}
                  </select>
                </label>
                <NextHolidays country={settings.holidays} />
              </section>
              {desktop && (
                <section>
                  <h3>Ventana</h3>
                  <Switch label="Mostrar el panel «Hoy»" on={settings.sidebar} onChange={sidebar => set({ sidebar })} />
                  <Switch label="Abrir al iniciar Windows" on={settings.launchAtLogin} onChange={launchAtLogin => set({ launchAtLogin })} />
                  <Switch label="Al cerrar, seguir en la bandeja (para recibir avisos)" on={settings.closeToTray} onChange={closeToTray => set({ closeToTray })} />
                </section>
              )}
              {desktop && info && <UpdateSection version={info.version} />}
            </>
          )}

          {tab === 'design' && <DesignPane settings={settings} set={set} />}

          {tab === 'alerts' && desktop && (
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
              <button type="button" className="btn" onClick={() => void window.api.testNotification()}>{Icon.bell}Probar un aviso</button>
            </section>
          )}

          {tab === 'data' && (
            <>
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
              <p className="version">
                {info && <>Mi Semana {info.version} · </>}
                <a href={legalUrl('privacidad')} target="_blank" rel="noopener">Privacidad</a> ·{' '}
                <a href={legalUrl('terminos')} target="_blank" rel="noopener">Condiciones</a>
              </p>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </Sheet>
  )
}
