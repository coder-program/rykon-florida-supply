import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, renderHook, act } from '@testing-library/react'
import { api } from './lib/api'
import { apiFalsa, ErroApi } from './test/api-falsa'
import { logar, renderTela } from './test/render'
import { PainelPage } from './pages/PainelPage'
import { RastreioPage } from './pages/RastreioPage'
import { Paginacao } from './components/Paginacao'
import { usePaginado } from './lib/usePaginado'

let fake: ReturnType<typeof apiFalsa>
beforeEach(() => {
  logar()
  fake = apiFalsa(api)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const pedido = (extra: object) => ({
  id: 'p',
  numero: 1,
  status: 'APROVADO',
  data: '2026-11-20T12:00:00Z',
  itens: [{ quantidade: 2, nome: 'Morango' }],
  rastreioToken: null,
  ...extra,
})

describe('painel do cliente (só consulta)', () => {
  it('entregas em andamento, rota do motorista e entregues', async () => {
    fake.quando('GET /portal-cliente/pedidos', [
      pedido({ id: 'a', numero: 11, status: 'EM_ENTREGA', rastreioToken: 'tk1' }),
      pedido({ id: 'b', numero: 12, status: 'EM_SEPARACAO', rastreioToken: 'tk2', itens: null }),
      pedido({ id: 'c', numero: 13, status: 'AGUARDANDO_APROVACAO' }),
      pedido({ id: 'd', numero: 14, status: 'ENTREGUE', comprovante: { dataHora: '2026-11-21' } }),
      pedido({ id: 'e', numero: 15, status: 'ENTREGUE' }),
    ])
    renderTela(<PainelPage />)
    expect(await screen.findByText('Pedido #000011')).toBeTruthy()
    expect(screen.getByText('Ver a rota do motorista').closest('a')?.getAttribute('href')).toBe(
      '/rastreio/tk1',
    )
    expect(screen.getByText('Acompanhar entrega')).toBeTruthy()
    expect(screen.queryByText('Pedido #000013')).toBeNull()
    expect(screen.getByText('Entregues recentemente')).toBeTruthy()
    expect(screen.getByText('#000014')).toBeTruthy()
    // Nenhum botão de ação: só as abas
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.getAllByRole('tab')).toHaveLength(3)
  })

  it('sem entregas, estoque e lista de pedidos', async () => {
    fake.quando('GET /portal-cliente/pedidos', [])
    fake.quando('GET /portal-cliente/produtos', [
      {
        id: 'x',
        nome: 'Morango',
        unidadeVenda: 'CX',
        disponibilidade: 'DISPONIVEL',
        quantidadeAproximada: 12.4,
      },
      {
        id: 'y',
        nome: 'Uva',
        unidadeVenda: 'CX',
        disponibilidade: 'OUTRA',
        quantidadeAproximada: null,
      },
    ])
    renderTela(<PainelPage />)
    expect(await screen.findByText('Nenhuma entrega em andamento.')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: /Estoque/ }))
    expect(await screen.findByText('Morango')).toBeTruthy()
    expect(screen.getByText('~12 CX')).toBeTruthy()
    expect(screen.getByText('Indisponível')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: /Pedidos/ }))
    expect(screen.getByText('Nenhum pedido ainda.')).toBeTruthy()
  })

  it('estoque vazio e mais de 30 pedidos', async () => {
    fake.quando(
      'GET /portal-cliente/pedidos',
      Array.from({ length: 31 }, (_, i) => pedido({ id: `p${i}`, numero: i + 1 })),
    )
    fake.quando('GET /portal-cliente/produtos', [])
    renderTela(<PainelPage />)
    fireEvent.click(await screen.findByRole('tab', { name: /Pedidos/ }))
    expect(await screen.findByText('Ver todos os pedidos')).toBeTruthy()
    expect(screen.queryByText('#000031')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: /Estoque/ }))
    expect(await screen.findByText('Nenhum produto disponível.')).toBeTruthy()
  })
})

describe('rastreio público', () => {
  const abrir = () =>
    renderTela(<RastreioPage />, { rota: '/rastreio/tk', caminho: '/rastreio/:token' })
  const rastreio = (extra: object = {}) => ({
    numero: 7,
    status: 'EM_SEPARACAO',
    cliente: 'Mercado VV',
    entregueEm: null,
    historicoStatus: [{ status: 'APROVADO', alteradoEm: '2026-11-20T12:00:00Z' }],
    motorista: null,
    destino: null,
    ...extra,
  })

  it('link inválido', async () => {
    fake.quando('GET /p/:token/rastreio', new ErroApi(404))
    abrir()
    expect(await screen.findByText(/Pedido não encontrado/)).toBeTruthy()
  })

  it('andamento antes de sair para entrega', async () => {
    fake.quando('GET /p/:token/rastreio', rastreio())
    abrir()
    expect(await screen.findByText('Pedido #000007')).toBeTruthy()
    expect(fake.feitas('GET', '/p/tk/rastreio')).toHaveLength(1)
    expect(screen.queryByTitle('Posição do motorista')).toBeNull()
  })

  it('a caminho: mapa com o motorista e o destino', async () => {
    fake.quando(
      'GET /p/:token/rastreio',
      rastreio({
        status: 'EM_ENTREGA',
        motorista: {
          nome: 'Hugo',
          posicao: { latitude: -23.5, longitude: -46.6, atualizadoEm: '2026-11-20T13:00:00Z' },
        },
        destino: { latitude: -23.6, longitude: -46.7 },
      }),
    )
    abrir()
    expect(await screen.findByText('Hugo está a caminho')).toBeTruthy()
    const mapa = screen.getByTitle('Posição do motorista').getAttribute('src')!
    expect(mapa).toContain('marker=-23.5,-46.6')
    expect(mapa).toContain('bbox=-46.71,-23.61,-46.59,-23.49')
    expect(
      screen
        .getByText(/Abrir no mapa/)
        .closest('a')
        ?.getAttribute('href'),
    ).toContain('q=-23.5,-46.6')
  })

  it('a caminho sem posição ainda e sem destino', async () => {
    fake.quando(
      'GET /p/:token/rastreio',
      rastreio({ status: 'EM_ENTREGA', motorista: { nome: 'Hugo', posicao: null } }),
    )
    abrir()
    expect(await screen.findByText(/A posição do motorista aparece aqui/)).toBeTruthy()
    cleanup()
    fake.quando(
      'GET /p/:token/rastreio',
      rastreio({
        status: 'EM_ENTREGA',
        motorista: {
          nome: 'Hugo',
          posicao: { latitude: 1, longitude: 2, atualizadoEm: '2026-11-20T13:00:00Z' },
        },
      }),
    )
    abrir()
    expect((await screen.findByTitle('Posição do motorista')).getAttribute('src')).toContain(
      'bbox=1.99,0.99,2.01,1.01',
    )
    cleanup()
    fake.quando('GET /p/:token/rastreio', rastreio({ status: 'EM_ENTREGA', motorista: null }))
    abrir()
    expect(await screen.findByText('Seu pedido está a caminho')).toBeTruthy()
    cleanup()
    fake.quando('GET /p/:token/rastreio', rastreio({ status: 'OUTRO' }))
    abrir()
    expect(await screen.findByText('OUTRO')).toBeTruthy()
  })
})

describe('paginação', () => {
  it('fatia a lista e volta à 1ª página quando o tamanho muda', () => {
    const { result, rerender } = renderHook(({ lista }) => usePaginado(lista, 2), {
      initialProps: { lista: [1, 2, 3, 4, 5] },
    })
    expect(result.current.itens).toEqual([1, 2])
    act(() => result.current.setPagina(3))
    expect(result.current.itens).toEqual([5])
    rerender({ lista: [1, 2, 3] })
    expect(result.current.pagina).toBe(1)
  })

  it('navega entre as páginas e some com uma página só', () => {
    const onChange = vi.fn()
    const { rerender, container } = render(<Paginacao pagina={1} total={60} onChange={onChange} />)
    expect(screen.getByText('1–25 de 60')).toBeTruthy()
    expect(screen.getByLabelText('Página anterior')).toHaveProperty('disabled', true)
    fireEvent.click(screen.getByLabelText('Próxima página'))
    expect(onChange).toHaveBeenCalledWith(2)
    rerender(<Paginacao pagina={3} total={60} onChange={onChange} />)
    expect(screen.getByText('51–60 de 60')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Página anterior'))
    expect(onChange).toHaveBeenLastCalledWith(2)
    rerender(<Paginacao pagina={1} total={10} onChange={onChange} />)
    expect(container.textContent).toBe('')
  })
})
