import { useRef } from 'react'
import { motion, useScroll, useSpring } from 'motion/react'
import { ETAPAS } from '../data/content'
import { Reveal } from '../components/ui/Reveal'
import { Accent } from '../components/ui/SectionHeading'

export function Process() {
  const listRef = useRef<HTMLOListElement>(null)
  const { scrollYProgress } = useScroll({ target: listRef, offset: ['start 70%', 'end 60%'] })
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 })

  return (
    <section id="processo" className="relative bg-white py-28 md:py-36">
      <div className="container-site grid gap-16 lg:grid-cols-[0.9fr_1.1fr] lg:gap-24">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <Reveal>
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.28em] text-ember uppercase">
              <span className="h-px w-6 bg-ember/60" />
              Processo
            </span>
            <h2 className="mt-5 text-4xl leading-[1.05] font-bold tracking-tight text-balance md:text-5xl lg:text-[3.5rem]">
              Do campo até a <Accent>sua porta</Accent>
            </h2>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-forest-900/60">
              Cada etapa foi pensada para garantir que o morango chegue no mesmo estado em que saiu
              da fazenda.
            </p>
            <div className="mt-10 hidden items-center gap-4 lg:flex">
              <span className="font-mono text-6xl font-bold text-forest-900/8">06</span>
              <span className="text-sm leading-snug text-forest-900/50">
                etapas de controle
                <br />
                em cada entrega
              </span>
            </div>
          </Reveal>
        </div>

        <ol ref={listRef} className="relative">
          <span className="absolute top-2 bottom-2 left-[27px] w-px bg-forest-900/10" />
          <motion.span
            className="absolute top-2 bottom-2 left-[27px] w-px origin-top bg-gradient-to-b from-lime via-ember to-ember"
            style={{ scaleY: progress }}
          />

          {ETAPAS.map((e, i) => (
            <li key={e.titulo} className="relative pb-10 pl-20 last:pb-0">
              <motion.span
                className="absolute top-0 left-0 grid size-14 place-items-center rounded-full border-2 border-forest-900 bg-cream text-forest-900"
                initial={{ scale: 0.6, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true, margin: '-30% 0px' }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              >
                <e.icon className="size-6" />
              </motion.span>
              <Reveal y={20}>
                <div className="group rounded-3xl border border-forest-900/6 bg-cream-50 p-6 transition-all duration-500 hover:border-ember/30 hover:bg-white hover:shadow-[0_24px_50px_-28px_rgba(11,42,30,0.35)] md:p-7">
                  <span className="font-mono text-[11px] font-semibold tracking-[0.15em] text-ember uppercase">
                    Etapa {i + 1}
                  </span>
                  <h3 className="mt-2 text-xl font-semibold">{e.titulo}</h3>
                  <p className="mt-2 leading-relaxed text-forest-900/60">{e.texto}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
