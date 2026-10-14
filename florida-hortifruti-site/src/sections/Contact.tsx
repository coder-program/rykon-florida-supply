import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, AtSign, Camera, CheckCircle2, ChevronDown, MapPin } from 'lucide-react'
import { SEGMENTOS_FORM } from '../data/content'
import { EMAIL, INSTAGRAM, whatsappLink, WHATSAPP_LABEL } from '../lib/config'
import { cn } from '../lib/utils'
import { Button } from '../components/ui/Button'
import { Reveal } from '../components/ui/Reveal'
import { Accent, SectionHeading } from '../components/ui/SectionHeading'
import { WhatsappIcon } from '../components/ui/WhatsappIcon'

type Campos = {
  nome: string
  empresa: string
  segmento: string
  whatsapp: string
  email: string
  mensagem: string
}
const VAZIO: Campos = { nome: '', empresa: '', segmento: '', whatsapp: '', email: '', mensagem: '' }
const OBRIGATORIOS: (keyof Campos)[] = ['nome', 'empresa', 'segmento', 'whatsapp']

function mascaraTelefone(v: string) {
  const n = v.replace(/\D/g, '').slice(0, 11)
  if (n.length > 10) return n.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
  if (n.length > 6) return n.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
  if (n.length > 2) return n.replace(/(\d{2})(\d{0,5})/, '($1) $2')
  return n
}

const CANAIS: { icon: ReactNode; titulo: string; valor: string; extra?: string; href?: string }[] =
  [
    {
      icon: <WhatsappIcon className="size-5" />,
      titulo: 'WhatsApp',
      valor: WHATSAPP_LABEL,
      href: whatsappLink(),
    },
    {
      icon: <AtSign className="size-5" />,
      titulo: 'E-mail',
      valor: EMAIL,
      href: `mailto:${EMAIL}`,
    },
    {
      icon: <Camera className="size-5" />,
      titulo: 'Instagram',
      valor: `@${INSTAGRAM}`,
      href: `https://instagram.com/${INSTAGRAM}`,
    },
    {
      icon: <MapPin className="size-5" />,
      titulo: 'Centro de Distribuição',
      valor: 'Jardim Aldir, Barueri – SP',
      extra: 'Escritório: Alphaville, Barueri',
    },
  ]

export function Contact() {
  const [form, setForm] = useState<Campos>(VAZIO)
  const [erros, setErros] = useState<Partial<Record<keyof Campos, boolean>>>({})
  const [enviado, setEnviado] = useState(false)

  function set(campo: keyof Campos) {
    return (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const valor = campo === 'whatsapp' ? mascaraTelefone(e.target.value) : e.target.value
      setForm((f) => ({ ...f, [campo]: valor }))
      setErros((er) => ({ ...er, [campo]: false }))
    }
  }

  function enviar(e: FormEvent) {
    e.preventDefault()
    const faltando = Object.fromEntries(
      OBRIGATORIOS.filter((c) => !form[c].trim()).map((c) => [c, true]),
    )
    setErros(faltando)
    if (Object.keys(faltando).length) return

    const linhas = [
      `*Nome:* ${form.nome}`,
      `*Empresa:* ${form.empresa}`,
      `*Segmento:* ${form.segmento}`,
      `*WhatsApp:* ${form.whatsapp}`,
      form.email && `*E-mail:* ${form.email}`,
      form.mensagem && `*Mensagem:* ${form.mensagem}`,
    ].filter(Boolean)
    window.open(
      whatsappLink(['Olá! Gostaria de solicitar uma cotação.', '', ...linhas].join('\n')),
      '_blank',
      'noopener',
    )
    setEnviado(true)
    setForm(VAZIO)
  }

  const campo = (k: keyof Campos) =>
    cn(
      'w-full rounded-xl border bg-cream-50 px-4 py-3.5 text-sm text-forest-900 transition-all outline-none placeholder:text-forest-900/35 focus:bg-white focus:ring-4 focus:ring-ember/10',
      erros[k] ? 'border-ember' : 'border-forest-900/10 focus:border-ember',
    )

  return (
    <section
      id="contato"
      className="grain relative overflow-hidden bg-forest-900 py-28 text-white md:py-36"
    >
      <div className="pointer-events-none absolute -top-40 left-1/2 size-[800px] -translate-x-1/2 rounded-full bg-ember/12 blur-[160px]" />

      <div className="container-site relative">
        <SectionHeading
          tone="dark"
          eyebrow="Fale com a gente"
          title={
            <>
              Pronto para fazer <Accent>um pedido?</Accent>
            </>
          }
          subtitle="Entre em contato pelo canal que preferir. Respondemos rápido."
        />

        <div className="mt-16 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="grid content-start gap-3">
            {CANAIS.map((c, i) => {
              const inner = (
                <>
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/8 text-cream transition-colors duration-300 group-hover:bg-ember group-hover:text-white">
                    {c.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white">{c.titulo}</span>
                    <span className="block truncate text-sm text-cream/65">{c.valor}</span>
                    {c.extra && <span className="block text-xs text-cream/45">{c.extra}</span>}
                  </span>
                  {c.href && (
                    <ArrowRight className="ml-auto size-4 shrink-0 text-cream/30 transition-all group-hover:translate-x-1 group-hover:text-ember" />
                  )}
                </>
              )
              const cls =
                'group flex items-center gap-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4 transition-all duration-300 hover:border-white/15 hover:bg-white/[0.06]'
              return (
                <Reveal key={c.titulo} delay={i * 0.06}>
                  {c.href ? (
                    <a
                      href={c.href}
                      target={c.href.startsWith('http') ? '_blank' : undefined}
                      rel="noopener"
                      className={cls}
                    >
                      {inner}
                    </a>
                  ) : (
                    <div className={cls}>{inner}</div>
                  )}
                </Reveal>
              )
            })}
            <Reveal delay={0.3}>
              <div className="h-56 overflow-hidden rounded-2xl border border-white/8">
                <iframe
                  title="Mapa — Jardim Aldir, Barueri"
                  src="https://www.google.com/maps?q=Jardim+Aldir,+Barueri+-+SP&output=embed"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="size-full grayscale-[0.6] invert-[0.9] hue-rotate-180"
                />
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.1}>
            <div className="relative h-full overflow-hidden rounded-[28px] bg-white p-7 text-forest-900 md:p-10">
              <AnimatePresence mode="wait">
                {enviado ? (
                  <motion.div
                    key="ok"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex h-full min-h-[480px] flex-col items-center justify-center text-center"
                  >
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.1 }}
                    >
                      <CheckCircle2 className="size-16 text-ember" strokeWidth={1.5} />
                    </motion.span>
                    <h3 className="mt-6 text-2xl font-bold">Solicitação pronta!</h3>
                    <p className="mt-2 max-w-sm text-forest-900/60">
                      Abrimos o WhatsApp com a sua mensagem preenchida. É só enviar que a gente
                      responde rapidinho.
                    </p>
                    <button
                      type="button"
                      onClick={() => setEnviado(false)}
                      className="mt-8 text-sm font-semibold text-ember hover:underline"
                    >
                      Fazer outra solicitação
                    </button>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    onSubmit={enviar}
                    noValidate
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <h3 className="text-2xl font-bold">Solicitar cotação</h3>
                    <p className="mt-1 text-sm text-forest-900/50">
                      Preencha e entraremos em contato
                    </p>

                    <div className="mt-8 grid gap-4 sm:grid-cols-2">
                      <label className="grid gap-2 text-xs font-semibold">
                        Nome *
                        <input
                          value={form.nome}
                          onChange={set('nome')}
                          placeholder="Seu nome"
                          autoComplete="name"
                          className={campo('nome')}
                        />
                      </label>
                      <label className="grid gap-2 text-xs font-semibold">
                        Empresa *
                        <input
                          value={form.empresa}
                          onChange={set('empresa')}
                          placeholder="Nome da empresa"
                          autoComplete="organization"
                          className={campo('empresa')}
                        />
                      </label>
                      <label className="grid gap-2 text-xs font-semibold sm:col-span-2">
                        Segmento *
                        <span className="relative">
                          <select
                            value={form.segmento}
                            onChange={set('segmento')}
                            className={cn(
                              campo('segmento'),
                              'appearance-none pr-10',
                              !form.segmento && 'text-forest-900/35',
                            )}
                          >
                            <option value="">Selecione seu segmento</option>
                            {SEGMENTOS_FORM.map((s) => (
                              <option key={s} className="text-forest-900">
                                {s}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-forest-900/40" />
                        </span>
                      </label>
                      <label className="grid gap-2 text-xs font-semibold">
                        WhatsApp *
                        <input
                          value={form.whatsapp}
                          onChange={set('whatsapp')}
                          placeholder="(11) 99999-9999"
                          inputMode="tel"
                          autoComplete="tel"
                          className={campo('whatsapp')}
                        />
                      </label>
                      <label className="grid gap-2 text-xs font-semibold">
                        E-mail
                        <input
                          type="email"
                          value={form.email}
                          onChange={set('email')}
                          placeholder="seu@email.com"
                          autoComplete="email"
                          className={campo('email')}
                        />
                      </label>
                      <label className="grid gap-2 text-xs font-semibold sm:col-span-2">
                        Mensagem
                        <textarea
                          value={form.mensagem}
                          onChange={set('mensagem')}
                          rows={4}
                          placeholder="Descreva o que precisa: produto, volume, frequência de entrega..."
                          className={cn(campo('mensagem'), 'resize-none')}
                        />
                      </label>
                    </div>

                    <AnimatePresence>
                      {Object.values(erros).some(Boolean) && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-4 text-sm text-ember"
                          role="alert"
                        >
                          Preencha os campos obrigatórios (*).
                        </motion.p>
                      )}
                    </AnimatePresence>

                    <Button type="submit" variant="dark" size="lg" className="mt-7 w-full">
                      Enviar solicitação
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                    <p className="mt-4 text-center text-xs text-forest-900/45">
                      Ou fale diretamente pelo WhatsApp{' '}
                      <a
                        href={whatsappLink()}
                        target="_blank"
                        rel="noopener"
                        className="font-semibold text-forest-900 hover:text-ember"
                      >
                        {WHATSAPP_LABEL}
                      </a>
                    </p>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
