import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Quote } from 'lucide-react'
import { DEPOIMENTOS } from '../data/content'
import { cn } from '../lib/utils'
import { Reveal } from '../components/ui/Reveal'
import { Accent, SectionHeading } from '../components/ui/SectionHeading'

const INTERVALO = 7000

export function Testimonials() {
  const [atual, setAtual] = useState(0)
  const [pausado, setPausado] = useState(false)

  useEffect(() => {
    if (pausado) return
    const id = setTimeout(() => setAtual((a) => (a + 1) % DEPOIMENTOS.length), INTERVALO)
    return () => clearTimeout(id)
  }, [atual, pausado])

  const d = DEPOIMENTOS[atual]

  return (
    <section id="clientes" className="relative overflow-hidden bg-cream-50 py-28 md:py-36">
      <div className="container-site">
        <SectionHeading
          eyebrow="Clientes"
          title={
            <>
              Quem já trabalha <Accent>com a gente</Accent>
            </>
          }
          subtitle="Confeitarias, padarias, sorveterias e food services que confiam no nosso morango todos os dias."
        />

        <Reveal
          className="relative mx-auto mt-16 max-w-4xl"
          onMouseEnter={() => setPausado(true)}
          onMouseLeave={() => setPausado(false)}
        >
          <div className="relative overflow-hidden rounded-[32px] border border-forest-900/6 bg-white p-8 shadow-[0_40px_80px_-50px_rgba(11,42,30,0.4)] md:p-14">
            <Quote
              className="absolute -top-2 right-6 size-28 rotate-180 text-cream/70 md:size-36"
              strokeWidth={1}
            />
            <div className="relative min-h-[220px] md:min-h-[200px]">
              <AnimatePresence mode="wait">
                <motion.figure
                  key={atual}
                  initial={{ opacity: 0, y: 20, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -20, filter: 'blur(6px)' }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                  <blockquote className="relative font-serif text-2xl leading-snug text-forest-900 md:pr-20 md:text-[2.1rem]">
                    “{d.texto}”
                  </blockquote>
                  <figcaption className="mt-8 flex items-center gap-4">
                    <span className="grid size-12 place-items-center rounded-full bg-forest-900 font-semibold text-cream">
                      {d.nome[0]}
                    </span>
                    <span>
                      <span className="block font-semibold">{d.nome}</span>
                      <span className="block text-sm text-forest-900/50">{d.empresa}</span>
                    </span>
                  </figcaption>
                </motion.figure>
              </AnimatePresence>
            </div>

            <div className="mt-10 flex gap-2">
              {DEPOIMENTOS.map((dep, i) => (
                <button
                  key={dep.nome}
                  type="button"
                  onClick={() => setAtual(i)}
                  aria-label={`Depoimento de ${dep.nome}`}
                  className="relative h-1 flex-1 overflow-hidden rounded-full bg-forest-900/8"
                >
                  {i === atual && (
                    <motion.span
                      key={`${atual}-${pausado}`}
                      className={cn('absolute inset-y-0 left-0 rounded-full bg-ember')}
                      initial={{ width: pausado ? '100%' : '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: pausado ? 0 : INTERVALO / 1000, ease: 'linear' }}
                    />
                  )}
                  {i < atual && <span className="absolute inset-0 rounded-full bg-ember/40" />}
                </button>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
