import { useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Habit, HabitKind, Ink, Slot } from '@shared/model'
import { INKS, INK_LABEL, SLOTS, SLOT_LABEL } from '@shared/constants'
import { DAYS, DAYS_LETTER, todayIso } from '@shared/dates'
import { useStore } from '@/state/store'
import { deleteHabit } from '@/state/actions'
import { newId } from '@/lib/fx'
import { Sheet } from '@/components/Sheet'
import { Chip, Segmented, cx } from '@/components/primitives'

export function HabitSheet({ habit }: { habit?: Habit }) {
  const close = useStore(s => s.closeSheet)
  const dispatch = useStore(s => s.dispatch)
  const notify = useStore(s => s.notify)
  const count = useStore(s => s.data!.habits.length)

  const [kind, setKind] = useState<HabitKind>(habit?.kind ?? 'habito')
  const [name, setName] = useState(habit?.name ?? '')
  const [dose, setDose] = useState(habit?.dose ?? '')
  const [target, setTarget] = useState(habit?.target ?? 1)
  const [unit, setUnit] = useState(habit?.unit ?? '')
  const [slot, setSlot] = useState<Slot>(habit?.slot ?? 'manana')
  const [days, setDays] = useState<number[]>(habit?.days ?? [0, 1, 2, 3, 4, 5, 6])
  const [color, setColor] = useState<Ink>(habit?.color ?? INKS[count % INKS.length]!)
  const [error, setError] = useState<string | null>(null)
  const sup = kind === 'suplemento'

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    if (!name.trim()) return setError('Ponle un nombre.')
    if (!days.length) return setError('Elige al menos un día.')
    const next: Habit = {
      id: habit?.id ?? newId(), name: name.trim(), kind, dose: dose.trim(), target, unit: unit.trim(),
      slot, days: [...days].sort(), color, createdAt: habit?.createdAt ?? todayIso(),
    }
    dispatch({ type: 'habit.upsert', habit: next })
    if (!habit) notify(`${sup ? 'Suplemento' : 'Hábito'} añadido: ${next.name}`)
    close()
  }

  return (
    <Sheet
      title={habit ? 'Editar hábito' : sup ? 'Nuevo suplemento' : 'Nuevo hábito'}
      onClose={close}
      footer={
        <>
          {habit && <button type="button" className="btn ghost danger" onClick={() => { deleteHabit(habit); close() }}>Borrar</button>}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={close}>Cancelar</button>
          <button type="submit" form="habit-form" className="btn primary">Guardar</button>
        </>
      }
    >
      <form id="habit-form" className="form" onSubmit={submit} style={{ '--c': `var(--${color})` } as CSSProperties}>
        <Segmented
          label="Tipo"
          layoutId="habit-kind"
          value={kind}
          onChange={setKind}
          options={[{ value: 'habito', label: 'Hábito' }, { value: 'suplemento', label: 'Suplemento' }]}
        />
        <input data-autofocus className="title-input" placeholder={sup ? 'Ej. Creatina' : 'Ej. Leer'} value={name} maxLength={60} onChange={e => { setName(e.target.value); setError(null) }} aria-label="Nombre" />
        <div className="row">
          <label className="field">
            <span>{sup ? 'Dosis' : 'Detalle'}</span>
            <input value={dose} maxLength={40} placeholder={sup ? 'Ej. 5 g' : 'Ej. 20 min'} onChange={e => setDose(e.target.value)} />
          </label>
          <div className="field">
            <span>Veces al día</span>
            <div className="stepper">
              <motion.button type="button" className="mini" whileTap={{ scale: 0.85 }} onClick={() => setTarget(t => Math.max(1, t - 1))} aria-label="Menos">−</motion.button>
              <span className="stepper-val">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.b key={target} initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}>{target}</motion.b>
                </AnimatePresence>
              </span>
              <motion.button type="button" className="mini" whileTap={{ scale: 0.85 }} onClick={() => setTarget(t => Math.min(30, t + 1))} aria-label="Más">+</motion.button>
              <input className="unit" value={unit} maxLength={16} placeholder={sup ? 'tomas' : 'veces'} onChange={e => setUnit(e.target.value)} aria-label="Unidad" />
            </div>
          </div>
        </div>
        <div className="field">
          <span>Momento del día</span>
          <div className="chips">
            {SLOTS.map(s => <Chip key={s} active={slot === s} onClick={() => setSlot(s)}>{SLOT_LABEL[s]}</Chip>)}
          </div>
        </div>
        <div className="field">
          <span>Qué días</span>
          <div className="chips">
            {DAYS_LETTER.map((d, i) => (
              <Chip key={i} className="chip-day" active={days.includes(i)} aria-label={DAYS[i]} onClick={() => setDays(ds => (ds.includes(i) ? ds.filter(x => x !== i) : [...ds, i]))}>{d}</Chip>
            ))}
            <button type="button" className="link" onClick={() => setDays([0, 1, 2, 3, 4, 5, 6])}>Todos</button>
            <button type="button" className="link" onClick={() => setDays([0, 1, 2, 3, 4])}>Entre semana</button>
          </div>
        </div>
        <div className="field">
          <span>Color</span>
          <div className="swatches">
            {INKS.map(i => (
              <motion.button
                key={i}
                type="button"
                className={cx('swatch', color === i && 'is-active')}
                style={{ '--c': `var(--${i})` } as CSSProperties}
                aria-label={INK_LABEL[i]}
                aria-pressed={color === i}
                whileHover={{ scale: 1.15, rotate: -8 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setColor(i)}
              />
            ))}
          </div>
        </div>
        <AnimatePresence>
          {error && <motion.p className="error" role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{error}</motion.p>}
        </AnimatePresence>
      </form>
    </Sheet>
  )
}
