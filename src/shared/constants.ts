/**
 * Plain values shared by every process. Kept free of zod so the renderer bundle never pulls the
 * validation library — validation lives in the main process (see model.ts / commands.ts).
 */
import type { Category, Ink, Priority, Settings, Slot } from './model'

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
export const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export const CATEGORIES = ['trabajo', 'estudio', 'salud', 'personal', 'otro'] as const
export const INKS = ['cobalt', 'vermilion', 'amber', 'green', 'teal', 'violet', 'magenta'] as const
export const SLOTS = ['manana', 'mediodia', 'tarde', 'noche', 'cualquiera'] as const
export const HABIT_KINDS = ['habito', 'suplemento'] as const
export const REPEAT_FREQS = ['daily', 'weekly', 'monthly'] as const
export const PRIORITIES = ['alta', 'media', 'baja'] as const

/** Complete looks: surfaces, text and a default accent, each with a light and a dark variant. */
export const PALETTES = ['grafito', 'papel', 'bosque', 'oceano', 'ciruela', 'medianoche'] as const
/** Blurred scenery behind the calendar. `photo` is a picture chosen on this device. */
export const BACKDROPS = ['none', 'aurora', 'atardecer', 'oceano', 'bosque', 'niebla', 'photo'] as const
export const HOLIDAY_COUNTRIES = ['none', 'CO', 'ES', 'MX', 'AR', 'CL', 'PE', 'US'] as const
/** Accent choices offered as swatches; any other #rrggbb also works. */
export const ACCENTS = ['#2442e6', '#d2593c', '#c08a12', '#2f8a59', '#1f8a8d', '#7259cf', '#bd4c86', '#33363d'] as const
export const HEX = /^#[0-9a-f]{6}$/i

/** Minutes before start; -1 disables the reminder for that event. */
export const REMINDER_CHOICES = [-1, 0, 5, 10, 15, 30, 60, 120] as const

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  eventReminders: true,
  eventLeadMinutes: 10,
  habitReminders: true,
  slotTimes: { manana: '08:00', mediodia: '13:00', tarde: '18:00', noche: '21:30' },
  launchAtLogin: false,
  closeToTray: true,
  sidebar: true,
  look: { palette: 'grafito', accent: '', backdrop: 'none', glow: 60, moving: true },
  holidays: 'CO',
}

export const CATEGORY_LABEL: Record<Category, string> = {
  trabajo: 'Trabajo',
  estudio: 'Estudio',
  salud: 'Salud',
  personal: 'Personal',
  otro: 'Otro',
}

export const SLOT_LABEL: Record<Slot, string> = {
  manana: 'Mañana',
  mediodia: 'Mediodía',
  tarde: 'Tarde',
  noche: 'Noche',
  cualquiera: 'Cualquier momento',
}

export const INK_LABEL: Record<Ink, string> = {
  cobalt: 'Cobalto',
  vermilion: 'Bermellón',
  amber: 'Ámbar',
  green: 'Verde',
  teal: 'Turquesa',
  violet: 'Violeta',
  magenta: 'Magenta',
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
}

export const PALETTE_LABEL: Record<(typeof PALETTES)[number], string> = {
  grafito: 'Grafito',
  papel: 'Papel',
  bosque: 'Bosque',
  oceano: 'Océano',
  ciruela: 'Ciruela',
  medianoche: 'Medianoche',
}

export const BACKDROP_LABEL: Record<(typeof BACKDROPS)[number], string> = {
  none: 'Sin fondo',
  aurora: 'Aurora',
  atardecer: 'Atardecer',
  oceano: 'Océano',
  bosque: 'Bosque',
  niebla: 'Niebla',
  photo: 'Mi imagen',
}

export const COUNTRY_LABEL: Record<(typeof HOLIDAY_COUNTRIES)[number], string> = {
  none: 'No mostrar festivos',
  CO: 'Colombia',
  ES: 'España',
  MX: 'México',
  AR: 'Argentina',
  CL: 'Chile',
  PE: 'Perú',
  US: 'Estados Unidos',
}

export const REPEAT_LABEL: Record<(typeof REPEAT_FREQS)[number], string> = {
  daily: 'Cada día',
  weekly: 'Cada semana',
  monthly: 'Cada mes',
}

/** Public web app. E-mail confirmations and password resets land here, also for desktop users. */
export const WEB_APP_URL = 'https://simonbedoyamontiel.github.io/mi-semana-app/'
/** Desktop OAuth callback, registered as a Windows protocol by the installer. */
export const DESKTOP_AUTH_CALLBACK = 'misemana://auth-callback'
