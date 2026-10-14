import { useRef, type HTMLAttributes, type MouseEvent } from 'react'
import { cn } from '../../lib/utils'

/** Cartão com um brilho que segue o cursor */
export function SpotlightCard({
  className,
  children,
  color = 'rgba(226,90,22,0.14)',
  ...props
}: HTMLAttributes<HTMLDivElement> & { color?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  function onMove(e: MouseEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--x', `${e.clientX - r.left}px`)
    el.style.setProperty('--y', `${e.clientY - r.top}px`)
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      className={cn('group/spot relative overflow-hidden', className)}
      {...props}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/spot:opacity-100"
        style={{
          background: `radial-gradient(420px circle at var(--x) var(--y), ${color}, transparent 60%)`,
        }}
      />
      {children}
    </div>
  )
}
