import { useEffect, useRef } from 'react'
import { animate, useInView } from 'motion/react'

/** Número que conta de 0 até o valor quando aparece na tela */
export function Counter({
  to,
  suffix = '',
  duration = 1.8,
}: {
  to: number
  suffix?: string
  duration?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })

  useEffect(() => {
    if (!inView || !ref.current) return
    const node = ref.current
    const controls = animate(0, to, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        node.textContent = `${Math.round(v)}${suffix}`
      },
    })
    return () => controls.stop()
  }, [inView, to, suffix, duration])

  return <span ref={ref}>0{suffix}</span>
}
