import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { api } from '../lib/api'
import { apiFalsa } from '../test/api-falsa'
import { apiCompleta } from '../test/dados'
import { logar, renderTela } from '../test/render'
import { PerdasCard } from './PerdasCard'
import { LucroPorLote } from './LucroPorLote'
import { AvisosCobranca } from '../pages/AvisosCobranca'

let fake: ReturnType<typeof apiFalsa>
beforeEach(() => {
  logar()
  fake = apiCompleta(apiFalsa(api))
})
afterEach(cleanup)

describe('Perdas', () => {
  it('lista as perdas do período', async () => {
    renderTela(<PerdasCard dataInicio="2026-11-01" dataFim="2026-11-30" rotulo="novembro" />)
    expect(await screen.findByText('Morango B3 · lote 7')).toBeTruthy()
    expect(screen.getByText(/Pedido #000181 · Mercado Vale Verde/)).toBeTruthy()
    expect(screen.getByText(/2 cx · R\$\s42,00/)).toBeTruthy()
    expect(fake.feitas('GET', '/devolucoes/perdas')[0].params).toEqual({
      dataInicio: '2026-11-01',
      dataFim: '2026-11-30',
    })
  })

  it('sem valor, sem cliente e vazio', async () => {
    fake.quando('GET /devolucoes/perdas', {
      totalCaixas: 1,
      valorTotal: 0,
      itens: [
        {
          id: 'x',
          data: '',
          numeroPedido: 5,
          cliente: null,
          produto: 'Uva',
          lote: '1',
          quantidade: 1,
          valor: 0,
        },
      ],
    })
    renderTela(<PerdasCard dataInicio="a" dataFim="b" rotulo="hoje" />)
    expect(await screen.findByText(/Pedido #000005 · Cliente/)).toBeTruthy()
    expect(screen.getAllByText('1 cx').length).toBe(2)
    cleanup()
    fake.quando('GET /devolucoes/perdas', {})
    renderTela(<PerdasCard dataInicio="c" dataFim="d" rotulo="hoje" />)
    expect(await screen.findByText('0 cx')).toBeTruthy()
  })
})

describe('Lucro por lote', () => {
  // '/lucro-lote/:id' também casa com '/lucro-lote/lotes': a lista é cadastrada por último
  const LOTES = [
    {
      id: 'l1',
      numero: '7',
      dataEntrada: '2026-11-10T15:00:00Z',
      produto: 'Morango B3',
      quantidadeInicial: 10,
      quantidadeDisponivel: 6,
    },
  ]
  beforeEach(() => {
    fake.quando('GET /relatorios/lucro-lote/lotes', LOTES)
  })

  it('busca, escolhe o lote e mostra as vendas', async () => {
    renderTela(<LucroPorLote />)
    expect(await screen.findByText('Escolha o lote (1 de 1)')).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText(/Buscar lote/), { target: { value: 'uva' } })
    expect(screen.getByText('Escolha o lote (0 de 1)')).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText(/Buscar lote/), { target: { value: ' morango ' } })
    expect(screen.getByText(/lote 7 · Morango B3 \(6 cx em estoque\)/)).toBeTruthy()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'l1' } })
    expect(await screen.findByText('#000181')).toBeTruthy()
    expect(screen.getByText('4 de 10')).toBeTruthy()
    expect(screen.getByText('22.2%')).toBeTruthy()
    expect(screen.getByText(/6 cx ainda em estoque/)).toBeTruthy()
  })

  it('lote esgotado, com perdas, prejuízo e sem vendas', async () => {
    const esgotado = [
      {
        id: 'l9',
        numero: '9',
        dataEntrada: '2026-11-10T15:00:00Z',
        produto: 'Uva',
        quantidadeInicial: 5,
        quantidadeDisponivel: 0,
      },
    ]
    fake.quando('GET /relatorios/lucro-lote/:id', {
      lote: {
        id: 'l9',
        numero: '9',
        dataEntrada: '',
        produto: 'Uva',
        quantidadeInicial: 5,
        quantidadeDisponivel: 0,
        custoUnitario: 10,
        custoLote: 50,
      },
      geral: {
        totalVendido: 10,
        custoTotal: 20,
        perdas: 5,
        lucroTotal: -15,
        margemPercentual: -150,
        quantidadeTotal: 1,
        precoMedio: 10,
      },
      vendas: [
        {
          pedidoId: 'p',
          numeroPedido: 2,
          data: '2026-11-10T15:00:00Z',
          cliente: null,
          quantidade: 1,
          valorUnitario: 10,
          faturamento: 10,
          lucro: -10,
        },
      ],
    })
    fake.quando('GET /relatorios/lucro-lote/lotes', esgotado)
    renderTela(<LucroPorLote />)
    expect(await screen.findByText(/\(esgotado\)/)).toBeTruthy()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'l9' } })
    expect(await screen.findByText(/lote esgotado/)).toBeTruthy()
    expect(screen.getByText(/perdas descontadas/)).toBeTruthy()
    expect(screen.getByText('—')).toBeTruthy()
    cleanup()
    fake.quando('GET /relatorios/lucro-lote/:id', {
      lote: {
        id: 'l9',
        numero: '9',
        dataEntrada: '',
        produto: 'Uva',
        quantidadeInicial: 5,
        quantidadeDisponivel: 0,
        custoUnitario: 10,
        custoLote: 50,
      },
      geral: {
        totalVendido: 0,
        custoTotal: 0,
        perdas: 0,
        lucroTotal: 0,
        margemPercentual: 0,
        quantidadeTotal: 0,
        precoMedio: 0,
      },
      vendas: [],
    })
    fake.quando('GET /relatorios/lucro-lote/lotes', esgotado)
    renderTela(<LucroPorLote />)
    await screen.findByText(/\(esgotado\)/)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'l9' } })
    expect(await screen.findByText('Nenhuma venda deste lote ainda.')).toBeTruthy()
  })
})

describe('Avisos de cobrança', () => {
  it('WhatsApp marca enviado, filtros e verificar agora', async () => {
    fake.quando('POST /financeiro/notificacoes/:id/enviada', {})
    fake.quando('POST /financeiro/notificacoes-vencimento', {})
    renderTela(<AvisosCobranca />)
    const link = (await screen.findByRole('link', { name: /WhatsApp/ })) as HTMLAnchorElement
    expect(link.href).toBe(`https://wa.me/5511999998888?text=${encodeURIComponent('Olá')}`)
    expect(screen.getByText('Cliente sem telefone')).toBeTruthy()
    expect(screen.getByText('3 dias antes')).toBeTruthy()
    expect(screen.getByText(/· enviado/)).toBeTruthy()
    link.addEventListener('click', (e) => e.preventDefault())
    fireEvent.click(link)
    await waitFor(() =>
      expect(fake.feitas('POST', '/financeiro/notificacoes/n1/enviada')).toHaveLength(1),
    )
    fireEvent.click(screen.getAllByRole('button', { name: 'Marcar enviado' })[0])
    await waitFor(() =>
      expect(fake.feitas('POST', '/financeiro/notificacoes/n1/enviada')).toHaveLength(2),
    )
    fireEvent.click(screen.getByRole('button', { name: /Verificar agora/ }))
    await waitFor(() =>
      expect(fake.feitas('POST', '/financeiro/notificacoes-vencimento')).toHaveLength(1),
    )
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } })
    await waitFor(() =>
      expect(fake.feitas('GET', '/financeiro/notificacoes').at(-1)?.params).toEqual({}),
    )
  })

  it('mensagem antiga ganha saudação e fecho; cancelado sem botões; vazio', async () => {
    fake.quando('GET /financeiro/notificacoes', [
      {
        id: 'a1',
        tipo: 'COMPRA_A_PRAZO',
        mensagem: 'Sua compra venceu.',
        status: 'ENVIADA',
        criadoEm: '2026-11-10T10:00:00Z',
        lidaEm: '2026-11-10T11:00:00Z',
        cliente: { razaoSocialOuNome: 'VV', telefone: '+55 (11) 98888-7777' },
      },
      {
        id: 'a2',
        tipo: 'OUTRO',
        mensagem: 'Pague. Florida Supply Hortifruti',
        status: 'CANCELADA',
        criadoEm: '2026-11-10T10:00:00Z',
        cliente: null,
      },
      {
        id: 'a3',
        tipo: 'X',
        mensagem: 'oi',
        status: 'ESTRANHO',
        criadoEm: '2026-11-10T10:00:00Z',
        cliente: { telefone: '1199' },
      },
    ])
    renderTela(<AvisosCobranca />)
    const links = (await screen.findAllByRole('link', { name: /WhatsApp/ })) as HTMLAnchorElement[]
    expect(decodeURIComponent(links[0].href)).toContain(
      'wa.me/5511988887777?text=Olá, VV! Sua compra venceu.\n\nQualquer coisa',
    )
    expect(decodeURIComponent(links[1].href)).toContain('Olá, ! oi')
    expect(screen.getByText('Visto no portal')).toBeTruthy()
    expect(screen.getByText('Cancelado (pago)')).toBeTruthy()
    expect(screen.getByText('OUTRO')).toBeTruthy()
    expect(screen.queryAllByRole('button', { name: 'Marcar enviado' })).toHaveLength(0)
    links[0].addEventListener('click', (e) => e.preventDefault())
    fireEvent.click(links[0])
    cleanup()
    fake.quando('GET /financeiro/notificacoes', [])
    renderTela(<AvisosCobranca />)
    expect(await screen.findByText('Nenhum aviso')).toBeTruthy()
    expect(fake.feitas('POST', '/financeiro/notificacoes/a1/enviada')).toHaveLength(0)
  })
})
