import { useEffect, useId } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'

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
  plus: <svg viewBox="0 0 24 24" className="ico" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>,
  left: <svg viewBox="0 0 24 24" className="ico" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>,
  right: <svg viewBox="0 0 24 24" className="ico" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>,
  gear: <svg viewBox="0 0 24 24" className="ico" aria-hidden="true"><circle cx="12" cy="12" r="3.2" /><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2L5.5 5.5" /></svg>,
  panel: <svg viewBox="0 0 24 24" className="ico" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M14.5 4.5v15" /></svg>,
  close: <svg viewBox="0 0 24 24" className="ico" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>,
  pen: <svg viewBox="0 0 24 24" className="ico" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z" /></svg>,
  flame: <svg viewBox="0 0 24 24" className="ico ico-fill" aria-hidden="true"><path d="M12 2.5c1 4 5 5.4 5 10.8a5 5 0 0 1-10 0c0-2.6 1.3-4.2 2.6-5.3.2 1.6.9 2.6 1.9 3C11 8 10.6 5 12 2.5z" /></svg>,
  bell: <svg viewBox="0 0 24 24" className="ico" aria-hidden="true"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16zM10 20.5a2 2 0 0 0 4 0" /></svg>,
}
