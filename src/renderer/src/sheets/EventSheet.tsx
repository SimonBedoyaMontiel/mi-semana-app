import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { CalendarEvent, Category, Repeat } from '@shared/model'
import { CATEGORIES, CATEGORY_LABEL, REMINDER_CHOICES, REPEAT_FREQS, REPEAT_LABEL } from '@shared/constants'
import type { EventItem } from '@shared/events'
import { DAYS, DAYS_LETTER, fmtDuration, fromIso, fromMin, longDate, toMin, todayIso, weekday } from '@shared/dates'
import type { EventPreset } from '@/state/store'
import { rawEvent, useStore } from '@/state/store'
import { deleteEvent, saveEvent } from '@/state/actions'
import type { Scope } from '@/state/actions'
import { newId } from '@/lib/fx'
import { Sheet } from '@/components/Sheet'
import { Chip, Segmented } from '@/components/primitives'
import { TimeField } from '@/components/TimeField'

const DURATIONS = [15, 30, 45, 60, 90, 120, 180]
const LAST = 23 * 60 + 59
type Freq = 'none' | Repeat['freq']
const UNIT: Record<Repeat['freq'], [string, string]> = { daily: ['día', 'días'], weekly: ['semana', 'semanas'], monthly: ['mes', 'meses'] }

function defaultStart(date: string): string {
  if (date !== todayIso()) return '09:00'
  const n = new Date()
  return fromMin(Math.min(23 * 60, Math.ceil((n.getHours() * 60 + n.getMinutes() + 1) / 30) * 30))
}

function repeatSummary(freq: Freq, interval: number, days: number[], until: string, date: string): string {
  if (freq === 'none') return ''
  const [one, many] = UNIT[freq]
  let s = interval === 1 ? `Cada ${one}` : `Cada ${interval} ${many}`
  if (freq === 'weekly') s += `, ${days.length === 7 ? 'todos los días' : days.map(d => DAYS[d]!.toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' y $1')}`
  if (freq === 'monthly') s += `, el día ${fromIso(date).getDate()}`
  return until ? `${s}, hasta el ${longDate(until)}.` : `${s}, sin fecha de fin.`
}

export function EventSheet({ event, preset }: { event?: EventItem; preset?: EventPreset }) {
  const close = useStore(s => s.closeSheet)
  const lastCat = useStore(s => s.lastCat)
  const eventLead = useStore(s => s.data!.settings.eventLeadMinutes)
  const desktop = window.api.platform === 'desktop'
  const series = event?.seriesId ? rawEvent(event.seriesId) : undefined
  const isOccurrence = !!series
  const initialDate = event?.date ?? preset?.date ?? todayIso()
  const initialStart = event ? event.start : (preset?.start ?? defaultStart(initialDate))
  const rep = (series ?? event)?.repeat

  const [text, setText] = useState(event?.text ?? preset?.text ?? '')
  const [date, setDate] = useState(initialDate)
  const [timed, setTimed] = useState(event ? !!event.start : true)
  const [start, setStart] = useState(initialStart || defaultStart(initialDate))
  const [end, setEnd] = useState(event?.end || preset?.end || fromMin(Math.min(toMin(initialStart || '09:00') + 60, LAST)))
  const [cat, setCat] = useState<Category>(event?.cat ?? lastCat)
  const [remind, setRemind] = useState<number | undefined>(event?.remind)
  const [scope, setScope] = useState<Scope>('one')
  const [freq, setFreq] = useState<Freq>(rep?.freq ?? 'none')
  const [interval, setInterval_] = useState(rep?.interval ?? 1)
  const [days, setDays] = useState<number[]>(rep?.days ?? [weekday(fromIso(initialDate))])
  const [until, setUntil] = useState(rep?.until ?? '')
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(0)

  const duration = useMemo(() => (start && end ? toMin(end) - toMin(start) : 0), [start, end])
  /** Repetition is edited on the series; a single date of it can't start its own series. */
  const showRepeat = !isOccurrence || scope === 'all'

  const changeStart = (v: string): void => {
    setStart(v)
    if (v && duration > 0) setEnd(fromMin(Math.min(toMin(v) + duration, LAST)))
    setError(null)
  }

  const fail = (msg: string): void => {
    setError(msg)
    setShake(s => s + 1)
  }

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    if (!text.trim()) return fail('Escribe qué vas a hacer.')
    if (timed && (!start || !end || end <= start)) return fail('La hora de fin tiene que ser después de la de inicio.')
    if (showRepeat && freq === 'weekly' && !days.length) return fail('Elige al menos un día de la semana.')
    if (showRepeat && freq !== 'none' && until && until < (isOccurrence ? series!.date : date)) return fail('La fecha de fin de la repetición es anterior al primer día.')

    const repeat: Repeat | undefined = showRepeat && freq !== 'none'
      ? { freq, interval, ...(freq === 'weekly' ? { days: [...days].sort() } : {}), ...(until ? { until } : {}) }
      : undefined
    const base = series ?? event
    const next: CalendarEvent = {
      id: base?.id ?? newId(),
      date,
      start: timed ? start : '',
      end: timed ? end : '',
      text: text.trim(),
      cat,
      done: isOccurrence ? false : (event?.done ?? false),
      createdAt: base?.createdAt ?? Date.now(),
      ...(remind === undefined ? {} : { remind }),
      ...(repeat ? { repeat, exceptions: base?.exceptions, doneDates: base?.doneDates } : {}),
    }
    saveEvent(next, event, scope)
    close()
  }

  return (
    <Sheet
      title={event ? 'Editar evento' : 'Nuevo evento'}
      onClose={close}
      footer={
        <>
          {event && (
            <button type="button" className="btn ghost danger" onClick={() => { deleteEvent(event, scope); close() }}>
              {isOccurrence && scope === 'one' ? 'Quitar este día' : isOccurrence ? 'Borrar la serie' : 'Borrar'}
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={close}>Cancelar</button>
          <button type="submit" form="event-form" className="btn primary">Guardar</button>
        </>
      }
    >
      <motion.form id="event-form" className="form" onSubmit={submit} key={shake} animate={shake ? { x: [0, -8, 8, -5, 5, 0] } : undefined} transition={{ duration: 0.35 }}>
        {isOccurrence && (
          <div className="scope">
            <span>Este evento se repite. ¿Qué quieres cambiar?</span>
            <Segmented
              label="Aplicar a"
              layoutId="ev-scope"
              size="s"
              value={scope}
              onChange={setScope}
              options={[{ value: 'one', label: 'Solo este día' }, { value: 'all', label: 'Toda la serie' }]}
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
        <div className="row">
          <label className="field">
            <span>{isOccurrence && scope === 'all' ? 'Día (de esta vez)' : 'Día'}</span>
            <input type="date" value={date} disabled={isOccurrence && scope === 'all'} onChange={e => e.target.value && setDate(e.target.value)} />
          </label>
          <div className="field">
            <span>Horario</span>
            <Segmented
              label="Horario"
              layoutId="ev-mode"
              size="s"
              value={timed ? 'timed' : 'free'}
              onChange={v => setTimed(v === 'timed')}
              options={[{ value: 'timed', label: 'Con hora' }, { value: 'free', label: 'Sin hora' }]}
            />
          </div>
        </div>
        <AnimatePresence initial={false}>
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
                  {REPEAT_FREQS.map(f => <Chip key={f} active={freq === f} onClick={() => setFreq(f)}>{REPEAT_LABEL[f]}</Chip>)}
                </div>
              </div>
              <AnimatePresence initial={false}>
                {freq !== 'none' && (
                  <motion.div className="repeat-detail" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                    <div className="row">
                      <div className="field">
                        <span>Cada</span>
                        <div className="stepper">
                          <motion.button type="button" className="mini" whileTap={{ scale: 0.85 }} onClick={() => setInterval_(n => Math.max(1, n - 1))} aria-label="Menos">−</motion.button>
                          <span className="stepper-val">
                            <AnimatePresence mode="popLayout" initial={false}>
                              <motion.b key={interval} initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }}>{interval}</motion.b>
                            </AnimatePresence>
                          </span>
                          <motion.button type="button" className="mini" whileTap={{ scale: 0.85 }} onClick={() => setInterval_(n => Math.min(30, n + 1))} aria-label="Más">+</motion.button>
                          <span className="unit-label">{UNIT[freq][interval === 1 ? 0 : 1]}</span>
                        </div>
                      </div>
                      <label className="field">
                        <span>Hasta (opcional)</span>
                        <input type="date" value={until} min={date} onChange={e => setUntil(e.target.value)} />
                      </label>
                    </div>
                    {freq === 'weekly' && (
                      <div className="chips">
                        {DAYS_LETTER.map((d, i) => (
                          <Chip key={i} className="chip-day" active={days.includes(i)} aria-label={DAYS[i]} onClick={() => setDays(ds => (ds.includes(i) ? ds.filter(x => x !== i) : [...ds, i]))}>{d}</Chip>
                        ))}
                      </div>
                    )}
                    <p className="hint">{repeatSummary(freq, interval, [...days].sort(), until, isOccurrence ? series!.date : date)}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="field">
          <span>Categoría</span>
          <div className="chips">
            {CATEGORIES.map(c => (
              <Chip key={c} active={cat === c} color={`var(--cat-${c})`} onClick={() => setCat(c)}>{CATEGORY_LABEL[c]}</Chip>
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
