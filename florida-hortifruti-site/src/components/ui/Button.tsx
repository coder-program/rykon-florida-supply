import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

const base =
  'group relative inline-flex items-center justify-center gap-2.5 overflow-hidden rounded-full font-semibold whitespace-nowrap transition-all duration-300 active:scale-[0.98]'

const variants = {
  ember:
    'bg-ember text-white shadow-[0_10px_30px_-10px_rgba(226,90,22,0.7)] hover:bg-ember-600 hover:shadow-[0_14px_40px_-10px_rgba(226,90,22,0.9)]',
  glass:
    'border border-white/20 bg-white/5 text-white backdrop-blur-md hover:border-white/40 hover:bg-white/10',
  dark: 'bg-forest-900 text-white hover:bg-forest-700',
  outline:
    'border border-forest-900/15 text-forest-900 hover:border-forest-900/40 hover:bg-forest-900/5',
}

const sizes = {
  sm: 'h-10 px-4 text-[13px]',
  md: 'h-12 px-6 text-sm',
  lg: 'h-14 px-8 text-[15px]',
}

type Common = { variant?: keyof typeof variants; size?: keyof typeof sizes }

function classes({ variant = 'ember', size = 'md' }: Common, className?: string) {
  return cn(base, variants[variant], sizes[size], className)
}

/** Brilho que atravessa o botão no hover */
function Shine() {
  return (
    <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
  )
}

export function LinkButton({
  variant,
  size,
  className,
  children,
  ...props
}: Common & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a className={classes({ variant, size }, className)} {...props}>
      <Shine />
      {children}
    </a>
  )
}

export function Button({
  variant,
  size,
  className,
  children,
  ...props
}: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={classes({ variant, size }, className)} {...props}>
      <Shine />
      {children}
    </button>
  )
}
