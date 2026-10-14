import { motion } from 'motion/react'
import { Truck } from 'lucide-react'
import { ENTREGA_ITENS } from '../data/content'
import { whatsappLink } from '../lib/config'
import { LinkButton } from '../components/ui/Button'
import { Reveal } from '../components/ui/Reveal'
import { Accent } from '../components/ui/SectionHeading'
import { WhatsappIcon } from '../components/ui/WhatsappIcon'
import caminhao from '../assets/img/caminhao.jpg'

const ROTA = 'M 40 150 C 140 40, 240 40, 300 110 S 460 190, 560 70'

const PONTOS = [
  { x: 40, y: 150, titulo: 'Fazenda', sub: 'Minas Gerais', cor: 'bg-lime' },
  { x: 300, y: 110, titulo: 'CD Barueri', sub: 'Jardim Aldir', cor: 'bg-ember' },
  { x: 560, y: 70, titulo: 'Sua operação', sub: 'Dia e hora combinados', cor: 'bg-forest-900' },
]

export function Delivery() {
  return (
    <section id="entregas" className="relative overflow-hidden bg-cream-100 py-28 md:py-36">
      <div className="container-site grid items-center gap-16 lg:grid-cols-2 lg:gap-20">
        <div>
          <Reveal>
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.28em] text-ember uppercase">
              <span className="h-px w-6 bg-ember/60" />
              Logística
            </span>
            <h2 className="mt-5 text-4xl leading-[1.05] font-bold tracking-tight text-balance md:text-5xl lg:text-[3.5rem]">
              Como funcionam as <Accent>entregas</Accent>
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="mt-7 space-y-5 leading-[1.85] text-forest-900/70">
            <p>
              Cada entrega é combinada diretamente com o cliente. Definimos juntos o{' '}
              <strong className="font-semibold text-forest-900">
                dia, horário, endereço e frequência
              </strong>{' '}
              que melhor se encaixam na rotina da sua operação.
            </p>
            <p>
              Não existe fórmula única. Se você precisa receber toda segunda e quinta antes das 7h,
              a gente se organiza para isso. Se prefere semanal ou quinzenal, também funciona. O
              foco é não deixar sua produção parar.
            </p>
          </Reveal>

          <ul className="mt-9 grid gap-3 sm:grid-cols-2">
            {ENTREGA_ITENS.map((it, i) => (
              <Reveal key={it.texto} delay={0.15 + i * 0.06}>
                <li className="flex h-full items-center gap-3 rounded-2xl border border-forest-900/6 bg-white/70 p-4 text-sm font-medium backdrop-blur">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-forest-900 text-cream">
                    <it.icon className="size-[18px]" />
                  </span>
                  {it.texto}
                </li>
              </Reveal>
            ))}
          </ul>

          <Reveal delay={0.3} className="mt-10">
            <LinkButton href={whatsappLink()} target="_blank" rel="noopener" size="lg">
              <WhatsappIcon className="size-5" />
              Pedir cotação agora
            </LinkButton>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <div className="overflow-hidden rounded-[32px] bg-forest-900 text-white shadow-[0_50px_100px_-40px_rgba(11,42,30,0.6)]">
            <div className="relative h-56 overflow-hidden md:h-64">
              <img
                src={caminhao}
                alt="Caminhão de entregas na estrada ao entardecer"
                loading="lazy"
                className="size-full object-cover object-[center_40%]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-forest-900 via-forest-900/20 to-transparent" />
              <div className="absolute bottom-4 left-6">
                <p className="text-[11px] font-semibold tracking-[0.2em] text-ember uppercase">
                  Centro de Distribuição
                </p>
                <p className="mt-1 text-lg font-semibold">Jardim Aldir, Barueri – SP</p>
              </div>
            </div>

            <div className="grain relative px-4 pt-4 pb-8 md:px-6">
              <svg viewBox="0 0 600 210" className="w-full overflow-visible" aria-hidden="true">
                <path
                  d={ROTA}
                  fill="none"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="2"
                  strokeDasharray="4 8"
                />
                <motion.path
                  d={ROTA}
                  fill="none"
                  stroke="url(#rota)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 2.2, ease: 'easeInOut', delay: 0.3 }}
                />
                <defs>
                  <linearGradient id="rota" x1="0" x2="1">
                    <stop offset="0%" stopColor="#a2a337" />
                    <stop offset="55%" stopColor="#e25a16" />
                    <stop offset="100%" stopColor="#f2e6d2" />
                  </linearGradient>
                  <filter id="glow" x="-1" y="-1" width="3" height="3">
                    <feGaussianBlur stdDeviation="6" />
                  </filter>
                </defs>
                {PONTOS.map((p) => (
                  <circle
                    key={p.titulo}
                    cx={p.x}
                    cy={p.y}
                    r="6"
                    fill="#f2e6d2"
                    stroke="#0b2a1e"
                    strokeWidth="3"
                  />
                ))}
                {/* caminhão percorrendo a rota */}
                <g>
                  <animateMotion
                    dur="6s"
                    repeatCount="indefinite"
                    path={ROTA}
                    keyPoints="0;1"
                    keyTimes="0;1"
                    calcMode="spline"
                    keySplines="0.45 0 0.55 1"
                  />
                  <circle r="22" fill="#e25a16" opacity="0.5" filter="url(#glow)" />
                  <circle r="17" fill="#e25a16" />
                  <Truck x={-9} y={-9} width={18} height={18} color="white" />
                </g>
              </svg>

              <div className="relative mt-2 grid grid-cols-3 gap-2 text-center sm:text-left">
                {PONTOS.map((p) => (
                  <div key={p.titulo}>
                    <span
                      className={`inline-block size-2 rounded-full ${p.cor} ring-4 ring-white/10`}
                    />
                    <p className="mt-2 text-sm font-semibold">{p.titulo}</p>
                    <p className="text-[11px] text-cream/55">{p.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
