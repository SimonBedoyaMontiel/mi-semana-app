import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ENERGY_LABEL, MOOD_LABEL } from '@shared/constants'
import { DAYS, DAYS_LETTER, MONTHS, MONTHS_SHORT, addDays, fromIso, mondayOf, toIso, weekday } from '@shared/dates'
import { useStore } from '@/state/store'
import { useToday } from '@/state/hooks'
import { MOOD_COLOR, MoodFace, promptFor } from '@/components/Journal'
import { AnimatedNumber, Icon, cx } from '@/components/primitives'

const PAGE = 30

/** Days in a row with something written, ending today (or yesterday, if today is still blank). */
function writingStreak(has: (iso: string) => boolean, today: string): number {
  let d = fromIso(today)
  if (!has(today)) d = addDays(d, -1)
  let n = 0
  while (has(toIso(d))) {
    n++
    d = addDays(d, -1)
  }
  return n
}

export function JournalView() {
  const date = useStore(s => s.date)
  const journal = useStore(s => s.data!.journal)
  const notes = useStore(s => s.data!.notes)
  const openDay = useStore(s => s.openDay)
  const today = useToday()
  const year = fromIso(date).getFullYear()
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE)

  const has = (iso: string): boolean => !!journal[iso] || !!notes[iso]

  // One column per week, Monday first, covering the whole year.
  const weeks = useMemo(() => {
    const first = mondayOf(new Date(year, 0, 1))
    const cols: string[][] = []
    for (let d = first; d.getFullYear() <= year; d = addDays(d, 7)) {
      cols.push(Array.from({ length: 7 }, (_, i) => toIso(addDays(d, i))))
      if (cols.length > 54) break
    }
    return cols
  }, [year])

  const days = useMemo(() => {
    const all = new Set([...Object.keys(journal), ...Object.keys(notes)].filter(d => d.startsWith(String(year))))
    return [...all].sort().reverse()
  }, [journal, notes, year])

  const q = query.trim().toLowerCase()
  const matches = q
    ? days.filter(d => [notes[d] ?? '', journal[d]?.answer ?? '', ...(journal[d]?.gratitude ?? [])].join(' ').toLowerCase().includes(q))
    : days
  const moods = days.map(d => journal[d]?.mood).filter((m): m is number => !!m)
  const avg = moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : 0

  return (
    <div className="journal-view">
      <section className="panel jv-year">
        <header className="panel-head">
          <h3>Tu año en ánimo</h3>
          <span className="mood-legend" aria-hidden="true">
            {[1, 2, 3, 4, 5].map(m => <i key={m} style={{ background: MOOD_COLOR[m] }} title={MOOD_LABEL[m as 1]} />)}
          </span>
        </header>
        <div className="mood-heat" role="img" aria-label={`Ánimo de cada día de ${year}`}>
          <div className="heat-days" aria-hidden="true">{DAYS_LETTER.map(d => <span key={d}>{d}</span>)}</div>
          <div className="mh-scroll">
            <div className="mh-months" aria-hidden="true">
              {weeks.map((w, i) => {
                // A month's label sits over the first week that ends inside it.
                const m = fromIso(w[6]!).getMonth()
                const prev = i ? fromIso(weeks[i - 1]![6]!).getMonth() : -1
                return <span key={i}>{m !== prev ? MONTHS_SHORT[m] : ''}</span>
              })}
            </div>
            <div className="heat-grid">
              {weeks.map((w, wi) => (
                <div key={wi} className="heat-col">
                  {w.map(d => {
                    const mood = journal[d]?.mood
                    const out = !d.startsWith(String(year))
                    const future = d > today
                    return (
                      <button
                        key={d}
                        type="button"
                        tabIndex={-1}
                        className={cx('mh-cell', !mood && 'is-empty', out && 'is-out', future && 'is-future', has(d) && !mood && 'is-written', d === today && 'is-today')}
                        style={{ '--c': mood ? MOOD_COLOR[mood] : undefined, '--i': wi } as CSSProperties}
                        title={`${DAYS[weekday(fromIso(d))]} ${fromIso(d).getDate()} de ${MONTHS[fromIso(d).getMonth()]}${mood ? ` · ${MOOD_LABEL[mood as 1]}` : ''}`}
                        onClick={() => !out && openDay(d)}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="jv-stats">
          <div><b><AnimatedNumber value={days.length} /></b><span>días escritos</span></div>
          <div><b><AnimatedNumber value={writingStreak(has, today)} /></b><span>días seguidos</span></div>
          <div className="jv-avg">
            {avg ? <MoodFace mood={Math.round(avg)} size={28} /> : null}
            <span>{avg ? `Ánimo medio: ${MOOD_LABEL[Math.round(avg) as 1].toLowerCase()}` : 'Aún sin ánimo registrado'}</span>
          </div>
        </div>
      </section>

      <section className="jv-list">
        <label className="jv-search">
          {Icon.search}
          <input value={query} placeholder="Buscar en tu diario…" onChange={e => { setQuery(e.target.value); setShown(PAGE) }} aria-label="Buscar en el diario" />
        </label>
        {matches.length === 0 ? (
          <div className="empty jv-empty">
            <p>{q ? 'Nada coincide con tu búsqueda.' : 'Todavía no has escrito nada este año. Abre un día y cuenta cómo te fue.'}</p>
            {!q && <button type="button" className="btn" onClick={() => openDay(today)}>{Icon.book}Escribir hoy</button>}
          </div>
        ) : (
          <ul className="entries">
            <AnimatePresence initial={false}>
              {matches.slice(0, shown).map((d, i) => {
                const j = journal[d]
                const dd = fromIso(d)
                return (
                  <motion.li
                    key={d}
                    layout
                    className="entry"
                    style={{ '--c': j?.mood ? MOOD_COLOR[j.mood] : 'var(--line)' } as CSSProperties}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 26, delay: Math.min(i, 10) * 0.035 } }}
                    exit={{ opacity: 0, scale: 0.97 }}
                  >
                    <button type="button" className="entry-btn" onClick={() => openDay(d)}>
                      <span className="entry-date">
                        <b>{dd.getDate()}</b>
                        <span>{MONTHS_SHORT[dd.getMonth()]}</span>
                      </span>
                      <span className="entry-body">
                        <span className="entry-meta">
                          {DAYS[weekday(dd)]}
                          {j?.mood && <><MoodFace mood={j.mood} size={16} />{MOOD_LABEL[j.mood as 1]}</>}
                          {j?.energy && <span className="tag">Energía {ENERGY_LABEL[j.energy].toLowerCase()}</span>}
                        </span>
                        {!!j?.gratitude.filter(Boolean).length && (
                          <span className="entry-grat">{j.gratitude.filter(Boolean).map((g, k) => <span key={k}>{g}</span>)}</span>
                        )}
                        {j?.answer && <span className="entry-answer"><em>{promptFor(d)}</em>{j.answer}</span>}
                        {notes[d] && <span className="entry-note">{notes[d]}</span>}
                      </span>
                    </button>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        )}
        {matches.length > shown && <button type="button" className="btn ghost" onClick={() => setShown(n => n + PAGE)}>Ver más</button>}
      </section>
    </div>
  )
}
