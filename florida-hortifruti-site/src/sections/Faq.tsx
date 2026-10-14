import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Plus } from 'lucide-react'
import { FAQ } from '../data/content'
import { whatsappLink, WHATSAPP_LABEL } from '../lib/config'
import { cn } from '../lib/utils'
import { Reveal } from '../components/ui/Reveal'
import { Accent } from '../components/ui/SectionHeading'

export function Faq() {
  const [aberta, setAberta] = useState<number | null>(0)

  return (
    <section id="faq" className="bg-white py-28 md:py-36">
      <div className="container-site grid gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <Reveal className="lg:sticky lg:top-32 lg:self-start">
          <span className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.28em] text-ember uppercase">
            <span className="h-px w-6 bg-ember/60" />
            Dúvidas frequentes
          </span>
          <h2 className="mt-5 text-4xl leading-[1.05] font-bold tracking-tight md:text-5xl lg:text-[3.5rem]">
            Perguntas <Accent>frequentes</Accent>
          </h2>
          <p className="mt-6 max-w-sm leading-relaxed text-forest-900/60">
            Não encontrou o que procura? Fale com a gente pelo{' '}
            <a
              href={whatsappLink()}
              target="_blank"
              rel="noopener"
              className="font-semibold text-ember underline-offset-4 hover:underline"
            >
              WhatsApp {WHATSAPP_LABEL}
            </a>
            .
          </p>
        </Reveal>

        <div className="divide-y divide-forest-900/8 border-y border-forest-900/8">
          {FAQ.map((item, i) => {
            const open = aberta === i
            return (
              <Reveal key={item.q} delay={i * 0.04} y={16}>
                <button
                  type="button"
                  onClick={() => setAberta(open ? null : i)}
                  aria-expanded={open}
                  className="group flex w-full items-center justify-between gap-6 py-6 text-left"
                >
                  <span
                    className={cn(
                      'text-base font-semibold transition-colors md:text-lg',
                      open ? 'text-ember' : 'group-hover:text-ember',
                    )}
                  >
                    {item.q}
                  </span>
                  <span
                    className={cn(
                      'grid size-9 shrink-0 place-items-center rounded-full border transition-all duration-500',
                      open
                        ? 'rotate-45 border-ember bg-ember text-white'
                        : 'border-forest-900/15 text-forest-900',
                    )}
                  >
                    <Plus className="size-4" />
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="max-w-2xl pb-7 leading-relaxed text-forest-900/65">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
