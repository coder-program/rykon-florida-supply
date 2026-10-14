import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUpRight, Lock, X } from 'lucide-react'
import { PERFIS } from '../data/content'
import { perfilUrl, SISTEMA_URL } from '../lib/config'
import { lockScroll } from '../lib/smoothScroll'
import logoIcon from '../assets/img/logo-icon.png'

const host = SISTEMA_URL.replace(/^https?:\/\//, '')

export function AccessModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const firstRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    if (!open) return
    lockScroll(true)
    const t = setTimeout(() => firstRef.current?.focus(), 250)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      lockScroll(false)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          data-lenis-prevent
        >
          <div className="absolute inset-0 bg-forest-950/80 backdrop-blur-xl" onClick={onClose} />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="access-title"
            className="relative grid w-full max-w-4xl grid-cols-1 overflow-hidden rounded-[28px] bg-cream-50 shadow-2xl md:grid-cols-[0.9fr_1.1fr]"
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* lado da marca */}
            <div className="grain relative hidden flex-col justify-between overflow-hidden bg-forest-900 p-10 text-white md:flex">
              <div className="absolute -top-24 -left-24 size-72 rounded-full bg-ember/30 blur-3xl" />
              <div className="absolute -right-20 -bottom-28 size-80 rounded-full bg-lime/20 blur-3xl" />
              <div className="relative">
                <div className="grid size-14 place-items-center rounded-2xl bg-cream p-2.5">
                  <img src={logoIcon} alt="" className="h-full w-auto" />
                </div>
                <p className="mt-8 text-[11px] font-semibold tracking-[0.28em] text-ember uppercase">
                  Plataforma
                </p>
                <h3 className="mt-3 text-3xl leading-tight font-bold">
                  Florida Supply{' '}
                  <em className="font-serif font-normal text-cream italic">conectada</em>
                </h3>
                <p className="mt-4 text-sm leading-relaxed text-cream/65">
                  Pedidos, estoque, rotas e entregas em um só lugar. Cada perfil tem a sua área, com
                  acesso seguro.
                </p>
              </div>
              <div className="relative mt-10 flex items-center gap-2 font-mono text-xs text-cream/50">
                <Lock className="size-3.5" />
                {host}
              </div>
            </div>

            {/* perfis */}
            <div className="relative min-w-0 p-6 sm:p-10">
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="absolute top-4 right-4 grid size-10 place-items-center rounded-full text-forest-900/60 transition hover:bg-forest-900/5 hover:text-forest-900"
              >
                <X className="size-5" />
              </button>
              <h2 id="access-title" className="pr-10 text-2xl font-bold tracking-tight sm:text-3xl">
                Acessar o sistema
              </h2>
              <p className="mt-2 text-sm text-forest-900/60">
                Escolha o seu perfil para continuar.
              </p>

              <ul className="mt-7 grid grid-cols-1 gap-3">
                {PERFIS.map((p, i) => (
                  <motion.li
                    key={p.id}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + i * 0.07, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <a
                      ref={i === 0 ? firstRef : undefined}
                      href={perfilUrl(p.id)}
                      className="group flex items-center gap-4 rounded-2xl border border-forest-900/8 bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-ember/50 hover:shadow-[0_12px_30px_-12px_rgba(11,42,30,0.25)] focus-visible:border-ember"
                    >
                      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-forest-900 text-cream transition-colors duration-300 group-hover:bg-ember">
                        <p.icon className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{p.nome}</span>
                        <span className="block text-[13px] leading-snug text-forest-900/55 sm:truncate">
                          {p.descricao}
                        </span>
                        <span className="mt-1 block truncate font-mono text-[11px] text-forest-900/35">
                          <span className="hidden sm:inline">{host}</span>/{p.id}
                        </span>
                      </span>
                      <ArrowUpRight className="size-5 shrink-0 text-forest-900/30 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ember" />
                    </a>
                  </motion.li>
                ))}
              </ul>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
