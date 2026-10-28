import type { MouseEvent } from 'react'
import { motion } from 'motion/react'
import type { CalendarEvent } from '@shared/model'
import { meetingService } from '@shared/events'
import { cx } from '@/components/primitives'

/** Icons for event details. */
export const EvIcon = {
  video: <svg viewBox="0 0 24 24" className="ico ev-ico ei-video" aria-hidden="true"><rect x="2.5" y="6" width="13" height="12" rx="2.5" /><path className="fx" d="M15.5 10.5l6-3.5v10l-6-3.5" /></svg>,
  link: <svg viewBox="0 0 24 24" className="ico ev-ico" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path className="fx" d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>,
  pin: <svg viewBox="0 0 24 24" className="ico ev-ico ei-pin" aria-hidden="true"><path className="fx" d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></svg>,
  people: <svg viewBox="0 0 24 24" className="ico ev-ico" aria-hidden="true"><circle cx="9" cy="8" r="3" /><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" /><g className="fx"><circle cx="16.5" cy="9" r="2.5" /><path d="M16 14a4.5 4.5 0 0 1 4.5 4.5" /></g></svg>,
  notes: <svg viewBox="0 0 24 24" className="ico ev-ico" aria-hidden="true"><path d="M4 6h16M4 10.5h16M4 15h10" /><path className="fx" d="M4 19.5h7" /></svg>,
  list: <svg viewBox="0 0 24 24" className="ico ev-ico" aria-hidden="true"><path className="fx" d="M3.5 6.5l1.5 1.5 2.5-3M3.5 12.5l1.5 1.5 2.5-3" /><path d="M11 6.5h9.5M11 12.5h9.5M11 18.5h9.5M4.5 18.5h2" /></svg>,
  copy: <svg viewBox="0 0 24 24" className="ico ev-ico" aria-hidden="true"><rect x="8.5" y="8.5" width="12" height="12" rx="2.5" /><path className="fx" d="M15.5 8.5V6A2.5 2.5 0 0 0 13 3.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5" /></svg>,
  bookmark: <svg viewBox="0 0 24 24" className="ico ev-ico" aria-hidden="true"><path className="fx" d="M6 3.5h12v17l-6-4-6 4z" /></svg>,
  map: <svg viewBox="0 0 24 24" className="ico ev-ico" aria-hidden="true"><path d="M9 4.5L3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5z" /><path className="fx" d="M9 4.5v13M15 6.5v13" /></svg>,
  multi: <svg viewBox="0 0 24 24" className="ico ev-ico" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /><path className="fx" d="M7 14.5h10" /></svg>,
}

/** Opens a web address outside the app (the desktop shell sends it to the browser). */
export function openLink(url: string): void {
  if (/^https?:\/\//i.test(url)) window.open(url, '_blank', 'noopener,noreferrer')
}

export const mapsUrl = (place: string): string => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`

/** «Unirse» for a meeting, «Abrir enlace» for any other address. */
export function JoinButton({ url, size = 'm', className }: { url: string; size?: 's' | 'm'; className?: string }) {
  const service = meetingService(url)
  const go = (e: MouseEvent): void => {
    e.stopPropagation()
    openLink(url)
  }
  return (
    <motion.button
      type="button"
      className={cx('join-btn', `is-${size}`, service && 'is-meeting', className)}
      onClick={go}
      onPointerDown={e => e.stopPropagation()}
      title={service ? `Unirse por ${service}` : url}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.94 }}
    >
      {service ? EvIcon.video : EvIcon.link}
      <span>{service ? 'Unirse' : 'Abrir'}</span>
    </motion.button>
  )
}

/** Tiny marks for what an event carries: link, place, people, steps. */
export function EventMarks({ e }: { e: Pick<CalendarEvent, 'link' | 'location' | 'guests' | 'tasks' | 'notes'> }) {
  const done = e.tasks?.filter(t => t.done).length ?? 0
  if (!e.link && !e.location && !e.guests?.length && !e.tasks?.length) return null
  return (
    <span className="ev-marks">
      {e.link && (meetingService(e.link) ? EvIcon.video : EvIcon.link)}
      {e.location && EvIcon.pin}
      {!!e.guests?.length && <>{EvIcon.people}<b>{e.guests.length}</b></>}
      {!!e.tasks?.length && <>{EvIcon.list}<b className={cx(done === e.tasks.length && 'is-done')}>{done}/{e.tasks.length}</b></>}
    </span>
  )
}
