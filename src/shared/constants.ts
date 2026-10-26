/**
 * Plain values shared by every process. Kept free of zod so the renderer bundle never pulls the
 * validation library — validation lives in the main process (see model.ts / commands.ts).
 */
import type { Category, Ink, Settings, Slot } from './model'

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
export const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export const CATEGORIES = ['trabajo', 'estudio', 'salud', 'personal', 'otro'] as const
export const INKS = ['cobalt', 'vermilion', 'amber', 'green', 'teal', 'violet', 'magenta'] as const
export const SLOTS = ['manana', 'mediodia', 'tarde', 'noche', 'cualquiera'] as const
export const HABIT_KINDS = ['habito', 'suplemento'] as const

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
