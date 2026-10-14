import { ArrowUpRight } from 'lucide-react'
import { SEGMENTOS } from '../data/content'
import { cn } from '../lib/utils'
import { Reveal } from '../components/ui/Reveal'
import { Accent, SectionHeading } from '../components/ui/SectionHeading'

// grade bento: os cartões maiores ocupam duas colunas
const LAYOUT = ['lg:col-span-2', '', '', '', 'lg:col-span-2', '']

export function Segments() {
  return (
    <section
      id="para-quem"
      className="grain relative overflow-hidden bg-forest-900 py-28 text-white md:py-36"
    >
      <div className="pointer-events-none absolute top-0 left-1/2 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-ember/50 to-transparent" />
      <div className="pointer-events-none absolute -top-60 left-1/2 size-[700px] -translate-x-1/2 rounded-full bg-ember/10 blur-[140px]" />

      <div className="container-site relative">
        <SectionHeading
          tone="dark"
          eyebrow="Segmentos atendidos"
          title={
            <>
              Para quem <Accent>atendemos</Accent>
            </>
          }
          subtitle="Atendemos empresas que usam morango no dia a dia e precisam de fornecimento confiável, regular e com qualidade garantida."
        />

        <div className="mt-16 grid auto-rows-[340px] gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SEGMENTOS.map((s, i) => (
            <Reveal key={s.titulo} delay={(i % 3) * 0.08} className={cn('h-full', LAYOUT[i])}>
              <article className="group relative h-full overflow-hidden rounded-[26px] border border-white/8">
                <img
                  src={s.img}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 size-full object-cover transition-transform duration-[1.4s] ease-out group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/50 to-transparent transition-opacity duration-500 group-hover:opacity-90" />
                <div className="absolute inset-x-0 bottom-0 p-6 md:p-7">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <span className="font-mono text-[11px] text-ember">0{i + 1}</span>
                      <h3 className="mt-1 text-2xl font-semibold text-cream">{s.titulo}</h3>
                    </div>
                    <span className="grid size-10 shrink-0 translate-y-2 place-items-center rounded-full bg-white/10 opacity-0 backdrop-blur-md transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                      <ArrowUpRight className="size-4" />
                    </span>
                  </div>
                  <div className="grid grid-rows-[0fr] transition-all duration-500 group-hover:grid-rows-[1fr] max-lg:grid-rows-[1fr]">
                    <p className="overflow-hidden text-sm leading-relaxed text-cream/70">
                      <span className="block pt-2">{s.texto}</span>
                    </p>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
