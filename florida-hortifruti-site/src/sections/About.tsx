import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'motion/react'
import { MapPin } from 'lucide-react'
import { DIFERENCIAIS } from '../data/content'
import { Reveal } from '../components/ui/Reveal'
import { Accent } from '../components/ui/SectionHeading'
import { SpotlightCard } from '../components/ui/SpotlightCard'
import fazenda from '../assets/img/fazenda-mg.jpg'

export function About() {
  const imgRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: imgRef, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], ['-12%', '12%'])

  return (
    <section id="quem-somos" className="relative overflow-hidden bg-cream-50 py-28 md:py-36">
      <div className="pointer-events-none absolute -top-40 right-0 size-[600px] rounded-full bg-lime/10 blur-[140px]" />

      <div className="container-site relative grid items-center gap-16 lg:grid-cols-2 lg:gap-20">
        <div>
          <Reveal>
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.28em] text-ember uppercase">
              <span className="h-px w-6 bg-ember/60" />
              Quem somos
            </span>
            <h2 className="mt-5 text-4xl leading-[1.05] font-bold tracking-tight text-balance md:text-5xl lg:text-[3.5rem]">
              Especialistas em <Accent>morango</Accent> para o mercado B2B
            </h2>
          </Reveal>
          <Reveal
            delay={0.1}
            className="mt-8 space-y-5 text-[15.5px] leading-[1.85] text-forest-900/70"
          >
            <p>
              A <strong className="font-semibold text-forest-900">Florida Supply Hortifruti</strong>{' '}
              é uma distribuidora especializada em morangos frescos para empresas. Nosso escritório
              fica em Alphaville e o centro de distribuição no Jardim Aldir, em Barueri (SP).
            </p>
            <p>
              Trabalhamos com uma fazenda parceira em Minas Gerais — isso garante que o morango
              chegue fresco, selecionado e com procedência conhecida. Nosso foco são confeitarias,
              padarias, sorveterias, restaurantes, cantinas, food service e revendas.
            </p>
          </Reveal>
        </div>

        <motion.div
          ref={imgRef}
          className="relative aspect-[4/3.4] overflow-hidden rounded-[28px] shadow-[0_40px_100px_-40px_rgba(11,42,30,0.5)]"
          initial={{ clipPath: 'inset(12% 12% 12% 12% round 28px)', opacity: 0 }}
          whileInView={{ clipPath: 'inset(0% 0% 0% 0% round 28px)', opacity: 1 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.img
            src={fazenda}
            alt="Montanhas e plantações da fazenda parceira em Minas Gerais"
            loading="lazy"
            style={{ y, scale: 1.25 }}
            className="size-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-forest-950/50 via-transparent to-transparent" />
          <div className="absolute bottom-5 left-5 flex items-center gap-3 rounded-2xl border border-white/15 bg-forest-950/60 px-4 py-3 text-white backdrop-blur-xl">
            <span className="grid size-9 place-items-center rounded-xl bg-ember text-white">
              <MapPin className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold">Fazenda parceira</p>
              <p className="text-xs text-cream/65">Minas Gerais</p>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="container-site relative mt-24 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {DIFERENCIAIS.map((d, i) => (
          <Reveal key={d.titulo} delay={i * 0.08}>
            <SpotlightCard className="h-full rounded-3xl border border-forest-900/6 bg-white p-7 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_30px_60px_-30px_rgba(11,42,30,0.3)]">
              <span className="relative grid size-12 place-items-center rounded-2xl bg-forest-900 text-cream transition-colors duration-500 group-hover/spot:bg-ember">
                <d.icon className="size-5" />
              </span>
              <h3 className="relative mt-6 text-lg font-semibold">{d.titulo}</h3>
              <p className="relative mt-2 text-sm leading-relaxed text-forest-900/60">{d.texto}</p>
              <span className="relative mt-6 block font-mono text-[11px] text-forest-900/25">
                0{i + 1}
              </span>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
