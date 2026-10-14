import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { motion, MotionConfig, useScroll, useSpring } from 'motion/react'
import { whatsappLink } from './lib/config'
import { initSmoothScroll, scrollToHash } from './lib/smoothScroll'
import { AccessProvider } from './components/AccessProvider'
import { Header } from './components/Header'
import { WhatsappIcon } from './components/ui/WhatsappIcon'
import { Hero } from './sections/Hero'
import { About } from './sections/About'
import { Segments } from './sections/Segments'
import { Products } from './sections/Products'
import { Process } from './sections/Process'
import { Platform } from './sections/Platform'
import { Delivery } from './sections/Delivery'
import { Testimonials } from './sections/Testimonials'
import { Faq } from './sections/Faq'
import { Contact } from './sections/Contact'
import { Footer } from './sections/Footer'

function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 40 })
  return (
    <motion.div
      className="fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-gradient-to-r from-lime via-ember to-ember"
      style={{ scaleX }}
    />
  )
}

function FloatingWhatsapp() {
  return (
    <motion.a
      href={whatsappLink()}
      target="_blank"
      rel="noopener"
      aria-label="Falar no WhatsApp"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 2.2, type: 'spring', stiffness: 260, damping: 18 }}
      className="fixed right-5 bottom-5 z-40 grid size-14 place-items-center rounded-full bg-[#25d366] text-white shadow-[0_12px_30px_-8px_rgba(37,211,102,0.7)] transition-transform hover:scale-110"
    >
      <span className="absolute inset-0 animate-pulse-ring rounded-full bg-[#25d366]" />
      <WhatsappIcon className="relative size-7" />
    </motion.a>
  )
}

function Home() {
  useEffect(() => {
    const stop = initSmoothScroll()

    // links internos (#secao) usam a rolagem suave
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]')
      if (!a) return
      e.preventDefault()
      scrollToHash(a.getAttribute('href')!)
    }
    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('click', onClick)
      stop()
    }
  }, [])

  return (
    <>
      <ScrollProgress />
      <Header />
      <main>
        <Hero />
        <About />
        <Segments />
        <Products />
        <Process />
        <Platform />
        <Delivery />
        <Testimonials />
        <Faq />
        <Contact />
      </main>
      <Footer />
      <FloatingWhatsapp />
    </>
  )
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        {/* página única; a rota /acessar só abre a janela de perfis por cima */}
        <AccessProvider>
          <Home />
        </AccessProvider>
      </BrowserRouter>
    </MotionConfig>
  )
}
