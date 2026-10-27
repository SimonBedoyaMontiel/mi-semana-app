const reduced = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Completion feedback: a thin ring that expands from the element and fades. Runs on the compositor
 * (transform + opacity via WAAPI) and removes itself; no React state involved.
 */
export function ripple(el: Element | null, color = 'var(--accent)'): void {
  if (!el || reduced()) return
  const r = el.getBoundingClientRect()
  const size = Math.max(r.width, r.height)
  const ring = document.createElement('i')
  ring.className = 'ripple'
  ring.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;width:${size}px;height:${size}px;border-color:${color}`
  document.body.appendChild(ring)
  ring.animate(
    [
      { transform: 'translate(-50%,-50%) scale(0.7)', opacity: 0.7 },
      { transform: 'translate(-50%,-50%) scale(2.1)', opacity: 0 },
    ],
    { duration: 620, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' },
  ).onfinish = () => ring.remove()
}

const SHAPES = ['dot', 'bar', 'tri'] as const

/**
 * A small burst of shapes thrown out of a point, falling under a little gravity. Each piece is one
 * absolutely positioned element animated by WAAPI, so nothing runs on the main thread after launch.
 */
function launch(x: number, y: number, colors: readonly string[], count: number, power: number): void {
  const layer = document.createElement('div')
  layer.className = 'burst'
  document.body.appendChild(layer)
  let left = count
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i')
    p.className = `bp bp-${SHAPES[i % SHAPES.length]}`
    p.style.cssText = `left:${x}px;top:${y}px;background:${colors[i % colors.length]}`
    layer.appendChild(p)
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.7
    const speed = power * (0.55 + Math.random() * 0.6)
    const dx = Math.cos(angle) * speed
    const dy = Math.sin(angle) * speed - power * 0.35
    const spin = (Math.random() - 0.5) * 720
    const scale = 0.7 + Math.random() * 0.6
    p.animate(
      [
        { transform: `translate(-50%,-50%) scale(0) rotate(0deg)`, opacity: 1 },
        { transform: `translate(calc(-50% + ${dx * 0.7}px), calc(-50% + ${dy * 0.7}px)) scale(${scale}) rotate(${spin * 0.6}deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + power * 0.9}px)) scale(${scale * 0.6}) rotate(${spin}deg)`, opacity: 0 },
      ],
      { duration: 820 + Math.random() * 420, easing: 'cubic-bezier(0.15, 0.6, 0.35, 1)' },
    ).onfinish = () => {
      if (--left === 0) layer.remove()
    }
  }
}

/** Something got done: a ring plus a handful of pieces in its colour. */
export function burst(el: Element | null, color = 'var(--accent)'): void {
  ripple(el, color)
  if (!el || reduced()) return
  const r = el.getBoundingClientRect()
  launch(r.left + r.width / 2, r.top + r.height / 2, [color, color, 'var(--accent)', 'var(--amber)'], 14, 46)
}

/** Whole day done: a wash of the accent across the window and a wide burst from the top. */
export function celebrate(): void {
  if (reduced()) return
  const wash = document.createElement('i')
  wash.className = 'wash'
  document.body.appendChild(wash)
  wash.animate([{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }], { duration: 1600, easing: 'ease-out' }).onfinish = () => wash.remove()
  const colors = ['var(--accent)', 'var(--vermilion)', 'var(--amber)', 'var(--green)', 'var(--violet)', 'var(--teal)']
  const w = window.innerWidth
  launch(w * 0.5, window.innerHeight * 0.32, colors, 36, 170)
  window.setTimeout(() => launch(w * 0.28, window.innerHeight * 0.42, colors, 18, 120), 140)
  window.setTimeout(() => launch(w * 0.72, window.innerHeight * 0.42, colors, 18, 120), 220)
}

/**
 * Pointer effects, delegated from one listener for the whole app:
 * - `.spot`: a soft light follows the cursor (sets --mx / --my).
 * - `.tilt`: the element leans a few degrees toward the cursor (sets --rx / --ry).
 * - `.magnet`: the element drifts a few pixels toward the cursor (sets --tx / --ty).
 * Only on devices with a real hover; nothing at all when reduced motion is asked for.
 */
export function installPointerFx(): () => void {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return () => undefined
  let spot: HTMLElement | null = null
  let tilt: HTMLElement | null = null
  let magnet: HTMLElement | null = null
  let frame = 0
  let last: PointerEvent | null = null

  const reset = (el: HTMLElement | null, props: string[]): void => {
    if (el) for (const p of props) el.style.removeProperty(p)
  }

  const apply = (): void => {
    frame = 0
    const e = last
    if (!e || reduced()) return
    const target = e.target instanceof Element ? e.target : null

    const s = target?.closest<HTMLElement>('.spot') ?? null
    if (s !== spot) reset(spot, ['--mx', '--my'])
    spot = s
    if (s) {
      const r = s.getBoundingClientRect()
      s.style.setProperty('--mx', `${e.clientX - r.left}px`)
      s.style.setProperty('--my', `${e.clientY - r.top}px`)
    }

    const t = target?.closest<HTMLElement>('.tilt') ?? null
    if (t !== tilt) reset(tilt, ['--rx', '--ry'])
    tilt = t
    if (t) {
      const r = t.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width - 0.5
      const py = (e.clientY - r.top) / r.height - 0.5
      t.style.setProperty('--rx', `${(-py * 7).toFixed(2)}deg`)
      t.style.setProperty('--ry', `${(px * 7).toFixed(2)}deg`)
    }

    const m = target?.closest<HTMLElement>('.magnet') ?? null
    if (m !== magnet) reset(magnet, ['--tx', '--ty'])
    magnet = m
    if (m) {
      const r = m.getBoundingClientRect()
      m.style.setProperty('--tx', `${((e.clientX - r.left - r.width / 2) * 0.22).toFixed(1)}px`)
      m.style.setProperty('--ty', `${((e.clientY - r.top - r.height / 2) * 0.3).toFixed(1)}px`)
    }
  }

  const onMove = (e: PointerEvent): void => {
    last = e
    if (!frame) frame = requestAnimationFrame(apply)
  }
  const onLeave = (): void => {
    reset(spot, ['--mx', '--my'])
    reset(tilt, ['--rx', '--ry'])
    reset(magnet, ['--tx', '--ty'])
    spot = tilt = magnet = null
  }
  document.addEventListener('pointermove', onMove, { passive: true })
  document.documentElement.addEventListener('pointerleave', onLeave)
  return () => {
    document.removeEventListener('pointermove', onMove)
    document.documentElement.removeEventListener('pointerleave', onLeave)
    cancelAnimationFrame(frame)
  }
}

export const newId = (): string => crypto.randomUUID().replace(/-/g, '').slice(0, 16)
