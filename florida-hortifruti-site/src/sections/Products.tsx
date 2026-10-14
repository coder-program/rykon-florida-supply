import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Droplets, Package, Sprout } from 'lucide-react'
import { LINHAS, PRODUTOS } from '../data/content'
import { whatsappLink } from '../lib/config'
import { cn } from '../lib/utils'
import { Reveal } from '../components/ui/Reveal'
import { Accent, SectionHeading } from '../components/ui/SectionHeading'
import { SpotlightCard } from '../components/ui/SpotlightCard'

type Filtro = (typeof LINHAS)[number]

export function Products() {
  const [filtro, setFiltro] = useState<Filtro>('Todos')
  const lista = filtro === 'Todos' ? PRODUTOS : PRODUTOS.filter((p) => p.linha === filtro)

  return (
    <section id="produtos" className="relative bg-cream-50 py-28 md:py-36">
      <div className="container-site">
        <SectionHeading
          eyebrow="Catálogo"
          title={
            <>
              Nossos <Accent>produtos</Accent>
            </>
          }
          subtitle={
            <>
              Cada caixa contém{' '}
              <strong className="font-semibold text-forest-900">4 caixinhas</strong>. Valores sob
              consulta — trabalhamos com cotações personalizadas para cada cliente.
            </>
          }
        />

        <Reveal className="mt-12 flex justify-center">
          <div className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-forest-900/8 bg-white p-1.5 shadow-sm [scrollbar-width:none]">
            {LINHAS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setFiltro(l)}
                className={cn(
                  'relative shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-colors md:px-5',
                  filtro === l ? 'text-white' : 'text-forest-900/60 hover:text-forest-900',
                )}
              >
                {filtro === l && (
                  <motion.span
                    layoutId="filtro-pill"
                    className="absolute inset-0 rounded-full bg-forest-900"
                    transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                  />
                )}
                <span className="relative">{l}</span>
              </button>
            ))}
          </div>
        </Reveal>

        <motion.div layout className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {lista.map((p) => (
              <motion.div
                key={p.nome}
                layout
                initial={{ opacity: 0, scale: 0.92, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                <SpotlightCard className="flex h-full flex-col rounded-[24px] border border-forest-900/6 bg-white transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_30px_60px_-30px_rgba(11,42,30,0.35)]">
                  <div className="relative aspect-[16/11] overflow-hidden">
                    <img
                      src={p.img}
                      alt={p.nome}
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-[1.2s] ease-out group-hover/spot:scale-110"
                    />
                    <span
                      className={cn(
                        'absolute top-3 right-3 rounded-full px-3 py-1 text-[11px] font-semibold text-white shadow-lg',
                        p.tagClass,
                      )}
                    >
                      {p.tag}
                    </span>
                    <span className="absolute top-3 left-3 rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-forest-900/70 uppercase backdrop-blur">
                      {p.linha}
                    </span>
                  </div>
                  <div className="relative flex flex-1 flex-col p-6">
                    <h3 className="text-lg font-semibold">{p.nome}</h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-forest-900/60">
                      {p.texto}
                    </p>
                    <div className="mt-5 flex items-center justify-between border-t border-forest-900/6 pt-4">
                      <span className="flex items-center gap-2 text-xs text-forest-900/50">
                        <Package className="size-3.5" />
                        Caixa c/ 4 caixinhas
                      </span>
                      <a
                        href={whatsappLink(`Olá! Gostaria de uma cotação do ${p.nome}.`)}
                        target="_blank"
                        rel="noopener"
                        className="text-xs font-semibold text-ember transition hover:text-ember-600"
                      >
                        Cotar →
                      </a>
                    </div>
                  </div>
                </SpotlightCard>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        <Compare />
      </div>
    </section>
  )
}

const CULTIVOS = {
  hidro: {
    nome: 'Hidropônico',
    icon: Droplets,
    texto:
      'Cultivado 100% em água enriquecida com nutrientes. Sem solo, sem resíduo, máxima uniformidade de tamanho e aparência.',
    barras: [
      { l: 'Uniformidade', v: 1 },
      { l: 'Sabor acentuado', v: 0.72 },
      { l: 'Custo-benefício', v: 0.6 },
    ],
  },
  semi: {
    nome: 'Semi Hidropônico',
    icon: Sprout,
    texto:
      'Combina substrato com irrigação controlada. Sabor mais acentuado, boa uniformidade e melhor custo-benefício do que o hidropônico puro.',
    barras: [
      { l: 'Uniformidade', v: 0.8 },
      { l: 'Sabor acentuado', v: 1 },
      { l: 'Custo-benefício', v: 0.9 },
    ],
  },
}

function Compare() {
  const [tipo, setTipo] = useState<keyof typeof CULTIVOS>('hidro')
  const atual = CULTIVOS[tipo]

  return (
    <Reveal className="grain relative mt-20 overflow-hidden rounded-[32px] bg-forest-900 p-8 text-white md:p-14">
      <div className="pointer-events-none absolute -right-32 -bottom-32 size-[420px] rounded-full bg-lime/15 blur-[100px]" />
      <div className="relative grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <span className="text-[11px] font-semibold tracking-[0.28em] text-ember uppercase">
            Entenda a diferença
          </span>
          <h3 className="mt-4 text-3xl leading-tight font-bold md:text-4xl">
            Hidropônico <em className="font-serif font-normal text-cream/60 italic">vs.</em> Semi
            Hidropônico
          </h3>
          <p className="mt-4 max-w-md leading-relaxed text-cream/65">
            Ambos são cultivados em ambiente controlado, com mais uniformidade e higiene do que o
            cultivo convencional.
          </p>
          <div className="mt-8 inline-flex rounded-full border border-white/10 bg-white/5 p-1">
            {(Object.keys(CULTIVOS) as (keyof typeof CULTIVOS)[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTipo(k)}
                className={cn(
                  'relative rounded-full px-5 py-2.5 text-sm font-medium transition-colors',
                  tipo === k ? 'text-forest-900' : 'text-cream/70 hover:text-white',
                )}
              >
                {tipo === k && (
                  <motion.span
                    layoutId="cultivo-pill"
                    className="absolute inset-0 rounded-full bg-cream"
                    transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                  />
                )}
                <span className="relative">{CULTIVOS[k].nome}</span>
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tipo}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur"
          >
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-ember/15 text-ember">
                <atual.icon className="size-5" />
              </span>
              <h4 className="text-xl font-semibold">{atual.nome}</h4>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-cream/70">{atual.texto}</p>
            <div className="mt-7 space-y-4">
              {atual.barras.map((b, i) => (
                <div key={b.l}>
                  <div className="text-xs text-cream/55">{b.l}</div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-lime to-ember"
                      initial={{ width: 0 }}
                      animate={{ width: `${b.v * 100}%` }}
                      transition={{ duration: 0.9, delay: 0.1 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </Reveal>
  )
}
