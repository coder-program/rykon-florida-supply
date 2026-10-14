import { motion } from 'motion/react'
import { LogIn, QrCode, ShoppingBasket, Store, Truck } from 'lucide-react'
import { useAccess } from '../lib/access'
import { Button } from '../components/ui/Button'
import { Reveal } from '../components/ui/Reveal'
import { Accent, SectionHeading } from '../components/ui/SectionHeading'
import { QrGlyph } from '../components/ui/QrGlyph'
import { SpotlightCard } from '../components/ui/SpotlightCard'
import { OrderCard } from '../components/OrderCard'

const RECURSOS = [
  {
    icon: Store,
    titulo: 'Para o cliente',
    texto: 'Acompanhe seus pedidos, entregas e histórico em tempo real, de qualquer lugar.',
  },
  {
    icon: ShoppingBasket,
    titulo: 'Para o vendedor',
    texto: 'Pedido registrado na hora, pelo celular, direto para conferência e aprovação.',
  },
  {
    icon: Truck,
    titulo: 'Para o motorista',
    texto: 'Rotas organizadas e confirmação de cada entrega no momento do recebimento.',
  },
  {
    icon: QrCode,
    titulo: 'Etiqueta com QR Code',
    texto: 'Cada pedido tem identificação única. Escaneou, viu produto, status e entrega.',
  },
]

export function Platform() {
  const { open } = useAccess()

  return (
    <section
      id="plataforma"
      className="grain relative overflow-hidden bg-forest-950 py-28 text-white md:py-36"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.7) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(ellipse at 30% 50%, black, transparent 65%)',
        }}
      />
      <div className="pointer-events-none absolute top-1/4 -left-40 size-[560px] rounded-full bg-ember/15 blur-[140px]" />

      <div className="container-site relative grid items-center gap-20 lg:grid-cols-2">
        {/* ilustração */}
        <div className="relative mx-auto h-[640px] w-full max-w-[460px]">
          <motion.div
            className="absolute top-0 left-1/2 w-[290px] -translate-x-1/2 rounded-[44px] border border-white/15 bg-forest-900 p-3 shadow-[0_60px_120px_-40px_rgba(0,0,0,0.8)]"
            initial={{ opacity: 0, y: 60 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="overflow-hidden rounded-[34px] bg-cream-50">
              <div className="flex items-center justify-between px-5 pt-3 pb-2 text-[10px] font-semibold text-forest-900">
                <span>09:41</span>
                <span className="h-5 w-20 rounded-full bg-forest-900" />
                <span>5G</span>
              </div>
              <div className="px-3 pb-4">
                <p className="px-2 pt-2 text-[11px] font-semibold tracking-[0.18em] text-forest-900/45 uppercase">
                  Meus pedidos
                </p>
                <OrderCard tone="solid" className="mt-2 w-full shadow-none" />
              </div>
            </div>
          </motion.div>

          {/* etiqueta térmica */}
          <motion.div
            className="absolute bottom-0 -left-2 w-[230px] rotate-[-6deg] rounded-2xl bg-white p-4 font-mono text-[10px] leading-relaxed text-forest-900 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.8)] sm:left-0"
            initial={{ opacity: 0, x: -40, rotate: -14 }}
            whileInView={{ opacity: 1, x: 0, rotate: -6 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-start justify-between gap-3 border-b border-dashed border-forest-900/20 pb-2">
              <div>
                <p className="font-sans text-[11px] font-bold">FLÓRIDA HORTIFRUTI</p>
                <p className="text-forest-900/50">PEDIDO Nº 000123</p>
              </div>
              <QrGlyph className="size-14 shrink-0" seed={21} />
            </div>
            <p className="pt-2">ENTREGA: seu endereço</p>
            <p>B2 — 30 caixas</p>
            <p>B3 — 20 caixas</p>
            <p className="text-forest-900/50">STATUS: SAIU P/ ENTREGA</p>
          </motion.div>

          <motion.div
            className="absolute right-0 bottom-16 hidden items-center gap-2 sm:flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-medium backdrop-blur-xl"
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6, type: 'spring' }}
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-lime opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-lime" />
            </span>
            Atualizado em tempo real
          </motion.div>
        </div>

        <div>
          <SectionHeading
            tone="dark"
            align="left"
            eyebrow="Plataforma"
            title={
              <>
                Tecnologia que acompanha <Accent>cada caixa</Accent>
              </>
            }
            subtitle="Do pedido à entrega, tudo passa pela nossa plataforma. Vendedor, cliente e motorista conectados, com cada pedido identificado por QR Code."
          />

          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {RECURSOS.map((r, i) => (
              <Reveal key={r.titulo} delay={i * 0.07}>
                <SpotlightCard
                  color="rgba(162,163,55,0.16)"
                  className="h-full rounded-2xl border border-white/8 bg-white/[0.03] p-5 transition-colors duration-500 hover:border-white/15"
                >
                  <r.icon className="relative size-5 text-ember" />
                  <h3 className="relative mt-4 font-semibold">{r.titulo}</h3>
                  <p className="relative mt-1.5 text-sm leading-relaxed text-cream/60">{r.texto}</p>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.2} className="mt-10">
            <Button size="lg" onClick={open}>
              <LogIn className="size-4" />
              Acessar o sistema
            </Button>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
