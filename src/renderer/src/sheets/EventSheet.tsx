import { useMemo, useRef, useState } from 'react'
import type { CSSProperties, FormEvent, KeyboardEvent, ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { CalendarEvent, Category, Ink, Priority, Repeat, Subtask, Template } from '@shared/model'
import { CATEGORIES, CATEGORY_LABEL, INKS, INK_LABEL, PRIORITIES, PRIORITY_LABEL, REMINDER_CHOICES } from '@shared/constants'
import type { EventItem } from '@shared/events'
import { evColor, meetingService, weekdayPos } from '@shared/events'
import { DAYS, DAYS_LETTER, MONTHS, addDays, fmtDuration, fromIso, fromMin, longDate, toIso, toMin, todayIso, weekday } from '@shared/dates'
import type { EventPreset } from '@/state/store'
import { rawEvent, useStore } from '@/state/store'
import { deleteEvent, saveEvent } from '@/state/actions'
import type { Scope } from '@/state/actions'
import { newId } from '@/lib/fx'
import { Sheet } from '@/components/Sheet'
import { Check, Chip, Icon, PriorityMark, Segmented, cx } from '@/components/primitives'
import { TimeField } from '@/components/TimeField'
import { EvIcon, JoinButton, mapsUrl, openLink } from '@/components/EventBits'

const DURATIONS = [15, 30, 45, 60, 90, 120, 180]
const LAST = 23 * 60 + 59
/** `days` is "on these weekdays": stored as weekly with an interval of one. */
type Freq = 'none' | 'daily' | 'days' | 'weekly' | 'monthly' | 'yearly'
const FREQ_LABEL: Record<Exclude<Freq, 'none'>, string> = { daily: 'Cada día', days: 'Días concretos', weekly: 'Cada semana', monthly: 'Cada mes', yearly: 'Cada año' }
const UNIT: Record<Repeat['freq'], [string, string]> = { daily: ['día', 'días'], weekly: ['semana', 'semanas'], monthly: ['mes', 'meses'], yearly: ['año', 'años'] }
const ORDINAL = ['primer', 'segundo', 'tercer', 'cuarto', 'quinto']
const WEEKDAYS = [0, 1, 2, 3, 4]
const WEEKEND = [5, 6]
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
const same = (a: number[], b: number[]): boolean => a.length === b.length && a.every(x => b.includes(x))
type Mode = 'timed' | 'free' | 'multi'
type MonthBy = 'day' | 'nth' | 'last'
type Ends = 'never' | 'date' | 'count'
type Detail = 'link' | 'location' | 'guests' | 'notes' | 'tasks'

function freqOf(rep: Repeat | undefined): Freq {
  if (!rep) return 'none'
  if (rep.freq === 'weekly' && rep.interval === 1 && (rep.days?.length ?? 1) > 1) return 'days'
  return rep.freq
}

function daysPhrase(days: number[]): string {
  if (same(days, ALL_DAYS)) return 'Todos los días'
  if (same(days, WEEKDAYS)) return 'De lunes a viernes'
  if (same(days, WEEKEND)) return 'Los fines de semana'
  return `Los ${days.map(d => DAYS[d]!.toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' y $1')}`
}

function defaultStart(date: string): string {
  if (date !== todayIso()) return '09:00'
  const n = new Date()
  return fromMin(Math.min(23 * 60, Math.ceil((n.getHours() * 60 + n.getMinutes() + 1) / 30) * 30))
}

/** "el día 15", "el segundo martes", "el último viernes". */
function monthPhrase(by: MonthBy, anchor: string): string {
  const d = fromIso(anchor)
  if (by === 'day') return `el día ${d.getDate()}`
  const day = DAYS[weekday(d)]!.toLowerCase()
  return by === 'last' ? `el último ${day}` : `el ${ORDINAL[weekdayPos(anchor).nth - 1]} ${day}`
}

function repeatSummary(freq: Freq, interval: number, days: number[], ends: Ends, until: string, count: number, anchor: string, monthBy: MonthBy): string {
  if (freq === 'none') return ''
  const end = ends === 'date' && until ? `hasta el ${longDate(until)}.` : ends === 'count' ? `${count} ${count === 1 ? 'vez' : 'veces'} en total.` : 'sin fecha de fin.'
  if (freq === 'days') return `${daysPhrase(days)}, ${end}`
  const [one, many] = UNIT[freq]
  let s = interval === 1 ? `Cada ${one}` : `Cada ${interval} ${many}`
  if (freq === 'weekly') s += `, ${days.length === 7 ? 'todos los días' : days.map(d => DAYS[d]!.toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' y $1')}`
  if (freq === 'monthly') s += `, ${monthPhrase(monthBy, anchor)}`
  if (freq === 'yearly') s += `, el ${fromIso(anchor).getDate()} de ${MONTHS[fromIso(anchor).getMonth()]}`
  return `${s}, ${end}`
}

/** Accepts "meet.google.com/abc" as well as full addresses. */
function normalizeLink(raw: string): string | null {
  const v = raw.trim()
  if (!v) return null
  const url = /^https?:\/\//i.test(v) ? v : `https://${v}`
  try {
    const u = new URL(url)
    return u.hostname.includes('.') ? u.toString() : null
  } catch {
    return null
  }
}

export function EventSheet({ event, preset }: { event?: EventItem; preset?: EventPreset }) {
  const close = useStore(s => s.closeSheet)
  const openSheet = useStore(s => s.openSheet)
  const dispatch = useStore(s => s.dispatch)
  const notify = useStore(s => s.notify)
  const lastCat = useStore(s => s.lastCat)
  const templates = useStore(s => s.data!.templates)
  const eventLead = useStore(s => s.data!.settings.eventLeadMinutes)
  const desktop = window.api.platform === 'desktop'
  const series = event?.seriesId ? rawEvent(event.seriesId) : undefined
  const whole = event?.spanOf ? rawEvent(event.spanOf) : undefined
  const isOccurrence = !!series
  /** Where the fields come from: the series, the whole long event, the event itself, or a copy. */
  const src: Partial<CalendarEvent> | undefined = series ?? whole ?? event ?? preset?.copy
  const initialDate = whole?.date ?? event?.date ?? preset?.date ?? todayIso()
  const initialStart = src?.start !== undefined ? src.start : (preset?.start ?? defaultStart(initialDate))
  const rep = src?.repeat

  const [text, setText] = useState(src?.text ?? preset?.text ?? '')
  const [date, setDate] = useState(initialDate)
  const [mode, setMode] = useState<Mode>(whole?.endDate || preset?.copy?.endDate ? 'multi' : src ? (src.start ? 'timed' : 'free') : 'timed')
  const [endDate, setEndDate] = useState(whole?.endDate ?? preset?.copy?.endDate ?? toIso(addDays(fromIso(initialDate), 2)))
  const [start, setStart] = useState(initialStart || defaultStart(initialDate))
  const [end, setEnd] = useState(src?.end || preset?.end || fromMin(Math.min(toMin(initialStart || '09:00') + 60, LAST)))
  const [cat, setCat] = useState<Category>(src?.cat ?? lastCat)
  const [color, setColor] = useState<Ink | undefined>(src?.color)
  const [priority, setPriority] = useState<Priority | undefined>(src?.priority)
  const [remind, setRemind] = useState<number | undefined>(src?.remind)
  const [scope, setScope] = useState<Scope>('one')
  const [freq, setFreq] = useState<Freq>(freqOf(rep))
  const [interval, setInterval_] = useState(rep?.interval ?? 1)
  const [days, setDays] = useState<number[]>(rep?.days ?? [weekday(fromIso(initialDate))])
  const [monthBy, setMonthBy] = useState<MonthBy>(rep?.pos === -1 ? 'last' : rep?.pos ? 'nth' : 'day')
  const [ends, setEnds] = useState<Ends>(rep?.count ? 'count' : rep?.until ? 'date' : 'never')
  const [until, setUntil] = useState(rep?.until ?? '')
  const [count, setCount] = useState(rep?.count ?? 10)
  const [link, setLink] = useState(src?.link ?? '')
  const [location, setLocation] = useState(src?.location ?? '')
  const [notes, setNotes] = useState(src?.notes ?? '')
  const [tasks, setTasks] = useState<Subtask[]>(src?.tasks ?? [])
  const [guests, setGuests] = useState<string[]>(src?.guests ?? [])
  const [shown, setShown] = useState<Set<Detail>>(() => new Set<Detail>([
    ...(src?.link ? ['link' as const] : []), ...(src?.location ? ['location' as const] : []), ...(src?.guests?.length ? ['guests' as const] : []),
    ...(src?.notes ? ['notes' as const] : []), ...(src?.tasks?.length ? ['tasks' as const] : []),
  ]))
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(0)

  const timed = mode === 'timed'
  const duration = useMemo(() => (start && end ? toMin(end) - toMin(start) : 0), [start, end])
  /** Repetition is edited on the series; a single date of it can't start its own series. */
  const showRepeat = mode !== 'multi' && (!isOccurrence || scope !== 'one')
  /** The date the rule is measured from. */
  const anchor = isOccurrence && scope === 'all' ? series!.date : date
  const pos = weekdayPos(anchor)

  const changeStart = (v: string): void => {
    setStart(v)
    if (v && duration > 0) setEnd(fromMin(Math.min(toMin(v) + duration, LAST)))
    setError(null)
  }

  const fail = (msg: string): void => {
    setError(msg)
    setShake(s => s + 1)
  }

  /** The detail just added by hand gets the cursor. */
  const [focusOn, setFocusOn] = useState<Detail | null>(null)
  const show = (d: Detail): void => {
    setShown(s => new Set(s).add(d))
    setFocusOn(d)
  }

  /** Details as stored: empty ones are left out. */
  const details = (): Pick<CalendarEvent, 'link' | 'location' | 'notes' | 'tasks' | 'guests'> | null => {
    const url = normalizeLink(link)
    if (link.trim() && !url) return null
    const steps = tasks.filter(t => t.text.trim()).map(t => ({ ...t, text: t.text.trim() }))
    return {
      ...(url ? { link: url } : {}),
      ...(location.trim() ? { location: location.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(steps.length ? { tasks: steps } : {}),
      ...(guests.length ? { guests } : {}),
    }
  }

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    if (!text.trim()) return fail('Escribe qué vas a hacer.')
    if (timed && (!start || !end || end <= start)) return fail('La hora de fin tiene que ser después de la de inicio.')
    if (mode === 'multi' && endDate <= date) return fail('El último día tiene que ser después del primero.')
    if (showRepeat && (freq === 'weekly' || freq === 'days') && !days.length) return fail('Elige al menos un día de la semana.')
    if (showRepeat && freq !== 'none' && ends === 'date' && until && until < anchor) return fail('La fecha de fin de la repetición es anterior al primer día.')
    const extra = details()
    if (!extra) return fail('El enlace no parece una dirección web. Pega el enlace completo de la reunión.')

    const endRule = ends === 'date' && until ? { until } : ends === 'count' ? { count } : {}
    const repeat: Repeat | undefined = showRepeat && freq !== 'none'
      ? freq === 'days'
        ? { freq: 'weekly', interval: 1, days: [...days].sort(), ...endRule }
        : {
            freq, interval, ...endRule,
            ...(freq === 'weekly' ? { days: [...days].sort() } : {}),
            ...(freq === 'monthly' && monthBy !== 'day' ? { pos: monthBy === 'last' ? -1 : Math.min(4, pos.nth) } : {}),
          }
      : undefined
    const base = series ?? whole ?? event
    const next: CalendarEvent = {
      id: base?.id ?? newId(),
      date,
      start: timed ? start : '',
      end: timed ? end : '',
      text: text.trim(),
      cat,
      ...(color ? { color } : {}),
      ...(priority ? { priority } : {}),
      done: isOccurrence ? false : (base?.done ?? false),
      createdAt: base?.createdAt ?? Date.now(),
      ...(remind === undefined ? {} : { remind }),
      ...(mode === 'multi' ? { endDate } : {}),
      ...extra,
      ...(repeat ? { repeat, exceptions: base?.exceptions, doneDates: base?.doneDates } : {}),
    }
    saveEvent(next, whole ?? event, scope)
    if (preset?.inboxId) useStore.getState().dispatch({ type: 'inbox.delete', id: preset.inboxId })
    close()
  }

  /** The form as a reusable template (no date). */
  const asTemplate = (): Template | null => {
    if (!text.trim()) {
      fail('Escribe un título para guardar la plantilla.')
      return null
    }
    const extra = details()
    if (!extra) {
      fail('El enlace no parece una dirección web.')
      return null
    }
    return {
      id: newId(), text: text.trim(), cat, createdAt: Date.now(),
      startMin: timed ? toMin(start) : 0, minutes: timed ? Math.max(0, duration) : 0,
      ...(color ? { color } : {}), ...(priority ? { priority } : {}), ...(remind === undefined ? {} : { remind }), ...extra,
    }
  }

  const applyTemplate = (t: Template): void => {
    setText(t.text)
    setCat(t.cat)
    setColor(t.color)
    setPriority(t.priority)
    setRemind(t.remind)
    if (t.minutes) {
      setMode('timed')
      setStart(fromMin(t.startMin))
      setEnd(fromMin(Math.min(t.startMin + t.minutes, LAST)))
    } else setMode('free')
    setLink(t.link ?? '')
    setLocation(t.location ?? '')
    setNotes(t.notes ?? '')
    setTasks((t.tasks ?? []).map(s => ({ ...s, id: newId(), done: false })))
    setGuests(t.guests ?? [])
    setShown(new Set<Detail>([
      ...(t.link ? ['link' as const] : []), ...(t.location ? ['location' as const] : []), ...(t.guests?.length ? ['guests' as const] : []),
      ...(t.notes ? ['notes' as const] : []), ...(t.tasks?.length ? ['tasks' as const] : []),
    ]))
    setError(null)
  }

  const saveTemplate = (): void => {
    const t = asTemplate()
    if (!t) return
    dispatch({ type: 'template.upsert', item: t })
    notify(`Plantilla guardada: ${t.text}`)
  }

  const duplicate = (): void => {
    const extra = details() ?? {}
    const copy: Partial<CalendarEvent> = {
      text: text.trim(), start: timed ? start : '', end: timed ? end : '', cat, color, priority, remind, ...extra,
      tasks: extra.tasks?.map(t => ({ ...t, id: newId(), done: false })),
      ...(mode === 'multi' ? { endDate } : {}),
    }
    close()
    // Let this sheet leave before the copy opens.
    window.setTimeout(() => openSheet({ kind: 'event', preset: { date, copy } }), 260)
  }

  const deleteLabel = isOccurrence ? (scope === 'one' ? 'Quitar este día' : scope === 'future' ? 'Borrar desde aquí' : 'Borrar la serie') : 'Borrar'

  return (
    <Sheet
      title={event ? 'Editar evento' : preset?.copy ? 'Copia del evento' : 'Nuevo evento'}
      onClose={close}
      footer={
        <>
          {event && (
            <button type="button" className="btn ghost danger" onClick={() => { deleteEvent(event, scope); close() }}>{deleteLabel}</button>
          )}
          <span className="spacer" />
          {event && <button type="button" className="icon-btn ev-foot-btn" title="Duplicar" aria-label="Duplicar" onClick={duplicate}>{EvIcon.copy}</button>}
          <button type="button" className="icon-btn ev-foot-btn" title="Guardar como plantilla" aria-label="Guardar como plantilla" onClick={saveTemplate}>{EvIcon.bookmark}</button>
          <button type="button" className="btn ghost" onClick={close}>Cancelar</button>
          <button type="submit" form="event-form" className="btn primary">Guardar</button>
        </>
      }
    >
      <motion.form id="event-form" className="form" style={{ '--c': evColor({ cat, color }) } as CSSProperties} onSubmit={submit} key={shake} animate={shake ? { x: [0, -8, 8, -5, 5, 0] } : undefined} transition={{ duration: 0.35 }}>
        {!event && templates.length > 0 && (
          <div className="tpl-row">
            <span>{EvIcon.bookmark}Plantillas</span>
            <div className="chips">
              <AnimatePresence initial={false}>
                {templates.map(t => (
                  <motion.span key={t.id} className="tpl-chip" style={{ '--c': evColor(t) } as CSSProperties} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                    <button type="button" onClick={() => applyTemplate(t)} title={t.minutes ? `${fromMin(t.startMin)} · ${fmtDuration(t.minutes)}` : 'Sin hora'}><i />{t.text}</button>
                    <button
                      type="button"
                      className="tpl-x"
                      aria-label={`Borrar la plantilla ${t.text}`}
                      onClick={() => {
                        dispatch({ type: 'template.delete', id: t.id })
                        notify(`Plantilla borrada: ${t.text}`, () => dispatch({ type: 'template.upsert', item: t }))
                      }}
                    >
                      {Icon.close}
                    </button>
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
        {isOccurrence && (
          <div className="scope">
            <span>Este evento se repite. ¿Qué quieres cambiar?</span>
            <Segmented
              label="Aplicar a"
              layoutId="ev-scope"
              size="s"
              value={scope}
              onChange={setScope}
              options={[
                { value: 'one', label: 'Solo este' },
                ...(event!.occurrence! > series!.date ? [{ value: 'future' as const, label: 'Este y los siguientes' }] : []),
                { value: 'all', label: 'Todos' },
              ]}
            />
          </div>
        )}
        <input
          data-autofocus
          className="title-input"
          placeholder="¿Qué vas a hacer?"
          value={text}
          maxLength={200}
          onChange={e => { setText(e.target.value); setError(null) }}
          aria-label="Título"
        />
        <div className="row row-when">
          <label className="field">
            <span>{isOccurrence && scope === 'all' ? 'Día (de esta vez)' : isOccurrence && scope === 'future' ? 'Desde' : mode === 'multi' ? 'Primer día' : 'Día'}</span>
            <input type="date" value={date} disabled={isOccurrence && scope !== 'one'} onChange={e => e.target.value && setDate(e.target.value)} />
          </label>
          <div className="field">
            <span>Horario</span>
            <Segmented
              label="Horario"
              layoutId="ev-mode"
              size="s"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'timed', label: 'Con hora' },
                { value: 'free', label: 'Sin hora' },
                ...(isOccurrence ? [] : [{ value: 'multi' as const, label: 'Varios días' }]),
              ]}
            />
          </div>
        </div>
        <AnimatePresence initial={false}>
          {mode === 'multi' && (
            <motion.div className="timed" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 32 }}>
              <div className="row">
                <label className="field">
                  <span>Último día</span>
                  <input type="date" value={endDate} min={toIso(addDays(fromIso(date), 1))} onChange={e => { if (e.target.value) setEndDate(e.target.value); setError(null) }} />
                </label>
                <div className="field">
                  <span>Duración</span>
                  <p className="span-len">{endDate > date ? `${Math.round((fromIso(endDate).getTime() - fromIso(date).getTime()) / 864e5) + 1} días` : '—'}</p>
                </div>
              </div>
              <p className="hint">Para viajes, vacaciones o eventos que ocupan el día entero varios días seguidos.</p>
            </motion.div>
          )}
          {timed && (
            <motion.div className="timed" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 32 }}>
              <div className="row">
                <div className="field"><label htmlFor="ev-start">Empieza</label><TimeField id="ev-start" value={start} onChange={changeStart} /></div>
                <div className="field"><label htmlFor="ev-end">Termina</label><TimeField id="ev-end" value={end} onChange={v => { setEnd(v); setError(null) }} invalid={!!start && !!end && end <= start} /></div>
              </div>
              <div className="field">
                <span>Duración</span>
                <div className="chips">
                  {DURATIONS.map(m => (
                    <Chip key={m} active={duration === m} onClick={() => { const s = start || defaultStart(date); setStart(s); setEnd(fromMin(Math.min(toMin(s) + m, LAST))); setError(null) }}>
                      {fmtDuration(m).replace(' min', 'm').replace(' h', 'h').replace(' ', '')}
                    </Chip>
                  ))}
                </div>
                {duration > 0 && <p className="hint">De {start} a {end} · {fmtDuration(duration)}.{desktop && ' También puedes ajustarla con la rueda del ratón o las flechas del teclado.'}</p>}
              </div>
              {desktop && <label className="field">
                <span>Aviso</span>
                <select value={remind ?? 'default'} onChange={e => setRemind(e.target.value === 'default' ? undefined : Number(e.target.value))}>
                  <option value="default">Predeterminado ({eventLead ? `${eventLead} min antes` : 'al empezar'})</option>
                  {REMINDER_CHOICES.map(m => (
                    <option key={m} value={m}>{m < 0 ? 'Sin aviso' : m === 0 ? 'Al empezar' : `${fmtDuration(m)} antes`}</option>
                  ))}
                </select>
              </label>}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {showRepeat && (
            <motion.div className="repeat" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 32 }}>
              <div className="field">
                <span>Repetir</span>
                <div className="chips">
                  <Chip active={freq === 'none'} onClick={() => setFreq('none')}>No se repite</Chip>
                  {(Object.keys(FREQ_LABEL) as Array<Exclude<Freq, 'none'>>).map(f => (
                    <Chip
                      key={f}
                      active={freq === f}
                      onClick={() => {
                        setFreq(f)
                        if (f === 'days' && days.length < 2) setDays(WEEKDAYS)
                      }}
                    >
                      {freq === f && Icon.repeat}{FREQ_LABEL[f]}
                    </Chip>
                  ))}
                </div>
              </div>
              <AnimatePresence initial={false}>
                {freq !== 'none' && (
                  <motion.div className="repeat-detail" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                    {freq === 'days' && (
                      <div className="field">
                        <span>Qué días</span>
                        <DayPicker days={days} onChange={setDays} />
                        <div className="chips presets">
                          <Chip active={same(days, WEEKDAYS)} onClick={() => setDays(WEEKDAYS)}>Entre semana</Chip>
                          <Chip active={same(days, WEEKEND)} onClick={() => setDays(WEEKEND)}>Fin de semana</Chip>
                          <Chip active={same(days, ALL_DAYS)} onClick={() => setDays(ALL_DAYS)}>Todos</Chip>
                        </div>
                      </div>
                    )}
                    {freq !== 'days' && (
                      <div className="field">
                        <span>Cada</span>
                        <Stepper value={interval} min={1} max={30} onChange={setInterval_} unit={UNIT[freq][interval === 1 ? 0 : 1]} />
                      </div>
                    )}
                    {freq === 'weekly' && <DayPicker days={days} onChange={setDays} />}
                    {freq === 'monthly' && (
                      <div className="field">
                        <span>Qué día del mes</span>
                        <div className="chips">
                          <Chip active={monthBy === 'day'} onClick={() => setMonthBy('day')}>{capital(monthPhrase('day', anchor))}</Chip>
                          {pos.nth <= 4 && <Chip active={monthBy === 'nth'} onClick={() => setMonthBy('nth')}>{capital(monthPhrase('nth', anchor))}</Chip>}
                          {pos.last && <Chip active={monthBy === 'last'} onClick={() => setMonthBy('last')}>{capital(monthPhrase('last', anchor))}</Chip>}
                        </div>
                      </div>
                    )}
                    <div className="field">
                      <span>Termina</span>
                      <Segmented
                        label="Termina"
                        layoutId="ev-ends"
                        size="s"
                        value={ends}
                        onChange={v => { setEnds(v); setError(null) }}
                        options={[{ value: 'never', label: 'Nunca' }, { value: 'date', label: 'En una fecha' }, { value: 'count', label: 'Tras varias veces' }]}
                      />
                      <AnimatePresence mode="wait" initial={false}>
                        {ends === 'date' && (
                          <motion.input key="until" type="date" className="ends-input" value={until} min={anchor} onChange={e => setUntil(e.target.value)} aria-label="Último día" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} />
                        )}
                        {ends === 'count' && (
                          <motion.div key="count" className="ends-input" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                            <Stepper value={count} min={1} max={999} onChange={setCount} unit={count === 1 ? 'vez' : 'veces'} editable />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <p className="hint">{repeatSummary(freq, interval, [...days].sort(), ends, until, count, anchor, monthBy)}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="details">
          <AnimatePresence initial={false}>
            {shown.has('link') && (
              <DetailRow key="link" icon={EvIcon.video} label="Enlace de reunión">
                <div className="link-field">
                  <input
                    type="url"
                    inputMode="url"
                    value={link}
                    placeholder="Pega el enlace de Meet, Zoom o Teams"
                    onChange={e => { setLink(e.target.value); setError(null) }}
                    autoFocus={focusOn === 'link'}
                  />
                  <AnimatePresence>
                    {normalizeLink(link) && (
                      <motion.span className="link-actions" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                        {meetingService(normalizeLink(link)!) && <em className="svc">{meetingService(normalizeLink(link)!)}</em>}
                        <JoinButton url={normalizeLink(link)!} size="s" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </DetailRow>
            )}
            {shown.has('location') && (
              <DetailRow key="location" icon={EvIcon.pin} label="Lugar">
                <div className="link-field">
                  <input value={location} maxLength={200} placeholder="Dirección o sitio, ej. Oficina, piso 4" onChange={e => setLocation(e.target.value)} autoFocus={focusOn === 'location'} />
                  {location.trim() && (
                    <button type="button" className="join-btn is-s" onClick={() => openLink(mapsUrl(location.trim()))} title="Ver en Google Maps">{EvIcon.map}<span>Mapa</span></button>
                  )}
                </div>
              </DetailRow>
            )}
            {shown.has('guests') && (
              <DetailRow key="guests" icon={EvIcon.people} label="Invitados">
                <GuestInput guests={guests} onChange={setGuests} autoFocus={focusOn === 'guests'} />
              </DetailRow>
            )}
            {shown.has('notes') && (
              <DetailRow key="notes" icon={EvIcon.notes} label="Descripción">
                <textarea className="ev-notes" value={notes} maxLength={5000} rows={Math.min(10, Math.max(3, notes.split('\n').length + 1))} placeholder="Agenda, ideas, lo que necesites recordar…" onChange={e => setNotes(e.target.value)} autoFocus={focusOn === 'notes'} />
              </DetailRow>
            )}
            {shown.has('tasks') && (
              <DetailRow key="tasks" icon={EvIcon.list} label={tasks.length ? `Subtareas · ${tasks.filter(t => t.done).length} de ${tasks.length}` : 'Subtareas'}>
                <Subtasks tasks={tasks} onChange={setTasks} autoFocus={focusOn === 'tasks'} />
              </DetailRow>
            )}
          </AnimatePresence>
          {shown.size < 5 && (
            <div className="detail-adds">
              {!shown.has('link') && <AddDetail icon={EvIcon.video} onClick={() => show('link')}>Enlace</AddDetail>}
              {!shown.has('location') && <AddDetail icon={EvIcon.pin} onClick={() => show('location')}>Lugar</AddDetail>}
              {!shown.has('guests') && <AddDetail icon={EvIcon.people} onClick={() => show('guests')}>Invitados</AddDetail>}
              {!shown.has('notes') && <AddDetail icon={EvIcon.notes} onClick={() => show('notes')}>Descripción</AddDetail>}
              {!shown.has('tasks') && <AddDetail icon={EvIcon.list} onClick={() => show('tasks')}>Subtareas</AddDetail>}
            </div>
          )}
        </div>

        <div className="field">
          <span>Categoría</span>
          <div className="chips">
            {CATEGORIES.map(c => (
              <Chip key={c} active={cat === c} color={`var(--cat-${c})`} onClick={() => setCat(c)}>{CATEGORY_LABEL[c]}</Chip>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Color</span>
          <div className="swatches">
            <motion.button
              type="button"
              className={cx('swatch swatch-cat', !color && 'is-active')}
              style={{ '--c': `var(--cat-${cat})` } as CSSProperties}
              aria-label="Color de la categoría"
              title="Color de la categoría"
              whileHover={{ scale: 1.14 }}
              whileTap={{ scale: 0.88 }}
              onClick={() => setColor(undefined)}
            />
            {INKS.map(k => (
              <motion.button
                key={k}
                type="button"
                className={cx('swatch', color === k && 'is-active')}
                style={{ '--c': `var(--${k})` } as CSSProperties}
                aria-label={INK_LABEL[k]}
                title={INK_LABEL[k]}
                whileHover={{ scale: 1.14 }}
                whileTap={{ scale: 0.88 }}
                onClick={() => setColor(k)}
              />
            ))}
          </div>
        </div>
        <div className="field">
          <span>Prioridad</span>
          <div className="chips">
            <Chip active={!priority} onClick={() => setPriority(undefined)}>Ninguna</Chip>
            {[...PRIORITIES].reverse().map(p => (
              <Chip key={p} className={cx('chip-prio', `is-${p}`)} active={priority === p} onClick={() => setPriority(p)}>
                <PriorityMark value={p} />{PRIORITY_LABEL[p]}
              </Chip>
            ))}
          </div>
        </div>
        <AnimatePresence>
          {error && <motion.p className="error" role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{error}</motion.p>}
        </AnimatePresence>
      </motion.form>
    </Sheet>
  )
}

const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

function Stepper({ value, min, max, onChange, unit, editable }: { value: number; min: number; max: number; onChange: (v: number) => void; unit: string; editable?: boolean }) {
  const clamp = (n: number): number => Math.max(min, Math.min(max, n))
  return (
    <div className="stepper">
      <motion.button type="button" className="mini" whileTap={{ scale: 0.85 }} onClick={() => onChange(clamp(value - 1))} aria-label="Menos">−</motion.button>
      {editable ? (
        <input className="stepper-input" inputMode="numeric" value={value} onChange={e => { const n = Number(e.target.value.replace(/\D/g, '')); if (n) onChange(clamp(n)) }} aria-label="Cuántas veces" />
      ) : (
        <span className="stepper-val">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.b key={value} initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }}>{value}</motion.b>
          </AnimatePresence>
        </span>
      )}
      <motion.button type="button" className="mini" whileTap={{ scale: 0.85 }} onClick={() => onChange(clamp(value + 1))} aria-label="Más">+</motion.button>
      <span className="unit-label">{unit}</span>
    </div>
  )
}

function AddDetail({ icon, onClick, children }: { icon: ReactNode; onClick: () => void; children: ReactNode }) {
  return (
    <motion.button type="button" className="detail-add" onClick={onClick} whileHover={{ y: -1 }} whileTap={{ scale: 0.94 }} layout>
      {Icon.plus}{icon}<span>{children}</span>
    </motion.button>
  )
}

function DetailRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <motion.div
      className="detail-row"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
    >
      <div className="detail-inner">
        <span className="detail-label">{icon}{label}</span>
        {children}
      </div>
    </motion.div>
  )
}

/** Names or e-mails as chips: Enter or a comma adds, Backspace on an empty field removes the last. */
function GuestInput({ guests, onChange, autoFocus }: { guests: string[]; onChange: (g: string[]) => void; autoFocus?: boolean }) {
  const [draft, setDraft] = useState('')
  const add = (raw: string): void => {
    const names = raw.split(/[,;\n]/).map(s => s.trim()).filter(Boolean).filter(n => !guests.includes(n))
    if (names.length) onChange([...guests, ...names].slice(0, 30))
    setDraft('')
  }
  const key = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add(draft)
    } else if (e.key === 'Backspace' && !draft && guests.length) onChange(guests.slice(0, -1))
  }
  return (
    <div className="guests">
      <AnimatePresence initial={false}>
        {guests.map(g => (
          <motion.span key={g} className="guest" layout initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}>
            <i>{g.charAt(0).toUpperCase()}</i>{g}
            <button type="button" aria-label={`Quitar a ${g}`} onClick={() => onChange(guests.filter(x => x !== g))}>{Icon.close}</button>
          </motion.span>
        ))}
      </AnimatePresence>
      <input value={draft} placeholder={guests.length ? 'Añadir otro…' : 'Nombre o correo y Enter'} maxLength={100} onChange={e => setDraft(e.target.value)} onKeyDown={key} onBlur={() => draft.trim() && add(draft)} autoFocus={autoFocus} />
    </div>
  )
}

/** Checklist, Notion style: tick, edit in place, Enter adds the next step. */
function Subtasks({ tasks, onChange, autoFocus }: { tasks: Subtask[]; onChange: (t: Subtask[]) => void; autoFocus?: boolean }) {
  const [draft, setDraft] = useState('')
  const newRef = useRef<HTMLInputElement>(null)
  const done = tasks.filter(t => t.done).length
  const add = (): void => {
    if (!draft.trim()) return
    onChange([...tasks, { id: newId(), text: draft.trim().slice(0, 200), done: false }].slice(0, 50))
    setDraft('')
  }
  return (
    <div className="subtasks">
      {tasks.length > 0 && (
        <span className="subtasks-bar"><motion.i animate={{ scaleX: tasks.length ? done / tasks.length : 0 }} transition={{ type: 'spring', stiffness: 200, damping: 24 }} /></span>
      )}
      <ul>
        <AnimatePresence initial={false}>
          {tasks.map(t => (
            <motion.li key={t.id} className={cx(t.done && 'is-done')} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12, height: 0 }}>
              <button type="button" className={cx('sub-check', t.done && 'is-on')} aria-label={t.done ? 'Marcar como pendiente' : 'Marcar como hecha'} onClick={() => onChange(tasks.map(x => (x.id === t.id ? { ...x, done: !x.done } : x)))}>
                <Check on={t.done} size={12} />
              </button>
              <input
                value={t.text}
                maxLength={200}
                onChange={e => onChange(tasks.map(x => (x.id === t.id ? { ...x, text: e.target.value } : x)))}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); newRef.current?.focus() } }}
                aria-label="Subtarea"
              />
              <button type="button" className="sub-x" aria-label={`Quitar ${t.text}`} onClick={() => onChange(tasks.filter(x => x.id !== t.id))}>{Icon.close}</button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <div className="sub-new">
        {Icon.plus}
        <input
          ref={newRef}
          value={draft}
          placeholder="Añadir un paso y Enter"
          maxLength={200}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          onBlur={add}
          autoFocus={autoFocus}
        />
      </div>
    </div>
  )
}

/** Weekday toggles; each one pops when switched on. */
function DayPicker({ days, onChange }: { days: number[]; onChange: (days: number[]) => void }) {
  return (
    <div className="chips day-picker" role="group" aria-label="Días de la semana">
      {DAYS_LETTER.map((d, i) => {
        const on = days.includes(i)
        return (
          <motion.button
            key={i}
            type="button"
            className={cx('chip chip-day', on && 'is-active')}
            aria-pressed={on}
            aria-label={DAYS[i]}
            title={DAYS[i]}
            animate={{ scale: on ? [1, 1.18, 1] : 1 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            whileTap={{ scale: 0.85 }}
            onClick={() => onChange(on ? days.filter(x => x !== i) : [...days, i])}
          >
            {d}
          </motion.button>
        )
      })}
    </div>
  )
}
