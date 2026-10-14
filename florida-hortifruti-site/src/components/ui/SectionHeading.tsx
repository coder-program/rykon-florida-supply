import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { Reveal } from './Reveal'

type Props = {
  eyebrow: string
  title: ReactNode
  subtitle?: ReactNode
  tone?: 'light' | 'dark'
  align?: 'center' | 'left'
  className?: string
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  tone = 'light',
  align = 'center',
  className,
}: Props) {
  const dark = tone === 'dark'
  return (
    <Reveal
      className={cn(align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-xl', className)}
    >
      <span
        className={cn(
          'inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.28em] text-ember uppercase',
          align === 'center' && 'justify-center',
        )}
      >
        <span className="h-px w-6 bg-ember/60" />
        {eyebrow}
        {align === 'center' && <span className="h-px w-6 bg-ember/60" />}
      </span>
      <h2
        className={cn(
          'mt-5 text-4xl leading-[1.05] font-bold tracking-tight text-balance md:text-5xl lg:text-[3.5rem]',
          dark ? 'text-white' : 'text-forest-900',
        )}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={cn(
            'mt-5 text-base leading-relaxed md:text-lg',
            dark ? 'text-cream/70' : 'text-forest-900/65',
          )}
        >
          {subtitle}
        </p>
      )}
    </Reveal>
  )
}

/** Destaque em serifa itálica dentro dos títulos */
export function Accent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <em className={cn('font-serif font-normal tracking-normal text-ember italic', className)}>
      {children}
    </em>
  )
}
