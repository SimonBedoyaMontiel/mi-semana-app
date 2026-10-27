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

/** Whole day done: a soft wash of the accent colour across the window. */
export function celebrate(): void {
  if (reduced()) return
  const wash = document.createElement('i')
  wash.className = 'wash'
  document.body.appendChild(wash)
  wash.animate([{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }], { duration: 1400, easing: 'ease-out' }).onfinish = () => wash.remove()
}

export const newId = (): string => crypto.randomUUID().replace(/-/g, '').slice(0, 16)
