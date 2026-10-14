import Lenis from 'lenis'

let lenis: Lenis | null = null
const HEADER_OFFSET = -72

export function initSmoothScroll() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}

  lenis = new Lenis({ duration: 1.15, easing: (t) => 1 - Math.pow(1 - t, 4) })
  let raf = requestAnimationFrame(function loop(time) {
    lenis?.raf(time)
    raf = requestAnimationFrame(loop)
  })

  return () => {
    cancelAnimationFrame(raf)
    lenis?.destroy()
    lenis = null
  }
}

export function scrollToHash(hash: string) {
  if (hash === '#topo') {
    if (lenis) lenis.scrollTo(0)
    else window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  const target = document.querySelector<HTMLElement>(hash)
  if (!target) return
  if (lenis) lenis.scrollTo(target, { offset: HEADER_OFFSET })
  else target.scrollIntoView({ behavior: 'smooth' })
}

export function lockScroll(locked: boolean) {
  if (lenis) {
    if (locked) lenis.stop()
    else lenis.start()
  }
  document.documentElement.style.overflow = locked ? 'hidden' : ''
}
