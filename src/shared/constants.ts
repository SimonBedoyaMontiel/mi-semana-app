/**
 * Plain values shared by every process. Kept free of zod so the renderer bundle never pulls the
 * validation library — validation lives in the main process (see model.ts / commands.ts).
 */
import type { Category, Energy, Ink, Priority, Settings, Slot } from './model'

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
export const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export const CATEGORIES = ['trabajo', 'estudio', 'salud', 'personal', 'otro'] as const
export const INKS = ['cobalt', 'vermilion', 'amber', 'green', 'teal', 'violet', 'magenta'] as const
export const SLOTS = ['manana', 'mediodia', 'tarde', 'noche', 'cualquiera'] as const
export const HABIT_KINDS = ['habito', 'suplemento'] as const
export const REPEAT_FREQS = ['daily', 'weekly', 'monthly', 'yearly'] as const
export const PRIORITIES = ['alta', 'media', 'baja'] as const
export const ENERGY = ['baja', 'media', 'alta'] as const
/** Mood scale for the journal: 1 (very bad) … 5 (very good). */
export const MOODS = [1, 2, 3, 4, 5] as const
export const FOCUS_CHOICES = [15, 25, 45, 60, 90] as const
/** Currencies offered in Ajustes. Amounts are stored as integer hundredths of the unit. */
export const CURRENCIES = ['COP', 'USD', 'EUR', 'MXN', 'ARS', 'CLP', 'PEN'] as const
export const CURRENCY_LABEL: Record<(typeof CURRENCIES)[number], string> = {
  COP: 'Peso colombiano (COP)',
  USD: 'Dólar estadounidense (USD)',
  EUR: 'Euro (EUR)',
  MXN: 'Peso mexicano (MXN)',
  ARS: 'Peso argentino (ARS)',
  CLP: 'Peso chileno (CLP)',
  PEN: 'Sol peruano (PEN)',
}
/** Currencies written without decimals. */
export const WHOLE_CURRENCIES: ReadonlySet<string> = new Set(['COP', 'CLP', 'ARS'])

export const TX_KINDS = ['gasto', 'ingreso'] as const
export const EXPENSE_CATS = ['comida', 'mercado', 'transporte', 'hogar', 'servicios', 'salud', 'ocio', 'compras', 'educacion', 'suscripciones', 'otros'] as const
export const INCOME_CATS = ['salario', 'extra', 'ventas', 'regalo', 'reembolso', 'otros_ingresos'] as const
export const FIN_CATS = [...EXPENSE_CATS, ...INCOME_CATS] as const
export const FIN_CAT_LABEL: Record<(typeof FIN_CATS)[number], string> = {
  comida: 'Comida',
  mercado: 'Mercado',
  transporte: 'Transporte',
  hogar: 'Hogar',
  servicios: 'Servicios',
  salud: 'Salud',
  ocio: 'Ocio',
  compras: 'Compras',
  educacion: 'Educación',
  suscripciones: 'Suscripciones',
  otros: 'Otros',
  salario: 'Salario',
  extra: 'Trabajo extra',
  ventas: 'Ventas',
  regalo: 'Regalo',
  reembolso: 'Reembolso',
  otros_ingresos: 'Otros',
}
export const FIN_CAT_INK: Record<(typeof FIN_CATS)[number], Ink> = {
  comida: 'vermilion',
  mercado: 'amber',
  transporte: 'cobalt',
  hogar: 'teal',
  servicios: 'violet',
  salud: 'green',
  ocio: 'magenta',
  compras: 'amber',
  educacion: 'violet',
  suscripciones: 'magenta',
  otros: 'cobalt',
  salario: 'green',
  extra: 'teal',
  ventas: 'cobalt',
  regalo: 'magenta',
  reembolso: 'amber',
  otros_ingresos: 'violet',
}
/** Icons for movements, categories, subscriptions, accounts and goals, grouped as the picker shows them. */
export const FIN_ICON_GROUPS = [
  { label: 'Comida y compras', icons: ['cubiertos', 'cafe', 'pizza', 'hamburguesa', 'helado', 'manzana', 'cerveza', 'copa', 'carrito', 'bolsa', 'ropa', 'regalo', 'etiqueta'] },
  { label: 'Moverse', icons: ['bus', 'carro', 'moto', 'bici', 'tren', 'gasolina', 'parqueo', 'avion', 'maleta'] },
  { label: 'Casa y servicios', icons: ['casa', 'sofa', 'cama', 'lavadora', 'bombilla', 'rayo', 'agua', 'llama', 'wifi', 'celular', 'tv', 'llave', 'herramienta', 'planta', 'mascota', 'bebe'] },
  { label: 'Salud y ocio', icons: ['corazon', 'cruz', 'pastilla', 'gafas', 'tijeras', 'pesa', 'balon', 'juego', 'musica', 'auriculares', 'pelicula', 'boleto', 'camara', 'paleta', 'globo', 'nube', 'repetir'] },
  { label: 'Trabajo y estudio', icons: ['birrete', 'libro', 'laptop', 'lapiz', 'documento', 'calculadora', 'sobre', 'paquete'] },
  { label: 'Personas', icons: ['personas', 'donar', 'mundo', 'escudo'] },
  { label: 'Dinero', icons: ['billete', 'monedas', 'tarjeta', 'billetera', 'banco', 'alcancia', 'grafico', 'maletin', 'reloj', 'tienda', 'retorno', 'recibo', 'porcentaje', 'diamante', 'estrella'] },
] as const
export const FIN_ICONS = FIN_ICON_GROUPS.flatMap(g => g.icons) as unknown as readonly [FinIconName, ...FinIconName[]]
export type FinIconName = (typeof FIN_ICON_GROUPS)[number]['icons'][number]
export const FIN_CAT_ICON: Record<(typeof FIN_CATS)[number], FinIconName> = {
  comida: 'cubiertos',
  mercado: 'carrito',
  transporte: 'bus',
  hogar: 'casa',
  servicios: 'rayo',
  salud: 'corazon',
  ocio: 'juego',
  compras: 'bolsa',
  educacion: 'birrete',
  suscripciones: 'repetir',
  otros: 'etiqueta',
  salario: 'maletin',
  extra: 'reloj',
  ventas: 'tienda',
  regalo: 'regalo',
  reembolso: 'retorno',
  otros_ingresos: 'monedas',
}
export const ACCOUNT_KINDS = ['efectivo', 'debito', 'credito', 'ahorro'] as const
export const ACCOUNT_KIND_LABEL: Record<(typeof ACCOUNT_KINDS)[number], string> = {
  efectivo: 'Efectivo',
  debito: 'Débito',
  credito: 'Tarjeta de crédito',
  ahorro: 'Ahorro',
}
export const ACCOUNT_KIND_ICON: Record<(typeof ACCOUNT_KINDS)[number], FinIconName> = {
  efectivo: 'billete',
  debito: 'tarjeta',
  credito: 'tarjeta',
  ahorro: 'alcancia',
}
export const CYCLES = ['semanal', 'mensual', 'anual'] as const
export const CYCLE_LABEL: Record<(typeof CYCLES)[number], string> = { semanal: 'Cada semana', mensual: 'Cada mes', anual: 'Cada año' }

/** Pending untimed tasks older than this are left where they are instead of being carried. */
export const CARRY_DAYS = 14

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
  carryOver: true,
  focusMinutes: 25,
  currency: 'COP',
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

export const MOOD_LABEL: Record<(typeof MOODS)[number], string> = {
  1: 'Muy mal',
  2: 'Mal',
  3: 'Normal',
  4: 'Bien',
  5: 'Muy bien',
}

export const ENERGY_LABEL: Record<Energy, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
}

/** One question per day, chosen from the date so every device asks the same one. */
export const JOURNAL_PROMPTS = [
  '¿Qué aprendiste hoy?',
  '¿Qué te dio energía hoy?',
  '¿Qué harías distinto si repitieras el día?',
  '¿De qué te sientes orgulloso hoy?',
  '¿Qué te preocupa y qué puedes hacer al respecto?',
  '¿A quién te gustaría agradecer algo?',
  '¿Qué pequeño avance hiciste hoy?',
  '¿Qué te hizo reír o sonreír?',
  '¿Qué quieres que salga bien mañana?',
  '¿En qué perdiste tiempo y cómo lo evitarías?',
  '¿Qué decisión tomaste hoy y por qué?',
  '¿Qué hábito te costó más hoy?',
  '¿Qué momento del día quieres recordar?',
  '¿Qué necesitas soltar esta noche?',
] as const

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
  yearly: 'Cada año',
}

/** Public web app. E-mail confirmations and password resets land here, also for desktop users. */
export const WEB_APP_URL = 'https://simonbedoyamontiel.github.io/mi-semana-app/'
/** Desktop OAuth callback, registered as a Windows protocol by the installer. */
export const DESKTOP_AUTH_CALLBACK = 'misemana://auth-callback'
