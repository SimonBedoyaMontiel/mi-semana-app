import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { motion } from 'motion/react'
import type { EventIndex, EventItem, PlacedEvent } from '@shared/events'
import { hourWindow, layoutDay } from '@shared/events'
import { fromMin, pad, toMin } from '@shared/dates'
import { useStore } from '@/state/store'
import { moveEvent, toggleEvent } from '@/state/actions'
import { useMinute } from '@/state/hooks'
import { Check, SPRING, cx } from '@/components/primitives'

const SNAP = 15
const LAST_MIN = 23 * 60 + 59

type Drag =
  | { kind: 'create'; day: number; a: number; b: number }
  | { kind: 'move'; ev: EventItem; day: number; start: number; dur: number; grab: number; x0: number; y0: number; moved: boolean }
  | { kind: 'resize'; ev: EventItem; day: number; start: number; end: number }
  | { kind: 'tap'; x0: number; y0: number; evId: string | null }

const snap = (m: number): number => Math.round(m / SNAP) * SNAP
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

const EventBlock = memo(function EventBlock({ p, h0, hh, compact }: { p: PlacedEvent; h0: number; hh: number; compact: boolean }) {
  const e = p.event
  const top = ((p.startMin - h0 * 60) / 60) * hh
  const height = Math.max(20, ((p.endMin - p.startMin) / 60) * hh - 2)
  const short = p.endMin - p.startMin < 45
  return (
    <motion.div
      layoutId={`tl-${e.id}`}
      layout="position"
      data-ev={e.id}
      tabIndex={0}
      role="button"
      aria-label={`${e.text}, de ${e.start} a ${e.end}${e.done ? ', hecho' : ''}`}
      className={cx('ev', e.done && 'is-done', short && 'is-short', compact && 'is-compact')}
      style={{
        top,
        height,
        left: `calc(${p.col} / ${p.cols} * 100% + 2px)`,
        width: `calc(100% / ${p.cols} - 4px)`,
        '--c': `var(--cat-${e.cat})`,
      } as CSSProperties}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={SPRING}
    >
      <div className="ev-title">{e.text}</div>
      <div className="ev-time">{e.start}–{e.end}{e.repeat && <svg className="ev-repeat" viewBox="0 0 16 16" aria-label="Se repite"><path d="M3 6.5a5 5 0 0 1 8.6-2.3L13 5.6M13 2.5v3.1H9.9M13 9.5a5 5 0 0 1-8.6 2.3L3 10.4M3 13.5v-3.1h3.1" /></svg>}</div>
      {!compact && (
        <button
          type="button"
          className="ev-check"
          aria-label={e.done ? 'Marcar como pendiente' : 'Marcar como hecho'}
          onPointerDown={ev => ev.stopPropagation()}
          onClick={ev => {
            ev.stopPropagation()
            toggleEvent(e, ev.currentTarget)
          }}
        >
          <Check on={e.done} size={12} />
        </button>
      )}
      <span className="ev-resize" aria-hidden="true" />
    </motion.div>
  )
})

function NowLine({ h0, hh }: { h0: number; hh: number }) {
  useMinute()
  const d = new Date()
  const m = d.getHours() * 60 + d.getMinutes()
  if (m < h0 * 60) return null
  return (
    <div className="now" style={{ top: ((m - h0 * 60) / 60) * hh }}>
      <i />
      <span>{pad(d.getHours())}:{pad(d.getMinutes())}</span>
    </div>
  )
}

export function Timeline({ days, idx, hh, today, compact = false }: { days: string[]; idx: EventIndex; hh: number; today: string; compact?: boolean }) {
  const openSheet = useStore(s => s.openSheet)
  const cols = useRef<HTMLDivElement>(null)
  const hover = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)

  const all = days.flatMap(d => idx.get(d) ?? [])
  const [h0, h1] = hourWindow(all)
  const height = (h1 - h0) * hh

  const update = (d: Drag | null): void => {
    dragRef.current = d
    setDrag(d)
  }

  const point = (e: { clientX: number; clientY: number }): { min: number; day: number } => {
    const r = cols.current!.getBoundingClientRect()
    return {
      min: h0 * 60 + ((e.clientY - r.top) / hh) * 60,
      day: clamp(Math.floor((e.clientX - r.left) / (r.width / days.length)), 0, days.length - 1),
    }
  }

  // Start each timeline near "now" (today) or the first event, never at midnight.
  useLayoutEffect(() => {
    const el = cols.current
    const scroller = el?.closest('.scroller')
    if (!el || !scroller) return
    const timed = all.filter(e => e.start).map(e => toMin(e.start))
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
    const target = days.includes(today) ? nowMin - 90 : timed.length ? Math.min(...timed) - 45 : 8 * 60
    const offset = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
    scroller.scrollTop = Math.max(0, offset - 90 + ((target - h0 * 60) / 60) * hh)
    // only when the visible range changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days[0], days.length])

  useEffect(() => {
    if (!drag) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        update(null)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [drag])

  const findEvent = (id: string): EventItem | undefined => all.find(e => e.id === id)

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return
    const t = e.target as HTMLElement
    if (t.closest('.ev-check')) return
    const p = point(e)
    const evEl = t.closest<HTMLElement>('[data-ev]')
    // Touch: let the page scroll; a short tap opens/creates instead of dragging.
    if (e.pointerType === 'touch') {
      update({ kind: 'tap', x0: e.clientX, y0: e.clientY, evId: evEl?.dataset.ev ?? null })
      return
    }
    const ev = evEl ? findEvent(evEl.dataset.ev!) : undefined
    if (ev) {
      const start = toMin(ev.start)
      const end = toMin(ev.end)
      const day = days.indexOf(ev.date)
      if (t.closest('.ev-resize')) update({ kind: 'resize', ev, day, start, end })
      else update({ kind: 'move', ev, day, start, dur: end - start, grab: p.min - start, x0: e.clientX, y0: e.clientY, moved: false })
    } else {
      const m = clamp(Math.floor(p.min / SNAP) * SNAP, h0 * 60, h1 * 60 - SNAP)
      update({ kind: 'create', day: p.day, a: m, b: m })
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    e.preventDefault()
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const d = dragRef.current
    const p = point(e)
    if (d?.kind === 'tap') return
    if (!d) {
      // hover hint, written to the DOM directly
      const g = hover.current
      if (!g) return
      const overEvent = (e.target as HTMLElement).closest('[data-ev]')
      const slot = Math.floor(p.min / 30) * 30
      g.style.opacity = overEvent ? '0' : '1'
      g.style.transform = `translate(${p.day * 100}%, ${((slot - h0 * 60) / 60) * hh}px)`
      g.textContent = `+ ${fromMin(slot)}`
      return
    }
    if (d.kind === 'create') update({ ...d, b: clamp(snap(p.min), h0 * 60, h1 * 60) })
    else if (d.kind === 'resize') update({ ...d, end: clamp(snap(p.min), d.start + SNAP, LAST_MIN) })
    else {
      const moved = d.moved || Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 4
      if (!moved) return
      update({ ...d, moved, day: p.day, start: clamp(snap(p.min - d.grab), 0, LAST_MIN - d.dur) })
    }
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const d = dragRef.current
    update(null)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    if (!d) return
    if (d.kind === 'tap') {
      if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 8) return
      const ev = d.evId ? findEvent(d.evId) : undefined
      if (ev) openSheet({ kind: 'event', event: ev })
      else {
        const p = point(e)
        const m = clamp(Math.floor(p.min / 30) * 30, h0 * 60, h1 * 60 - 30)
        openSheet({ kind: 'event', preset: { date: days[p.day]!, start: fromMin(m), end: fromMin(Math.min(m + 60, LAST_MIN)) } })
      }
      return
    }
    if (d.kind === 'create') {
      const lo = Math.min(d.a, d.b)
      const hi = Math.max(d.a, d.b)
      const end = hi - lo >= SNAP ? hi : lo + 60
      openSheet({ kind: 'event', preset: { date: days[d.day]!, start: fromMin(lo), end: fromMin(Math.min(end, LAST_MIN)) } })
    } else if (d.kind === 'move') {
      if (!d.moved) openSheet({ kind: 'event', event: d.ev })
      else moveEvent(d.ev, { date: days[d.day]!, start: fromMin(d.start), end: fromMin(d.start + d.dur) })
    } else if (d.end !== toMin(d.ev.end)) {
      moveEvent(d.ev, { date: d.ev.date, start: d.ev.start, end: fromMin(d.end) })
    }
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-ev]')
    if (!el || (e.key !== 'Enter' && e.key !== ' ')) return
    e.preventDefault()
    const ev = findEvent(el.dataset.ev!)
    if (ev) openSheet({ kind: 'event', event: ev })
  }

  const draggingId = drag && (drag.kind === 'resize' || (drag.kind === 'move' && drag.moved)) ? drag.ev.id : null

  const preview = (dayIndex: number) => {
    if (!drag || drag.kind === 'tap' || drag.day !== dayIndex) return null
    if (drag.kind === 'create') {
      const lo = Math.min(drag.a, drag.b)
      const hi = Math.max(drag.a, drag.b, lo + SNAP)
      return (
        <div className="tl-create" style={{ top: ((lo - h0 * 60) / 60) * hh, height: ((hi - lo) / 60) * hh }}>
          {fromMin(lo)}–{fromMin(hi)}
        </div>
      )
    }
    if (!draggingId || (drag.kind !== 'move' && drag.kind !== 'resize')) return null
    const start = drag.start
    const end = drag.kind === 'move' ? drag.start + drag.dur : drag.end
    return (
      <motion.div
        layoutId={`tl-${drag.ev.id}`}
        transition={{ layout: { duration: 0 } }}
        className={cx('ev', 'is-dragging', drag.ev.done && 'is-done', compact && 'is-compact')}
        style={{ top: ((start - h0 * 60) / 60) * hh, height: Math.max(20, ((end - start) / 60) * hh - 2), left: 2, width: 'calc(100% - 4px)', '--c': `var(--cat-${drag.ev.cat})` } as CSSProperties}
      >
        <div className="ev-title">{drag.ev.text}</div>
        <div className="ev-time">{fromMin(start)}–{fromMin(end)}</div>
      </motion.div>
    )
  }

  return (
    <div className={cx('tl', compact && 'is-compact')} style={{ '--hh': `${hh}px` } as CSSProperties}>
      <div className="tl-hours" style={{ height }} aria-hidden="true">
        {Array.from({ length: h1 - h0 }, (_, i) => (
          <span key={i} style={{ top: i * hh }}>{pad(h0 + i)}:00</span>
        ))}
      </div>
      <div
        ref={cols}
        className={cx('tl-cols', drag && 'is-dragging')}
        style={{ height, gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => update(null)}
        onPointerLeave={() => hover.current && (hover.current.style.opacity = '0')}
        onKeyDown={onKeyDown}
      >
        {days.map((d, di) => {
          const evs = (idx.get(d) ?? []).filter(e => e.start && e.id !== draggingId)
          return (
            <div key={d} className={cx('tl-col', d === today && 'is-today')}>
              {layoutDay(evs).map(p => (
                <EventBlock key={p.event.id} p={p} h0={h0} hh={hh} compact={compact} />
              ))}
              {preview(di)}
              {d === today && <NowLine h0={h0} hh={hh} />}
            </div>
          )
        })}
        <div ref={hover} className="tl-hover" style={{ width: `calc(100% / ${days.length})`, height: hh / 2 }} />
      </div>
    </div>
  )
}
