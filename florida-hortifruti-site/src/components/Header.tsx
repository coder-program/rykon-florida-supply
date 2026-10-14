import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react'
import { LogIn, Menu, X } from 'lucide-react'
import { NAV } from '../data/content'
import { useAccess } from '../lib/access'
import { whatsappLink } from '../lib/config'
import { lockScroll } from '../lib/smoothScroll'
import { cn } from '../lib/utils'
import { Button, LinkButton } from './ui/Button'
import { WhatsappIcon } from './ui/WhatsappIcon'
import logoIcon from '../assets/img/logo-icon.png'

function useActiveSection() {
  const [active, setActive] = useState('')
  useEffect(() => {
    const ids = NAV.map((n) => n.href.slice(1))
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length) setActive(`#${visible[0].target.id}`)
      },
      { rootMargin: '-45% 0px -50% 0px' },
    )
    ids.forEach((id) => {
      const el = document.getElementById(id)
      if (el) io.observe(el)
    })
    return () => io.disconnect()
  }, [])
  return active
}

export function Brand({ subtitle = 'HORTIFRUTI' }: { subtitle?: string }) {
  return (
    <a
      href="#topo"
      className="flex items-center gap-3"
      aria-label="Florida Supply Hortifruti — início"
    >
      <span className="grid size-10 place-items-center rounded-xl bg-cream p-1.5 shadow-[0_6px_20px_-8px_rgba(0,0,0,0.5)]">
        <img src={logoIcon} alt="" className="h-full w-auto" />
      </span>
      <span className="flex flex-col leading-none">
        <strong className="text-[15px] font-bold text-white">Florida Supply</strong>
        <small className="mt-1 text-[9px] font-medium tracking-[0.24em] text-cream/60">
          {subtitle}
        </small>
      </span>
    </a>
  )
}

export function Header() {
  const { open: openAccess } = useAccess()
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)
  const [menu, setMenu] = useState(false)
  const active = useActiveSection()

  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 24))

  useEffect(() => {
    lockScroll(menu)
  }, [menu])

  return (
    <>
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        className="fixed inset-x-0 top-0 z-50 px-3 pt-3"
      >
        <div
          className={cn(
            'mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-4 rounded-2xl px-4 transition-all duration-500 md:px-5',
            scrolled || menu
              ? 'border border-white/10 bg-forest-950/90 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl'
              : 'border border-transparent bg-transparent',
          )}
        >
          <Brand />

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegação principal">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  'relative rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors',
                  active === item.href ? 'text-white' : 'text-white/65 hover:text-white',
                )}
              >
                {active === item.href && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 -z-10 rounded-full bg-white/10"
                    transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                  />
                )}
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button
              variant="glass"
              size="sm"
              onClick={openAccess}
              className="hidden sm:inline-flex"
            >
              <LogIn className="size-4" />
              Acessar sistema
            </Button>
            <LinkButton
              href={whatsappLink()}
              target="_blank"
              rel="noopener"
              size="sm"
              className="hidden md:inline-flex"
            >
              <WhatsappIcon />
              Fale no WhatsApp
            </LinkButton>
            <button
              type="button"
              onClick={() => setMenu((m) => !m)}
              className="grid size-10 place-items-center rounded-full text-white transition hover:bg-white/10 lg:hidden"
              aria-label={menu ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={menu}
            >
              {menu ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {menu && (
          <motion.div
            className="grain fixed inset-0 z-40 flex flex-col bg-forest-950 px-6 pt-28 pb-10 lg:hidden"
            initial={{ clipPath: 'circle(0% at 100% 0%)' }}
            animate={{ clipPath: 'circle(150% at 100% 0%)' }}
            exit={{ clipPath: 'circle(0% at 100% 0%)' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <nav className="flex flex-col" aria-label="Menu">
              {NAV.map((item, i) => (
                <motion.a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenu(false)}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.05 }}
                  className="flex items-baseline gap-4 border-b border-white/8 py-4 text-3xl font-semibold text-white"
                >
                  <span className="font-mono text-xs text-ember">0{i + 1}</span>
                  {item.label}
                </motion.a>
              ))}
            </nav>
            <div className="mt-auto grid gap-3">
              <Button
                variant="glass"
                size="lg"
                onClick={() => {
                  setMenu(false)
                  openAccess()
                }}
              >
                <LogIn className="size-4" />
                Acessar sistema
              </Button>
              <LinkButton href={whatsappLink()} target="_blank" rel="noopener" size="lg">
                <WhatsappIcon />
                Fale no WhatsApp
              </LinkButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
