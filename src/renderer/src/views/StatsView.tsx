import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { motion } from 'motion/react'
import type { AppData, Category, Review } from '@shared/model'
import { CATEGORIES, CATEGORY_LABEL, MOOD_LABEL } from '@shared/constants'
import { DAYS_SHORT, addDays, fmtDuration, fromIso, mondayOf, toIso, toMin, weekDates } from '@shared/dates'
import { countOf, dayProgress, isActiveOn } from '@shared/habits'
import type { EventIndex } from '@shared/events'
import { useStore } from '@/state/store'
import { useEventIndex, useToday } from '@/state/hooks'
import { MOOD_COLOR, MoodFace } from '@/components/Journal'
import { AnimatedNumber, Ring } from '@/components/primitives'

const INSIGHT_DAYS = 60

interface DayStat { date: string; done: number; total: number }

/** Everything the week view of the summary shows, computed in one pass. */
function weekStats(data: AppData, idx: EventIndex, days: string[], today: string) {
  let evDone = 0
  let evTotal = 0
  let habDone = 0
  let habTotal = 0
  let prioDone = 0
  let prioTotal = 0
  let focus = 0
  const moods: number[] = []
  const planned = new Map<Category, number>()
  const doneMin = new Map<Category, number>()
  const perDay: DayStat[] = []
  for (const d of days) {
    const list = idx.get(d) ?? []
    let done = 0
    let total = 0
    for (const e of list) {
      evTotal++
      total++
      if (e.done) {
        evDone++
        done++
      }
      if (e.start) {
        const m = toMin(e.end) - toMin(e.start)
        planned.set(e.cat, (planned.get(e.cat) ?? 0) + m)
        if (e.done) doneMin.set(e.cat, (doneMin.get(e.cat) ?? 0) + m)
      }
    }
    if (d <= today) {
      const h = dayProgress(data.habits, data.habitLog, d)
      habDone += h.done
      habTotal += h.total
      done += h.done
      total += h.total
    }
    const tops = data.priorities[d] ?? []
    prioTotal += tops.length
    prioDone += tops.filter(t => t.done).length
    done += tops.filter(t => t.done).length
    total += tops.length
    focus += (data.focus[d] ?? []).reduce((n, s) => n + s.minutes, 0)
    const mood = data.journal[d]?.mood
    if (mood) moods.push(mood)
    perDay.push({ date: d, done, total })
  }
  const cats = CATEGORIES.map(c => ({ cat: c, planned: planned.get(c) ?? 0, done: doneMin.get(c) ?? 0 })).filter(c => c.planned > 0)
  return {
    evDone, evTotal, habDone, habTotal, prioDone, prioTotal, focus, perDay, cats,
    mood: moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : 0,
  }
}

/** Plain-language links between what you did and how you felt, over the last two months. */
function insights(data: AppData, today: string): string[] {
  const days: string[] = []
  for (let d = fromIso(today), i = 0; i < INSIGHT_DAYS; i++, d = addDays(d, -1)) days.push(toIso(d))
  const withMood = days.filter(d => data.journal[d]?.mood)
  if (withMood.length < 6) return []
  const avg = (list: string[]): number => list.reduce((n, d) => n + data.journal[d]!.mood!, 0) / list.length
  const out: Array<{ text: string; weight: number }> = []

  for (const h of data.habits) {
    const active = withMood.filter(d => isActiveOn(h, d))
    const yes = active.filter(d => countOf(data.habitLog, h.id, d) >= h.target)
    const no = active.filter(d => countOf(data.habitLog, h.id, d) < h.target)
    if (yes.length < 3 || no.length < 3) continue
    const diff = avg(yes) - avg(no)
    if (Math.abs(diff) < 0.5) continue
    out.push({
      text: diff > 0
        ? `Los días que cumples «${h.name}», tu ánimo es ${diff.toFixed(1).replace('.', ',')} puntos más alto.`
        : `Los días que cumples «${h.name}», tu ánimo es ${(-diff).toFixed(1).replace('.', ',')} puntos más bajo. Quizá conviene cambiar el momento del día.`,
      weight: Math.abs(diff),
    })
  }

  const focused = withMood.filter(d => (data.focus[d] ?? []).reduce((n, s) => n + s.minutes, 0) >= 30)
  const unfocused = withMood.filter(d => !focused.includes(d))
  if (focused.length >= 3 && unfocused.length >= 3) {
    const diff = avg(focused) - avg(unfocused)
    if (diff >= 0.5) out.push({ text: `Los días con al menos 30 minutos de enfoque te sientes mejor (+${diff.toFixed(1).replace('.', ',')}).`, weight: diff })
  }

  const byWeekday = [0, 1, 2, 3, 4, 5, 6].map(w => withMood.filter(d => (fromIso(d).getDay() + 6) % 7 === w))
  const best = byWeekday.map((l, w) => ({ w, n: l.length, v: l.length ? avg(l) : 0 })).filter(x => x.n >= 2).sort((a, b) => b.v - a.v)[0]
  if (best && best.v >= 3.5) out.push({ text: `Tu mejor día suele ser el ${['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'][best.w]}.`, weight: 0.3 })

  return out.sort((a, b) => b.weight - a.weight).slice(0, 4).map(x => x.text)
}

function ReviewField({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const [text, setText] = useState(value)
  const timer = useRef(0)
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setText(value)
  }, [value])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return (
    <label className="field">
      <span>{label}</span>
      <textarea
        className="notes short"
        value={text}
        maxLength={1000}
        onFocus={() => (focused.current = true)}
        onBlur={() => (focused.current = false)}
        onChange={e => {
          const v = e.target.value
          setText(v)
          window.clearTimeout(timer.current)
          timer.current = window.setTimeout(() => onSave(v), 450)
        }}
      />
    </label>
  )
}

function Tile({ label, children, sub, i }: { label: string; children: ReactNode; sub?: string; i: number }) {
  return (
    <motion.div className="tile" initial={{ opacity: 0, y: 14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 22, delay: i * 0.05 } }}>
      <span className="tile-label">{label}</span>
      <div className="tile-value">{children}</div>
      {sub && <span className="tile-sub">{sub}</span>}
    </motion.div>
  )
}

const pct = (a: number, b: number): number => (b ? Math.round((a / b) * 100) : 0)

export function StatsView() {
  const date = useStore(s => s.date)
  const data = useStore(s => s.data!)
  const dispatch = useStore(s => s.dispatch)
  const openDay = useStore(s => s.openDay)
  const idx = useEventIndex()
  const today = useToday()
  const days = useMemo(() => weekDates(fromIso(date)).map(toIso), [date])
  const monday = toIso(mondayOf(fromIso(date)))
  const s = useMemo(() => weekStats(data, idx, days, today), [data, idx, days, today])
  const tips = useMemo(() => insights(data, today), [data, today])
  const review = data.reviews[monday] ?? { good: '', improve: '', next: '' }
  const maxCat = Math.max(1, ...s.cats.map(c => c.planned))

  const saveReview = (patch: Partial<Review>): void => {
    const next = { ...(useStore.getState().data!.reviews[monday] ?? { good: '', improve: '', next: '' }), ...patch }
    const empty = !next.good.trim() && !next.improve.trim() && !next.next.trim()
    dispatch({ type: 'review.set', week: monday, review: empty ? null : next })
  }

  return (
    <div className="stats" key={monday}>
      <div className="tiles">
        <Tile i={0} label="Eventos hechos" sub={`${s.evDone} de ${s.evTotal}`}>
          <Ring value={s.evTotal ? s.evDone / s.evTotal : 0} size={48} stroke={5}><AnimatedNumber value={pct(s.evDone, s.evTotal)} suffix="%" /></Ring>
        </Tile>
        <Tile i={1} label="Hábitos" sub={`${s.habDone} de ${s.habTotal}`}>
          <Ring value={s.habTotal ? s.habDone / s.habTotal : 0} size={48} stroke={5} color="var(--green)"><AnimatedNumber value={pct(s.habDone, s.habTotal)} suffix="%" /></Ring>
        </Tile>
        <Tile i={2} label="Prioridades" sub={s.prioTotal ? `${s.prioDone} de ${s.prioTotal}` : 'Sin prioridades'}>
          <Ring value={s.prioTotal ? s.prioDone / s.prioTotal : 0} size={48} stroke={5} color="var(--violet)"><AnimatedNumber value={pct(s.prioDone, s.prioTotal)} suffix="%" /></Ring>
        </Tile>
        <Tile i={3} label="Enfoque" sub={s.focus ? fmtDuration(s.focus) : 'Sin bloques'}>
          <b className="big-num"><AnimatedNumber value={s.focus} /><small>min</small></b>
        </Tile>
        <Tile i={4} label="Ánimo medio" sub={s.mood ? MOOD_LABEL[Math.round(s.mood) as 1] : 'Sin registrar'}>
          {s.mood ? <span style={{ color: MOOD_COLOR[Math.round(s.mood)] }}><MoodFace mood={Math.round(s.mood)} size={44} /></span> : <span className="tile-dash" />}
        </Tile>
      </div>

      <div className="stats-grid">
        <section className="panel">
          <header className="panel-head"><h3>Día a día</h3><span className="count">Lo cumplido de cada día</span></header>
          <div className="day-bars">
            {s.perDay.map((d, i) => {
              const v = d.total ? d.done / d.total : 0
              return (
                <button key={d.date} type="button" className="day-bar" onClick={() => openDay(d.date)} title={`${d.done} de ${d.total}`}>
                  <span className="db-track">
                    <motion.span
                      className="db-fill"
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: v }}
                      transition={{ type: 'spring', stiffness: 160, damping: 18, delay: 0.1 + i * 0.05 }}
                      style={{ background: v === 1 ? 'var(--green)' : 'var(--accent)' }}
                    />
                  </span>
                  <span className="db-pct">{d.total ? `${Math.round(v * 100)}%` : '—'}</span>
                  <span className="db-day">{DAYS_SHORT[i]}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="panel">
          <header className="panel-head"><h3>Tiempo por categoría</h3><span className="count">Planificado y hecho</span></header>
          {s.cats.length ? (
            <ul className="cat-bars">
              {s.cats.map((c, i) => (
                <li key={c.cat} style={{ '--c': `var(--cat-${c.cat})` } as CSSProperties}>
                  <span className="cb-name">{CATEGORY_LABEL[c.cat]}</span>
                  <span className="cb-track">
                    <motion.span className="cb-plan" initial={{ scaleX: 0 }} animate={{ scaleX: c.planned / maxCat }} transition={{ type: 'spring', stiffness: 140, damping: 20, delay: i * 0.06 }} />
                    <motion.span className="cb-done" initial={{ scaleX: 0 }} animate={{ scaleX: c.done / maxCat }} transition={{ type: 'spring', stiffness: 140, damping: 20, delay: 0.2 + i * 0.06 }} />
                  </span>
                  <span className="cb-val">{fmtDuration(c.planned)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">Esta semana no hay eventos con hora.</p>
          )}
        </section>
      </div>

      {tips.length > 0 && (
        <section className="panel insights">
          <header className="panel-head"><h3>Lo que dicen tus datos</h3><span className="count">Últimos {INSIGHT_DAYS} días</span></header>
          <ul>
            {tips.map((t, i) => (
              <motion.li key={t} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0, transition: { delay: 0.15 + i * 0.08 } }}>{t}</motion.li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel review">
        <header className="panel-head">
          <h3>Revisión de la semana</h3>
          {data.reviews[monday] && <span className="count saved">Guardada</span>}
        </header>
        <div className="review-grid">
          <ReviewField label="¿Qué salió bien?" value={review.good} onSave={good => saveReview({ good })} />
          <ReviewField label="¿Qué quieres mejorar?" value={review.improve} onSave={improve => saveReview({ improve })} />
          <ReviewField label="Prioridades para la próxima semana" value={review.next} onSave={next => saveReview({ next })} />
        </div>
      </section>
    </div>
  )
}
