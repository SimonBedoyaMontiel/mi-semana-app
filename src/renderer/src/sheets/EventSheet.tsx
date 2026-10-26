import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { CalendarEvent, Category } from '@shared/model'
import { CATEGORIES, CATEGORY_LABEL, REMINDER_CHOICES } from '@shared/constants'
import { fmtDuration, fromMin, toMin, todayIso } from '@shared/dates'
import type { EventPreset } from '@/state/store'
import { useStore } from '@/state/store'
import { deleteEvent, saveEvent } from '@/state/actions'
import { newId } from '@/lib/fx'
import { Sheet } from '@/components/Sheet'
import { Chip, Segmented } from '@/components/primitives'
import { TimeField } from '@/components/TimeField'

const DURATIONS = [15, 30, 45, 60, 90, 120, 180]
const LAST = 23 * 60 + 59

function defaultStart(date: string): string {
  if (date !== todayIso()) return '09:00'
  const n = new Date()
  return fromMin(Math.min(23 * 60, Math.ceil((n.getHours() * 60 + n.getMinutes() + 1) / 30) * 30))
}

export function EventSheet({ event, preset }: { event?: CalendarEvent; preset?: EventPreset }) {
  const close = useStore(s => s.closeSheet)
  const lastCat = useStore(s => s.lastCat)
  const eventLead = useStore(s => s.data!.settings.eventLeadMinutes)
  const initialDate = event?.date ?? preset?.date ?? todayIso()
  const initialStart = event ? event.start : (preset?.start ?? defaultStart(initialDate))

  const [text, setText] = useState(event?.text ?? preset?.text ?? '')
  const [date, setDate] = useState(initialDate)
  const [timed, setTimed] = useState(event ? !!event.start : true)
  const [start, setStart] = useState(initialStart || defaultStart(initialDate))
  const [end, setEnd] = useState(event?.end || preset?.end || fromMin(Math.min(toMin(initialStart || '09:00') + 60, LAST)))
  const [cat, setCat] = useState<Category>(event?.cat ?? lastCat)
  const [remind, setRemind] = useState<number | undefined>(event?.remind)
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(0)

  const duration = useMemo(() => (start && end ? toMin(end) - toMin(start) : 0), [start, end])

  const changeStart = (v: string): void => {
    setStart(v)
    if (v && duration > 0) setEnd(fromMin(Math.min(toMin(v) + duration, LAST)))
    setError(null)
  }

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    if (!text.trim()) {
      setError('Escribe qué vas a hacer.')
      setShake(s => s + 1)
      return
    }
    if (timed && (!start || !end || end <= start)) {
      setError('La hora de fin tiene que ser después de la de inicio.')
      setShake(s => s + 1)
      return
    }
    saveEvent(
      {
        id: event?.id ?? newId(),
        date,
        start: timed ? start : '',
        end: timed ? end : '',
        text: text.trim(),
        cat,
        done: event?.done ?? false,
        createdAt: event?.createdAt ?? Date.now(),
        ...(remind === undefined ? {} : { remind }),
      },
      !event,
    )
    close()
  }

  return (
    <Sheet
      title={event ? 'Editar evento' : 'Nuevo evento'}
      onClose={close}
      footer={
        <>
          {event && (
            <button type="button" className="btn ghost danger" onClick={() => { deleteEvent(event); close() }}>
              Borrar
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={close}>Cancelar</button>
          <button type="submit" form="event-form" className="btn primary">Guardar</button>
        </>
      }
    >
      <motion.form id="event-form" className="form" onSubmit={submit} key={shake} animate={shake ? { x: [0, -8, 8, -5, 5, 0] } : undefined} transition={{ duration: 0.35 }}>
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
            <span>Día</span>
            <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} />
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
                {duration > 0 && <p className="hint">De {start} a {end} · {fmtDuration(duration)}. Gira la rueda del ratón o usa ↑ ↓ sobre una hora para ajustarla.</p>}
              </div>
              <label className="field">
                <span>Aviso</span>
                <select value={remind ?? 'default'} onChange={e => setRemind(e.target.value === 'default' ? undefined : Number(e.target.value))}>
                  <option value="default">Predeterminado ({eventLead ? `${eventLead} min antes` : 'al empezar'})</option>
                  {REMINDER_CHOICES.map(m => (
                    <option key={m} value={m}>{m < 0 ? 'Sin aviso' : m === 0 ? 'Al empezar' : `${fmtDuration(m)} antes`}</option>
                  ))}
                </select>
              </label>
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
