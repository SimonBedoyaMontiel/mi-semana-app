const reduced = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches

const INKS = ['var(--cobalt)', 'var(--vermilion)', 'var(--amber)', 'var(--teal)', 'var(--magenta)']

/**
 * Particle burst on the compositor: absolutely positioned nodes animated with WAAPI,
 * removed when finished. No canvas, no React state, no layout work per frame.
 */
export function burst(x: number, y: number, colors: readonly string[] = INKS, count = 14, spread = 64): void {
  if (reduced()) return
  const layer = document.createDocumentFragment()
  const nodes: HTMLElement[] = []
  for (let i = 0; i < count; i++) {
    const n = document.createElement('i')
    const size = 4 + Math.random() * 6
    n.className = 'spark'
    n.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size * (Math.random() < 0.4 ? 2.4 : 1)}px;background:${colors[i % colors.length]};border-radius:${Math.random() < 0.5 ? '50%' : '1px'}`
    layer.appendChild(n)
    nodes.push(n)
  }
  document.body.appendChild(layer)
  for (const n of nodes) {
    const a = Math.random() * Math.PI * 2
    const d = spread * (0.45 + Math.random() * 0.8)
    n.animate(
      [
        { transform: 'translate(-50%,-50%) scale(1) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d + 24}px)) scale(.2) rotate(${Math.random() * 720 - 360}deg)`, opacity: 0 },
      ],
      { duration: 650 + Math.random() * 500, easing: 'cubic-bezier(.12,.8,.24,1)' },
    ).onfinish = () => n.remove()
  }
}

export function burstFrom(el: Element | null, colors?: readonly string[], count?: number, spread?: number): void {
  if (!el) return
  const r = el.getBoundingClientRect()
  burst(r.left + r.width / 2, r.top + r.height / 2, colors, count, spread)
}

export function celebrate(): void {
  burst(window.innerWidth / 2, window.innerHeight * 0.35, INKS, 60, 260)
}

export const newId = (): string => crypto.randomUUID().replace(/-/g, '').slice(0, 16)
