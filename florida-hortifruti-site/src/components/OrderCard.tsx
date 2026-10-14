import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Check } from 'lucide-react'
import { cn } from '../lib/utils'

const ETAPAS = ['Pedido criado', 'Aprovado', 'Separado', 'Saiu para entrega', 'Entregue']

/** Ilustração do acompanhamento de pedido da plataforma; avança sozinha em loop */
export function OrderCard({
  className,
  tone = 'glass',
}: {
  className?: string
  tone?: 'glass' | 'solid'
}) {
  const [step, setStep] = useState(3)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setStep((s) => (s + 1) % (ETAPAS.length + 1)), 1600)
    return () => clearInterval(id)
  }, [])

  const glass = tone === 'glass'

  return (
    <div
      className={cn(
        'w-[300px] rounded-3xl p-5',
        glass
          ? 'border border-white/15 bg-white/[0.07] text-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] backdrop-blur-2xl'
          : 'border border-forest-900/8 bg-white text-forest-900 shadow-[0_30px_80px_-30px_rgba(11,42,30,0.35)]',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p
            className={cn(
              'text-[10px] font-semibold tracking-[0.2em] uppercase',
              glass ? 'text-cream/50' : 'text-forest-900/45',
            )}
          >
            Pedido
          </p>
          <p className="mt-0.5 font-mono text-lg font-semibold">Nº 000123</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-ember/15 px-2.5 py-1 text-[11px] font-semibold text-ember">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-ember opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-ember" />
          </span>
          Ao vivo
        </span>
      </div>

      <div
        className={cn(
          'mt-4 grid grid-cols-2 gap-2 rounded-2xl p-3 text-xs',
          glass ? 'bg-black/20' : 'bg-cream-100',
        )}
      >
        <div>
          <p className={glass ? 'text-cream/50' : 'text-forest-900/50'}>Morango B2</p>
          <p className="font-semibold">30 caixas</p>
        </div>
        <div>
          <p className={glass ? 'text-cream/50' : 'text-forest-900/50'}>Morango B3</p>
          <p className="font-semibold">20 caixas</p>
        </div>
      </div>

      <ol className="mt-4 space-y-0">
        {ETAPAS.map((etapa, i) => {
          const done = i < step
          const current = i === step
          return (
            <li key={etapa} className="relative flex items-center gap-3 py-1.5">
              {i < ETAPAS.length - 1 && (
                <span
                  className={cn(
                    'absolute top-6 left-[9px] h-[calc(100%-12px)] w-px',
                    glass ? 'bg-white/12' : 'bg-forest-900/10',
                  )}
                >
                  <motion.span
                    className="absolute inset-x-0 top-0 bg-ember"
                    initial={false}
                    animate={{ height: done ? '100%' : '0%' }}
                    transition={{ duration: 0.5 }}
                  />
                </span>
              )}
              <motion.span
                initial={false}
                animate={{ scale: current ? 1.15 : 1 }}
                className={cn(
                  'relative z-10 grid size-[19px] shrink-0 place-items-center rounded-full border transition-colors duration-500',
                  done && 'border-ember bg-ember text-white',
                  current && 'border-ember bg-transparent',
                  !done && !current && (glass ? 'border-white/20' : 'border-forest-900/15'),
                )}
              >
                {done && <Check className="size-3" strokeWidth={3} />}
                {current && <span className="size-2 rounded-full bg-ember" />}
              </motion.span>
              <span
                className={cn(
                  'text-[13px] transition-colors duration-500',
                  done || current ? 'font-medium' : glass ? 'text-white/40' : 'text-forest-900/35',
                )}
              >
                {etapa}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
