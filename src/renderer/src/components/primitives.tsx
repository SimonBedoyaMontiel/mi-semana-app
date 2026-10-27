import { useEffect, useId } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import type { Priority } from '@shared/model'
import { PRIORITY_LABEL } from '@shared/constants'

export const cx = (...c: Array<string | false | null | undefined>): string => c.filter(Boolean).join(' ')

/** Critically damped: fast, no overshoot. Motion should feel precise, not bouncy. */
export const SPRING = { type: 'spring', stiffness: 520, damping: 46, mass: 0.9 } as const
export const SOFT = { type: 'spring', stiffness: 170, damping: 28 } as const
export const EASE = [0.22, 1, 0.36, 1] as const

export function Ring({
  value, size = 40, stroke = 4, color = 'var(--accent)', children, className,
}: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode; className?: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value || 0))
  return (
    <span className={cx('ring', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="ring-track" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          className="ring-fill"
          style={{ stroke: color }}
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={SOFT}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {children !== undefined && <span className="ring-inner">{children}</span>}
    </span>
  )
}

export function Check({ on, size = 14 }: { on: boolean; size?: number }) {
  return (
    <svg className="check" width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <motion.path
        d="M3.2 8.6l3.1 3 6.5-7"
        initial={false}
        animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }}
        transition={{ pathLength: { type: 'spring', stiffness: 260, damping: 26, delay: on ? 0.06 : 0 }, opacity: { duration: 0.1 } }}
      />
    </svg>
  )
}

export function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const mv = useMotionValue(0)
  const spring = useSpring(mv, { stiffness: 90, damping: 20 })
  const text = useTransform(spring, v => `${Math.round(v)}${suffix}`)
  useEffect(() => {
    mv.set(value)
  }, [mv, value])
  return <motion.span className="num">{text}</motion.span>
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  const id = useId()
  return (
    <label className="switch-row" htmlFor={id}>
      <span>{label}</span>
      <button id={id} type="button" role="switch" aria-checked={on} className={cx('switch', on && 'is-on')} onClick={() => onChange(!on)}>
        <motion.span className="switch-knob" layout transition={SPRING} />
      </button>
    </label>
  )
}

export function Segmented<T extends string>({
  value, options, onChange, layoutId, size = 'm', label,
}: {
  value: T
  options: ReadonlyArray<{ value: T; label: ReactNode }>
  onChange: (v: T) => void
  layoutId: string
  size?: 's' | 'm'
  label: string
}) {
  return (
    <div className={cx('seg', size === 's' && 'seg-s')} role="tablist" aria-label={label}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className="seg-btn"
          onClick={() => onChange(o.value)}
        >
          {o.value === value && <motion.span layoutId={layoutId} className="seg-pill" transition={SPRING} />}
          <span className="seg-label">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

export function Chip({
  active, onClick, children, color, className, ...rest
}: { active?: boolean; onClick?: () => void; children: ReactNode; color?: string; className?: string; 'aria-label'?: string }) {
  return (
    <motion.button
      type="button"
      className={cx('chip', active && 'is-active', className)}
      aria-pressed={active}
      onClick={onClick}
      style={color ? ({ '--c': color } as CSSProperties) : undefined}
      whileTap={{ scale: 0.92 }}
      {...rest}
    >
      {color && <span className="chip-dot" />}
      {children}
    </motion.button>
  )
}

export const Icon = {
  plus: <svg viewBox="0 0 24 24" className="ico ico-plus" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>,
  left: <svg viewBox="0 0 24 24" className="ico" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>,
  right: <svg viewBox="0 0 24 24" className="ico" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>,
  gear: <svg viewBox="0 0 24 24" className="ico ico-gear" aria-hidden="true"><circle cx="12" cy="12" r="3.2" /><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2L5.5 5.5" /></svg>,
  panel: <svg viewBox="0 0 24 24" className="ico" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M14.5 4.5v15" /></svg>,
  close: <svg viewBox="0 0 24 24" className="ico" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>,
  pen: <svg viewBox="0 0 24 24" className="ico" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z" /></svg>,
  flame: <svg viewBox="0 0 24 24" className="ico ico-fill" aria-hidden="true"><path d="M12 2.5c1 4 5 5.4 5 10.8a5 5 0 0 1-10 0c0-2.6 1.3-4.2 2.6-5.3.2 1.6.9 2.6 1.9 3C11 8 10.6 5 12 2.5z" /></svg>,
  bell: <svg viewBox="0 0 24 24" className="ico ico-bell" aria-hidden="true"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16zM10 20.5a2 2 0 0 0 4 0" /></svg>,
  palette: (
    <svg viewBox="0 0 24 24" className="ico ico-palette" aria-hidden="true">
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.7 1.7-1.7h2.1A4.4 4.4 0 0 0 21 10.3C21 6.5 17 3.5 12 3.5z" />
      <circle className="pd pd1" cx="7.6" cy="11.4" r="1.25" />
      <circle className="pd pd2" cx="10.3" cy="7.6" r="1.25" />
      <circle className="pd pd3" cx="15" cy="7.8" r="1.25" />
    </svg>
  ),
  star: <svg viewBox="0 0 24 24" className="ico ico-fill ico-star" aria-hidden="true"><path d="M12 2.8l2.1 6.1 6.1 2.1-6.1 2.1L12 19.2l-2.1-6.1L3.8 11l6.1-2.1L12 2.8z" /></svg>,
  repeat: <svg viewBox="0 0 24 24" className="ico ico-repeat" aria-hidden="true"><path d="M4.5 10a7.5 7.5 0 0 1 12.9-3.5L19.5 8.5M19.5 4v4.5H15M19.5 14a7.5 7.5 0 0 1-12.9 3.5L4.5 15.5M4.5 20v-4.5H9" /></svg>,
  image: <svg viewBox="0 0 24 24" className="ico" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><circle cx="9" cy="9.5" r="1.6" /><path d="M4 17l4.8-4.6 3.4 3.1 3-2.6L20 17" /></svg>,
  sliders: <svg viewBox="0 0 24 24" className="ico ico-sliders" aria-hidden="true"><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle className="sk sk1" cx="15" cy="7" r="2" /><circle className="sk sk2" cx="9" cy="17" r="2" /></svg>,
  database: <svg viewBox="0 0 24 24" className="ico" aria-hidden="true"><ellipse cx="12" cy="6" rx="7" ry="2.8" /><path d="M5 6v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6M5 12v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-6" /></svg>,
  user: <svg viewBox="0 0 24 24" className="ico" aria-hidden="true"><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></svg>,
}

/**
 * Priority as three rising bars (like signal strength): high fills all three in the signal colour,
 * medium two in amber, low one in teal. High priority breathes gently.
 */
export function PriorityMark({ value, className }: { value?: Priority; className?: string }) {
  if (!value) return null
  const n = value === 'alta' ? 3 : value === 'media' ? 2 : 1
  return (
    <span className={cx('prio', `prio-${value}`, className)} title={`Prioridad ${PRIORITY_LABEL[value].toLowerCase()}`} aria-label={`Prioridad ${PRIORITY_LABEL[value].toLowerCase()}`} role="img">
      {[0, 1, 2].map(i => <i key={i} className={i < n ? 'on' : undefined} />)}
    </span>
  )
}
