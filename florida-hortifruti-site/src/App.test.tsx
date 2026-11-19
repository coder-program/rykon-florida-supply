import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MotionGlobalConfig } from 'motion/react'
import App from './App'
import { AccessProvider } from './components/AccessProvider'
import { OrderCard } from './components/OrderCard'
import { useAccess } from './lib/access'
import { perfilUrl, whatsappLink } from './lib/config'

// Animações terminam na hora: o jsdom não tem quadros de animação de verdade
MotionGlobalConfig.skipAnimations = true

const lenis = vi.hoisted(() => ({
  raf: vi.fn(),
  scrollTo: vi.fn(),
  destroy: vi.fn(),
  stop: vi.fn(),
  start: vi.fn(),
}))
vi.mock('lenis', () => ({
  default: vi.fn(function () {
    return lenis
  }),
}))

// IntersectionObserver que já "vê" tudo: dispara as animações de entrada e o menu ativo
class VeTudo {
  private cb: IntersectionObserverCallback
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb
  }
  observe(el: Element) {
    queueMicrotask(() =>
      this.cb([{ isIntersecting: true, target: el, intersectionRatio: 1 } as never], this as never),
    )
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}

function reduzirMovimento(sim: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (q: string) =>
      ({
        matches: sim && q.includes('reduce'),
        media: q,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
      }) as never,
  )
}

describe('site', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.stubGlobal('IntersectionObserver', VeTudo)
    reduzirMovimento(false)
    window.history.pushState({}, '', '/')
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('janela de acesso pelo botão, fecha com Esc e pelo X', async () => {
    render(<App />)
    await act(() => vi.advanceTimersByTimeAsync(300))
    fireEvent.click(screen.getAllByRole('button', { name: /Acessar sistema/ })[0])
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getAllByRole('link')[0].getAttribute('href')).toBe(perfilUrl('admin'))
    await act(() => vi.advanceTimersByTimeAsync(300))
    fireEvent.keyDown(window, { key: 'Enter' })
    fireEvent.keyDown(window, { key: 'Escape' })
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getAllByRole('button', { name: /Acessar sistema/ })[0])
    fireEvent.click(await screen.findByRole('button', { name: 'Fechar' }))
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(lenis.stop).toHaveBeenCalled()
    expect(lenis.start).toHaveBeenCalled()
  })

  it('rota /acessar abre a janela e fechar volta para o início', async () => {
    window.history.pushState({}, '', '/acessar')
    render(<App />)
    expect(await screen.findByRole('dialog')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(window.location.pathname).toBe('/')
  })

  it('menu do celular, links internos e rolagem suave', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu' }))
    const menu = screen.getByRole('navigation', { name: 'Menu' })
    fireEvent.click(within(menu).getAllByRole('link')[0])
    expect(lenis.scrollTo).toHaveBeenCalled()
    await act(() => vi.advanceTimersByTimeAsync(1000))

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Fechar menu' }))
    await act(() => vi.advanceTimersByTimeAsync(1000))
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu' }))
    const botoes = screen.getAllByRole('button', { name: /Acessar sistema/ })
    fireEvent.click(botoes[botoes.length - 1])
    expect(await screen.findByRole('dialog')).toBeTruthy()

    // Topo, âncora inexistente e clique fora de link
    fireEvent.click(screen.getAllByLabelText(/início/)[0])
    expect(lenis.scrollTo).toHaveBeenCalledWith(0)
    const falso = document.createElement('a')
    falso.setAttribute('href', '#nao-existe')
    document.body.appendChild(falso)
    fireEvent.click(falso)
    fireEvent.click(document.body)
  })

  it('catálogo, cultivo, perguntas e depoimentos', async () => {
    render(<App />)
    for (const filtro of screen
      .getAllByRole('button')
      .filter((b) => /^(Todos|Hidrop|Semi|Org|Caixa|Morango)/.test(b.textContent ?? ''))) {
      fireEvent.click(filtro)
    }
    fireEvent.click(screen.getAllByRole('button', { name: /Semi/ }).at(-1)!)

    const pergunta = screen.getAllByRole('button', { expanded: true })[0]
    fireEvent.click(pergunta)
    expect(pergunta.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(pergunta)

    const dots = screen.getAllByRole('button', { name: /Depoimento de/ })
    fireEvent.click(dots[1])
    await act(() => vi.advanceTimersByTimeAsync(20_000))
    const area = dots[0].closest('section')!.querySelector('[class*="max-w-4xl"]')!
    fireEvent.mouseEnter(area)
    await act(() => vi.advanceTimersByTimeAsync(20_000))
    fireEvent.mouseLeave(area)
  })

  it('formulário de cotação manda pelo WhatsApp', async () => {
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null)
    render(<App />)
    const enviar = screen.getByRole('button', { name: /Enviar|Solicitar/ })
    fireEvent.click(enviar)
    expect(abrir).not.toHaveBeenCalled()

    fireEvent.change(screen.getByPlaceholderText('Seu nome'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByPlaceholderText('Nome da empresa'), { target: { value: 'Doce' } })
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: screen.getAllByRole('option')[1].textContent },
    })
    const tel = screen.getByPlaceholderText('(11) 99999-9999') as HTMLInputElement
    for (const [digitado, esperado] of [
      ['11', '11'],
      ['119', '(11) 9'],
      ['1191234567', '(11) 9123-4567'],
      ['11912345678', '(11) 91234-5678'],
    ]) {
      fireEvent.change(tel, { target: { value: digitado } })
      expect(tel.value).toBe(esperado)
    }
    fireEvent.click(enviar)
    expect(abrir.mock.calls[0][0]).not.toContain('E-mail')

    // Troca de tela espera a animação de saída (AnimatePresence mode=wait)
    fireEvent.click(await screen.findByRole('button', { name: /outra/i }, { timeout: 10_000 }))
    fireEvent.change(await screen.findByPlaceholderText('seu@email.com', {}, { timeout: 10_000 }), {
      target: { value: 'a@a' },
    })
    fireEvent.change(screen.getByPlaceholderText(/Descreva/), { target: { value: '10 caixas' } })
    // O formulário volta vazio depois de enviar
    fireEvent.change(screen.getByPlaceholderText('Seu nome'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByPlaceholderText('Nome da empresa'), { target: { value: 'Doce' } })
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: screen.getAllByRole('option')[1].textContent },
    })
    fireEvent.change(screen.getByPlaceholderText('(11) 99999-9999'), {
      target: { value: '11999998888' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Enviar|Solicitar/ }))
    expect(decodeURIComponent(abrir.mock.calls[1][0] as string)).toContain('*Mensagem:* 10 caixas')
  })

  it('com movimento reduzido não anima nem usa rolagem suave', async () => {
    reduzirMovimento(true)
    lenis.scrollTo.mockClear()
    render(<App />)
    fireEvent.click(screen.getAllByLabelText(/início/)[0])
    fireEvent.click(
      screen.getByRole('navigation', { name: 'Navegação principal' }).querySelector('a')!,
    )
    expect(lenis.scrollTo).not.toHaveBeenCalled()
    render(<OrderCard tone="solid" />)
  })

  it('useAccess fora do provider avisa', () => {
    function Quebra() {
      useAccess()
      return null
    }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Quebra />)).toThrow('AccessProvider')
    render(
      <MemoryRouter>
        <AccessProvider>
          <span>ok</span>
        </AccessProvider>
      </MemoryRouter>,
    )
    expect(whatsappLink('oi')).toContain('text=oi')
  })
})
