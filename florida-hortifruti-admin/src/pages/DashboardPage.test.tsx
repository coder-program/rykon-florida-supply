import { cloneElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { api } from '../lib/api'
import { apiFalsa, ErroApi } from '../test/api-falsa'
import { apiCompleta } from '../test/dados'
import { campo } from '../test/campos'
import { logar, renderTela } from '../test/render'
import { DashboardPage } from './DashboardPage'

// O gráfico do recharts não desenha no jsdom (sem tamanho); aqui ele chama formatador e tooltip
vi.mock('recharts', () => {
  const Caixa = ({ children }: { children?: ReactNode }) => <div>{children}</div>
  return {
    ResponsiveContainer: Caixa,
    BarChart: Caixa,
    Bar: () => null,
    CartesianGrid: () => null,
    YAxis: () => null,
    XAxis: ({ tickFormatter }: { tickFormatter: (v: number) => string }) => (
      <span>
        eixo {tickFormatter(500)} | {tickFormatter(2000)}
      </span>
    ),
    Tooltip: ({ content }: { content: ReactElement<any> }) => (
      <>
        {cloneElement(content, { active: true, payload: [{ value: 12 }], label: 'Dica' })}
        {cloneElement(content, { active: true, payload: [{}], label: 'Vazia' })}
        {cloneElement(content, { active: false })}
      </>
    ),
  }
})

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const HOJE = iso(new Date())

// Trocar a data recarrega o painel (esqueleto some com os campos); espera os campos voltarem
async function data(rotulo: string, valor: string) {
  const alvo = await waitFor(() => campo(rotulo))
  fireEvent.change(alvo, { target: { value: valor } })
}

let fake: ReturnType<typeof apiFalsa>
beforeEach(() => {
  logar()
  fake = apiCompleta(apiFalsa(api))
  // '/lucro-lote/:id' também casa com '/lucro-lote/lotes'
  fake.quando('GET /relatorios/lucro-lote/lotes', [])
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const lucro = (lucroTotal: number, extra: object = {}) => ({
  periodo: {},
  geral: {
    totalVendido: 100,
    custoTotal: 50,
    perdas: 0,
    lucroTotal,
    margemPercentual: 10,
    quantidadeTotal: 3,
  },
  porProduto: [],
  porTipoMorango: [],
  ...extra,
})

describe('Dashboard', () => {
  it('painel completo, alertas, CSV e troca de período', async () => {
    const criar = vi.spyOn(URL, 'createObjectURL')
    const clicar = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    renderTela(<DashboardPage />)
    expect(await screen.findByText(/, Duda/)).toBeTruthy()
    expect(screen.getByText(/em títulos/)).toBeTruthy()
    expect(screen.getByText(/devolução pendente/)).toBeTruthy()
    expect(screen.getByText(/Ticket médio R\$\s118,00 · 10 pedidos/)).toBeTruthy()
    expect(screen.getByText('40 cx')).toBeTruthy()
    expect(screen.getByText('Aguardando aprovação')).toBeTruthy()
    expect(screen.queryByText('Rejeitado')).toBeNull()
    expect(screen.getByText(/4 geral · 1 concluída/)).toBeTruthy()
    expect(screen.getByText(/2 produtos · 1 abaixo do mínimo/)).toBeTruthy()
    expect(screen.getByText('Baixo')).toBeTruthy()
    expect(screen.getAllByText('OK').length).toBeGreaterThan(0)
    expect(await screen.findByText(/Já com R\$\s42,00 de perdas/)).toBeTruthy()
    expect(await screen.findByText('+0.0%')).toBeTruthy()
    expect(screen.getByText(/eixo R\$\s500,00 \| R\$ 2k/)).toBeTruthy()
    expect(screen.getByText('Dica')).toBeTruthy()
    expect(screen.getByText('Vazia')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /CSV/ }))
    expect(criar).toHaveBeenCalled()
    expect(clicar).toHaveBeenCalled()

    for (const nome of ['Ontem', '7 dias', '30 dias']) {
      fireEvent.click(await screen.findByRole('button', { name: nome }))
      await waitFor(() =>
        expect(fake.feitas('GET', '/dashboard').at(-1)?.params.dataInicio).not.toBe(HOJE),
      )
    }
    expect((await screen.findAllByText(/nos últimos 30 dias/)).length).toBeGreaterThan(0)
    fireEvent.click(await screen.findByRole('button', { name: 'Personalizado' }))
    await data('De', '2026-11-05')
    await data('Até', '2026-11-01')
    await waitFor(() =>
      expect(fake.feitas('GET', '/dashboard').at(-1)?.params).toEqual({
        dataInicio: '2026-11-01',
        dataFim: '2026-11-05',
      }),
    )
    expect(screen.getAllByText(/no período selecionado/).length).toBeGreaterThan(0)
    await data('Até', '2026-11-09')
    await waitFor(() =>
      expect(fake.feitas('GET', '/dashboard').at(-1)?.params.dataFim).toBe('2026-11-09'),
    )
    await data('De', '2026-11-03')
    await waitFor(() =>
      expect(fake.feitas('GET', '/dashboard').at(-1)?.params.dataInicio).toBe('2026-11-03'),
    )
    await data('De', '2026-11-09')
    expect(await screen.findByText('09/11/2026', { selector: 'p' })).toBeTruthy()
    await data('De', '')
    fireEvent.click(await screen.findByRole('button', { name: 'Hoje' }))

    fireEvent.click(await screen.findByRole('tab', { name: 'Lucro por lote' }))
    expect(await screen.findByText('Escolha um lote para ver o lucro')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Lucro por dia' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Entregas' }))
    expect(screen.getByRole('tab', { name: 'Entregas' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.click(screen.getByRole('tab', { name: 'Visão geral' }))
  })

  it('variação positiva, negativa e sem base; dados vazios', async () => {
    let atual = 0
    fake.quando('GET /relatorios/lucro-diario', (c: { params: { dataInicio: string } }) =>
      c.params.dataInicio === HOJE ? lucro(150) : lucro(atual),
    )
    fake.quando('GET /dashboard', {
      estoque: [
        { produtoId: 'z', nome: 'Zerado', saldoAtual: 0, unidadeVenda: 'CX', estoqueMinimo: 5 },
        {
          produtoId: 'y',
          nome: 'Sem mínimo',
          saldoAtual: 3,
          unidadeVenda: 'CX',
          estoqueMinimo: null,
        },
      ],
      totalPedidos: 1,
      totalVendas: 0,
    })
    fake.quando('GET /devolucoes/resumo', { total: 0, pendentes: 2, concluidas: 0, negadas: 0 })
    fake.quando('GET /relatorios/vendas/por-produto', [
      { produto: 'Morango Bandeja Grande Especial', faturamento: 10 },
      { produto: 'Uva', faturamento: 30 },
    ])
    atual = 100
    renderTela(<DashboardPage />)
    expect(await screen.findByText('+50.0%')).toBeTruthy()
    expect(screen.getByText(/produto sem estoque/)).toBeTruthy()
    expect(screen.getByText(/devoluções pendentes/)).toBeTruthy()
    expect(screen.getAllByText('Zerado')).toHaveLength(2)
    expect(screen.getByText(/1 zerado no estoque/)).toBeTruthy()
    expect(screen.getByText('Sem devoluções')).toBeTruthy()
    expect(screen.getByText('Nenhuma venda neste período')).toBeTruthy()
    expect((screen.getByRole('button', { name: /CSV/ }) as HTMLButtonElement).disabled).toBe(true)
    cleanup()

    atual = 300
    fake.quando('GET /relatorios/lucro-diario', (c: { params: { dataInicio: string } }) =>
      c.params.dataInicio === HOJE
        ? lucro(150, {
            porProduto: [],
            porTipoMorango: [{ produtoId: 'a', produto: 'Morango "B3"', quantidade: 2 }],
          })
        : lucro(atual),
    )
    fake.quando('GET /dashboard', {
      estoque: [
        { produtoId: 'z', nome: 'A', saldoAtual: 0 },
        { produtoId: 'w', nome: 'B', saldoAtual: -1 },
      ],
    })
    fake.quando('GET /devolucoes/resumo', {})
    renderTela(<DashboardPage />)
    expect(await screen.findByText('-50.0%')).toBeTruthy()
    expect(screen.getByText('Morango "B3"')).toBeTruthy()
    expect(screen.getByText(/produtos sem estoque/)).toBeTruthy()
    expect(screen.getByText(/2 zerados no estoque/)).toBeTruthy()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    fireEvent.click(screen.getByRole('button', { name: /CSV/ }))
    cleanup()

    fake.quando('GET /relatorios/lucro-diario', {})
    fake.quando('GET /dashboard', {
      totalPedidos: 1,
      totalVendas: 50,
      caixasVendidas: 0,
      valoresEmAberto: 0,
      valoresVencidos: 0,
    })
    fake.quando('GET /devolucoes/resumo', undefined)
    fake.quando('GET /relatorios/vendas/por-produto', [])
    renderTela(<DashboardPage />)
    expect(await screen.findByText('Sem base')).toBeTruthy()
    expect(screen.getByText(/1 pedido$/)).toBeTruthy()
    expect(screen.getByText('Nenhum produto ativo')).toBeTruthy()
    expect(screen.getByText('Sem faturamento neste período')).toBeTruthy()
    expect(screen.getByText('Nada a receber neste período')).toBeTruthy()
    expect(screen.getByText('Sem volume no período')).toBeTruthy()
  })

  it('nenhum pedido, saudações por horário e visão geral', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    fake.quando('GET /dashboard', {})
    for (const [hora, texto] of [
      [9, 'Bom dia'],
      [14, 'Boa tarde'],
      [20, 'Boa noite'],
    ] as const) {
      vi.setSystemTime(new Date(2026, 10, 18, hora))
      renderTela(<DashboardPage />)
      expect(await screen.findByText(new RegExp(texto))).toBeTruthy()
      cleanup()
    }
    expect(fake.feitas('GET', '/dashboard')).toHaveLength(3)
    logar({ id: 'tv', nome: '  ', email: 'tv@x', papel: 'VISAO_GERAL' })
    renderTela(<DashboardPage />)
    expect(await screen.findByText('Boa noite')).toBeTruthy()
    expect(screen.getByText(/Nenhum pedido hoje/)).toBeTruthy()
    expect(screen.getByText(/Nenhuma venda hoje/)).toBeTruthy()
  })

  it('erro ao carregar e tentar de novo', async () => {
    fake.quando('GET /dashboard', new ErroApi(500))
    renderTela(<DashboardPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Tentar novamente/ }))
    await waitFor(() => expect(fake.feitas('GET', '/dashboard')).toHaveLength(2))
  })
})
