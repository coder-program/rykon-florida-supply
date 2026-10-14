import { useRef, type MouseEvent } from 'react'
import { motion, useMotionValue, useScroll, useSpring, useTransform } from 'motion/react'
import { ArrowDown, ArrowRight, MapPin } from 'lucide-react'
import { SEGMENTOS } from '../data/content'
import { whatsappLink } from '../lib/config'
import { LinkButton } from '../components/ui/Button'
import { Counter } from '../components/ui/Counter'
import { QrGlyph } from '../components/ui/QrGlyph'
import { WhatsappIcon } from '../components/ui/WhatsappIcon'
import { OrderCard } from '../components/OrderCard'
import heroImg from '../assets/img/hero-morango.jpg'

const ease = [0.22, 1, 0.36, 1] as const

const LINHAS: { words: string[]; accent?: boolean }[] = [
  { words: ['Morango', 'fresco,'] },
  { words: ['direto', 'da', 'fazenda'], accent: true },
  { words: ['para', 'o', 'seu', 'negócio'] },
]

export function Hero() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '25%'])
  const bgScale = useTransform(scrollYProgress, [0, 1], [1.08, 1.2])
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '30%'])
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0])

  // inclinação dos cartões seguindo o mouse
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const rotY = useSpring(useTransform(mx, [-0.5, 0.5], [-10, 10]), { stiffness: 120, damping: 20 })
  const rotX = useSpring(useTransform(my, [-0.5, 0.5], [8, -8]), { stiffness: 120, damping: 20 })

  function onMove(e: MouseEvent) {
    mx.set(e.clientX / window.innerWidth - 0.5)
    my.set(e.clientY / window.innerHeight - 0.5)
  }

  let wordIndex = 0

  return (
    <section
      ref={ref}
      id="topo"
      onMouseMove={onMove}
      className="grain relative min-h-[100svh] overflow-hidden bg-forest-950 text-white"
    >
      {/* fundo */}
      <motion.div className="absolute inset-0" style={{ y: bgY, scale: bgScale }}>
        <img src={heroImg} alt="" className="size-full object-cover" fetchPriority="high" />
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-r from-forest-950 via-forest-950/85 to-forest-950/40" />
      <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-transparent to-forest-950/60" />
      <motion.div
        className="absolute top-1/3 -left-40 size-[520px] rounded-full bg-ember/25 blur-[120px]"
        animate={{ x: [0, 60, 0], y: [0, -40, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -top-20 right-0 size-[460px] rounded-full bg-lime/15 blur-[120px]"
        animate={{ x: [0, -50, 0], y: [0, 50, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* grade técnica sutil */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          maskImage: 'radial-gradient(ellipse at 70% 40%, black, transparent 70%)',
        }}
      />

      <div className="container-site relative z-10 grid min-h-[100svh] items-center gap-12 pt-28 pb-36 lg:grid-cols-[1.15fr_0.85fr]">
        <motion.div style={{ y: contentY, opacity: contentOpacity }}>
          <motion.span
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease, delay: 0.4 }}
            className="inline-flex items-center gap-2.5 rounded-full border border-ember/40 bg-ember/10 py-1.5 pr-4 pl-2 text-[13px] font-medium text-cream backdrop-blur-md"
          >
            <span className="grid size-6 place-items-center rounded-full bg-ember/20 text-xs">
              🍓
            </span>
            Distribuidora B2B de Morangos · Barueri, SP
          </motion.span>

          <h1 className="mt-7 text-[2.6rem] leading-[1.02] font-bold tracking-[-0.03em] sm:text-6xl lg:text-[4.1rem] xl:text-[4.5rem]">
            {LINHAS.map((linha) => (
              <span key={linha.words.join(' ')} className="block">
                {linha.words.map((w) => {
                  const i = wordIndex++
                  return (
                    <span key={w} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
                      <motion.span
                        className={
                          linha.accent
                            ? 'mr-[0.22em] inline-block font-serif font-normal tracking-normal text-ember italic'
                            : 'mr-[0.22em] inline-block'
                        }
                        initial={{ y: '110%' }}
                        animate={{ y: 0 }}
                        transition={{ duration: 1, ease, delay: 0.55 + i * 0.07 }}
                      >
                        {w}
                      </motion.span>
                    </span>
                  )
                })}
              </span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease, delay: 1.3 }}
            className="mt-7 max-w-xl text-base leading-relaxed text-cream/75 md:text-lg"
          >
            <span className="font-medium text-cream">Ingredientes que movem grandes negócios.</span>{' '}
            Da nossa fazenda parceira em Minas Gerais até a sua produção, com procedência, qualidade
            e pontualidade.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease, delay: 1.45 }}
            className="mt-9 flex flex-col gap-3 sm:flex-row"
          >
            <LinkButton href={whatsappLink()} target="_blank" rel="noopener" size="lg">
              <WhatsappIcon className="size-5" />
              Pedir cotação
            </LinkButton>
            <LinkButton href="#produtos" variant="glass" size="lg">
              Ver produtos
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </LinkButton>
          </motion.div>

          <motion.dl
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1.7 }}
            className="mt-12 grid max-w-lg grid-cols-3 divide-x divide-white/12"
          >
            {[
              { v: <Counter to={100} suffix="%" />, l: 'Procedência rastreada' },
              { v: 'B2B', l: 'Foco em empresas' },
              { v: 'MG', l: 'Fazenda parceira' },
            ].map((s, i) => (
              <div key={s.l} className={i === 0 ? 'pr-4' : 'px-4 sm:px-6'}>
                <dt className="text-2xl font-bold text-ember sm:text-3xl">{s.v}</dt>
                <dd className="mt-1 text-xs leading-snug text-cream/60 sm:text-[13px]">{s.l}</dd>
              </div>
            ))}
          </motion.dl>
        </motion.div>

        {/* cartões flutuantes */}
        <motion.div
          className="relative hidden h-[580px] lg:block"
          style={{ rotateX: rotX, rotateY: rotY, transformPerspective: 1200 }}
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1.2, ease, delay: 0.9 }}
        >
          <div className="absolute top-6 right-6 animate-float">
            <OrderCard />
          </div>

          <div
            className="absolute bottom-10 left-0 w-[250px] animate-float rounded-3xl border border-white/15 bg-white/[0.07] p-4 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] backdrop-blur-2xl"
            style={{ animationDelay: '-2s' }}
          >
            <p className="text-[10px] font-semibold tracking-[0.2em] text-cream/50 uppercase">
              Origem rastreada
            </p>
            <div className="mt-3 flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-lime/20 text-lime">
                <MapPin className="size-4" />
              </span>
              <div className="text-sm">
                <p className="font-semibold">Fazenda parceira</p>
                <p className="text-xs text-cream/55">Minas Gerais</p>
              </div>
            </div>
            <div className="relative my-2 ml-[18px] h-8 w-px bg-gradient-to-b from-lime/60 to-ember/60">
              <motion.span
                className="absolute -left-[3px] size-[7px] rounded-full bg-white shadow-[0_0_12px_white]"
                animate={{ top: ['0%', '100%'] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-ember/20 text-ember">
                <MapPin className="size-4" />
              </span>
              <div className="text-sm">
                <p className="font-semibold">CD Barueri</p>
                <p className="text-xs text-cream/55">Jardim Aldir, SP</p>
              </div>
            </div>
          </div>

          <div
            className="absolute right-0 bottom-0 flex animate-float items-center gap-3 rounded-2xl border border-white/15 bg-cream p-3 pr-5 text-forest-900 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)]"
            style={{ animationDelay: '-4s' }}
          >
            <QrGlyph className="size-14 text-forest-900" />
            <div>
              <p className="text-[10px] font-semibold tracking-[0.18em] text-forest-900/50 uppercase">
                Etiqueta
              </p>
              <p className="text-sm font-bold">QR Code por pedido</p>
              <p className="text-[11px] text-forest-900/55">Escaneie e acompanhe</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* faixa de segmentos */}
      <div className="absolute inset-x-0 bottom-0 z-10 border-t border-white/10 bg-forest-950/50 backdrop-blur-md">
        <div className="flex overflow-hidden py-4 [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
          <div className="flex shrink-0 animate-marquee items-center gap-10 pr-10">
            {[...SEGMENTOS, ...SEGMENTOS, ...SEGMENTOS, ...SEGMENTOS].map((s, i) => (
              <span
                key={i}
                className="flex items-center gap-10 text-sm font-medium whitespace-nowrap text-cream/55"
              >
                {s.titulo}
                <span className="size-1.5 rounded-full bg-ember/70" />
              </span>
            ))}
          </div>
        </div>
      </div>

      <a
        href="#quem-somos"
        aria-label="Rolar para baixo"
        className="absolute bottom-20 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-2 text-[11px] tracking-[0.2em] text-white/40 uppercase md:flex"
      >
        Scroll
        <motion.span animate={{ y: [0, 6, 0] }} transition={{ duration: 1.8, repeat: Infinity }}>
          <ArrowDown className="size-4" />
        </motion.span>
      </a>
    </section>
  )
}
