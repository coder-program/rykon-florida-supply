import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '../lib/api'
import { apiFalsa, ErroApi } from '../test/api-falsa'
import { apiCompleta, DEVOLUCOES, pedido } from '../test/dados'
import { campo, janela, preencher } from '../test/campos'
import { logar, renderTela, USUARIO } from '../test/render'
import { DevolucoesPage } from './DevolucoesPage'
import { ReembolsoDevolucaoModal } from '../components/ReembolsoDevolucaoModal'
import { RegistrarDevolucaoModal } from '../components/RegistrarDevolucaoModal'

let fake: ReturnType<typeof apiFalsa>
beforeEach(() => {
  logar()
  fake = apiCompleta(apiFalsa(api))
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const HOJE = new Date().toISOString()

describe('Devoluções', () => {
  it('fila, aprovar, negar, reembolso e finalizadas', async () => {
    fake.quando('PATCH /devolucoes/:id/status', {})
    fake.quando('GET /devolucoes', [
      ...DEVOLUCOES,
      { id: 'd5', status: 'ESTRANHO', criadoEm: HOJE, fotos: null, itens: [], valorDevolucao: 0 },
    ])
    renderTela(<DevolucoesPage />)
    expect(await screen.findByText(/1 pendente\(s\) de aprovação/)).toBeTruthy()
    expect(screen.getAllByText('Aguardando reembolso').length).toBe(2)
    expect(screen.getAllByText('ESTRANHO').length).toBe(2)
    expect(screen.getAllByText('Finalizada').length).toBe(6)
    expect(screen.getAllByText('1 item(ns)').length).toBe(4)
    expect(screen.getAllByText('#000000').length).toBeGreaterThan(0)

    fireEvent.click(screen.getAllByRole('button', { name: /Aprovar/ })[0])
    await waitFor(() =>
      expect(fake.feitas('PATCH', '/devolucoes/d1/status')[0]?.data).toEqual({
        status: 'APROVADA',
      }),
    )
    fireEvent.click(screen.getAllByRole('button', { name: /Negar/ })[1])
    await waitFor(() =>
      expect(fake.feitas('PATCH', '/devolucoes/d1/status')[1]?.data).toEqual({ status: 'NEGADA' }),
    )

    fireEvent.click(screen.getAllByRole('button', { name: /Reembolso/ })[0])
    expect(await screen.findByText('Registrar reembolso')).toBeTruthy()
    fireEvent.click(within(janela('Registrar reembolso')).getByRole('button', { name: 'Fechar' }))

    fireEvent.click(screen.getAllByRole('button', { name: /Registrar devolução/ })[0])
    expect(await screen.findByText('Registrar devolução', { selector: 'h2' })).toBeTruthy()
    fireEvent.click(within(janela('Registrar devolução')).getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByText('Registrar devolução', { selector: 'h2' })).toBeNull()
  })

  it('detalhes com pedido, fotos e reembolso em caixas', async () => {
    fake.quando('GET /pedidos/:id', {
      ...pedido({
        status: 'ENTREGUE',
        valorTotal: 118,
        data: null,
        formaPagamento: null,
        subtotal: 0,
      }),
      itens: [
        {
          id: 'i1',
          produto: { nome: 'Morango B3' },
          quantidade: 4,
          valorUnitario: 27,
          valorTotal: 108,
        },
        { produtoId: 'x' },
      ],
      devolucoes: [
        {
          id: 'dv1',
          data: HOJE,
          etiquetaToken: 'tok',
          status: 'CONCLUIDA',
          itensDevolvidos: '2x Morango',
          quantidadeCaixas: 2,
          valorDevolucao: 54,
        },
        {
          id: 'dv2',
          data: HOJE,
          etiquetaToken: null,
          status: 'X',
          itensDevolvidos: null,
          quantidadeCaixas: null,
          valorDevolucao: 0,
        },
      ],
    })
    renderTela(<DevolucoesPage />)
    await screen.findAllByText('Concluída')
    fireEvent.click(screen.getAllByRole('button', { name: 'Ver detalhes' })[2])
    const modal = janela('Devolução · Pedido #000181')
    expect(within(modal).getByText('Em caixas: 2 cx · lote 7')).toBeTruthy()
    expect(within(modal).getByText(/Perda: 2 cx · lote 7 · R\$\s42,00/)).toBeTruthy()
    expect(within(modal).getAllByAltText('Foto da devolução')).toHaveLength(3)
    expect(within(modal).getByText('amassada')).toBeTruthy()
    expect(await within(modal).findByText('HISTÓRICO DE DEVOLUÇÕES')).toBeTruthy()
    expect(within(modal).getByText('Itens: 2x Morango')).toBeTruthy()
    expect(within(modal).getByText(/Caixas: — · Valor: —/)).toBeTruthy()
    expect(within(modal).getByText('Produto')).toBeTruthy()
    expect(within(modal).getByText('Entregue')).toBeTruthy()
    fireEvent.click(within(modal).getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByText('Devolução · Pedido #000181')).toBeNull()
  })

  it('detalhes de negada, reembolso em dinheiro e pedido que não carrega', async () => {
    fake.quando('GET /devolucoes', [
      {
        ...DEVOLUCOES[3],
        pedidoId: null,
        fotos: [],
        etiquetaToken: null,
        vendedor: null,
        registradoPor: null,
        analisadoPor: null,
        quantidadeCaixas: null,
        valorDevolucao: 0,
        itensDevolvidos: null,
        observacao: null,
      },
      {
        ...DEVOLUCOES[2],
        id: 'd6',
        pedidoId: 'p404',
        reembolso: {
          tipo: 'DINHEIRO',
          valor: 54,
          formaPagamento: 'PIX',
          data: HOJE,
          registradoPor: 'Duda',
          perda: { quantidade: 2, lote: '7', valor: 0 },
        },
      },
      {
        ...DEVOLUCOES[2],
        id: 'd7',
        reembolso: {
          tipo: 'DINHEIRO',
          valor: 10,
          formaPagamento: 'ESCAMBO',
          data: HOJE,
          registradoPor: 'Duda',
          perda: null,
        },
      },
    ])
    fake.quando('GET /pedidos/:id', new ErroApi(404))
    renderTela(<DevolucoesPage />)
    await screen.findAllByText('Negada')
    fireEvent.click(screen.getAllByRole('button', { name: 'Ver detalhes' })[0])
    let modal = janela('Devolução · Pedido #000000')
    expect(within(modal).getByText('Negado por:')).toBeTruthy()
    expect(within(modal).getByText('fora do prazo')).toBeTruthy()
    expect(within(modal).getAllByText('0').length).toBeGreaterThan(0)
    expect(within(modal).getByText(/Não foi possível carregar os dados completos/)).toBeTruthy()
    fireEvent.click(within(modal).getByRole('button', { name: 'Fechar' }))

    fireEvent.click(screen.getAllByRole('button', { name: 'Ver detalhes' })[1])
    modal = janela('Devolução · Pedido #000181')
    expect(within(modal).getByText(/Em dinheiro: R\$\s54,00 · Pix/)).toBeTruthy()
    expect(within(modal).getByText('Perda: 2 cx · lote 7')).toBeTruthy()
    expect(within(modal).getByText('Aprovado por:')).toBeTruthy()
    expect(await within(modal).findByText(/Não foi possível carregar/)).toBeTruthy()
    fireEvent.click(within(modal).getByRole('button', { name: 'Fechar' }))

    fireEvent.click(screen.getAllByRole('button', { name: 'Ver detalhes' })[2])
    expect(
      within(janela('Devolução · Pedido #000181')).getByText(/Em dinheiro: R\$\s10,00 · ESCAMBO/),
    ).toBeTruthy()
  })

  it('lista vazia, resposta inválida e visão geral sem ações', async () => {
    fake.quando('GET /devolucoes', { erro: true })
    renderTela(<DevolucoesPage />)
    expect(screen.getByText('Carregando...')).toBeTruthy()
    expect(await screen.findByText('Nenhuma devolução registrada.')).toBeTruthy()
    cleanup()

    logar({ ...USUARIO, papel: 'VISAO_GERAL' })
    fake.quando('GET /devolucoes', DEVOLUCOES)
    renderTela(<DevolucoesPage />)
    await screen.findAllByText('Pendente')
    expect(
      screen.queryByRole('button', { name: /Aprovar|Reembolso|Registrar devolução/ }),
    ).toBeNull()
  })
})

describe('Reembolso da devolução', () => {
  const DEV = DEVOLUCOES[1]
  // Em dados.ts a rota '/relatorios/lucro-lote/:id' (cadastrada depois) também casa com '/lotes'
  beforeEach(() => {
    fake.quando('GET /relatorios/lucro-lote/lotes', [
      {
        id: 'l1',
        numero: '7',
        dataEntrada: '2026-11-10T15:00:00Z',
        produtoId: 'a',
        custoUnitario: 21,
        produto: 'Morango B3',
      },
      {
        id: 'l8',
        numero: '8',
        dataEntrada: '2026-11-10T15:00:00Z',
        produtoId: 'a',
        produto: 'Morango B3',
      },
      {
        id: 'l9',
        numero: '9',
        dataEntrada: '2026-11-10T15:00:00Z',
        produtoId: 'zz',
        custoUnitario: 5,
        produto: 'Outro',
      },
    ])
  })

  it('em dinheiro com perda sugerida pelo custo do lote', async () => {
    let n = 0
    fake.quando('PATCH /devolucoes/:id/reembolso', () =>
      ++n === 1 ? new ErroApi(400, ['valor', 'alto']) : n === 2 ? new ErroApi(500, '') : {},
    )
    const fechar = vi.fn()
    renderTela(<ReembolsoDevolucaoModal devolucao={DEV} onFechar={fechar} />)
    const modal = janela('Registrar reembolso')
    const confirmar = () =>
      within(modal).getByRole('button', { name: 'Confirmar reembolso' }) as HTMLButtonElement
    expect(campo('Valor reembolsado (R$)', modal).value).toBe('54')
    await waitFor(() => expect(campo('Lote da perda', modal).value).toBe('l1'), { timeout: 8000 })
    expect(campo('Valor perdido (R$)', modal).placeholder).toBe('42.00')
    expect(confirmar().disabled).toBe(true)
    fireEvent.change(campo('Forma de pagamento', modal), { target: { value: 'PIX' } })
    expect(confirmar().disabled).toBe(false)
    fireEvent.click(confirmar())
    expect(await within(modal).findByText('valor alto')).toBeTruthy()
    fireEvent.click(confirmar())
    expect(await within(modal).findByText('Não foi possível registrar o reembolso')).toBeTruthy()
    preencher('Valor perdido (R$)', '40', modal)
    preencher('Data do reembolso', '2026-11-18', modal)
    fireEvent.click(confirmar())
    await waitFor(() => expect(fechar).toHaveBeenCalled())
    expect(fake.feitas('PATCH', '/devolucoes/d2/reembolso')[2].data).toEqual({
      tipo: 'DINHEIRO',
      data: '2026-11-18',
      valor: 54,
      formaPagamento: 'PIX',
      perdaQuantidade: 2,
      perdaLoteId: 'l1',
      perdaValor: 40,
    })
    expect(fake.feitas('PATCH', '/devolucoes/d2/reembolso')[0].data.perdaValor).toBe(42)
  })

  it('em caixas de um lote com saldo', async () => {
    fake.quando('PATCH /devolucoes/:id/reembolso', {})
    fake.quando('GET /pedidos/:id', { itens: [] })
    renderTela(<ReembolsoDevolucaoModal devolucao={DEV} onFechar={() => {}} />)
    const modal = janela('Registrar reembolso')
    fireEvent.click(within(modal).getByRole('tab', { name: 'Em caixas' }))
    expect(within(modal).queryByText('Valor perdido (R$)')).toBeNull()
    await waitFor(
      () => expect(within(modal).getAllByRole('option', { name: /lote 9 · 3 cx/ }).length).toBe(1),
      { timeout: 8000 },
    )
    fireEvent.change(campo('Lote', modal), { target: { value: 'l3' } })
    preencher('Quantidade de caixas', '1', modal)
    preencher('Caixas perdidas', '1', modal)
    fireEvent.change(campo('Lote da perda', modal), { target: { value: 'l1' } })
    fireEvent.click(within(modal).getByRole('button', { name: 'Confirmar reembolso' }))
    await waitFor(() => expect(fake.feitas('PATCH', '/devolucoes/d2/reembolso')).toHaveLength(1))
    expect(fake.feitas('PATCH', '/devolucoes/d2/reembolso')[0].data).toMatchObject({
      tipo: 'CAIXAS',
      quantidadeCaixas: 1,
      loteId: 'l3',
      perdaQuantidade: 1,
      perdaLoteId: 'l1',
    })
  })

  it('devolução sem itens e respostas que não são lista', async () => {
    fake.quando('GET /estoque/lotes/disponiveis', null)
    fake.quando('GET /relatorios/lucro-lote/lotes', null)
    renderTela(
      <ReembolsoDevolucaoModal devolucao={{ id: 'dx', pedidoId: 'p1' }} onFechar={() => {}} />,
    )
    const modal = janela('Registrar reembolso')
    expect(campo('Valor reembolsado (R$)', modal).value).toBe('')
    fireEvent.click(within(modal).getByRole('tab', { name: 'Em caixas' }))
    await waitFor(() => expect(fake.feitas('GET', '/estoque/lotes/disponiveis')).toHaveLength(1))
    expect(within(modal).getAllByRole('option')).toHaveLength(2)
  })
})

describe('Registrar devolução', () => {
  const PEDIDOS = [
    {
      pedidoId: 'p1',
      pedidoNumero: 181,
      cliente: 'Mercado Vale Verde',
      entregueEm: HOJE,
      itens: [
        { produtoId: 'a', nome: 'Morango B3', quantidade: 4 },
        { produtoId: 'b', nome: 'Uva', quantidade: 2 },
      ],
    },
    { pedidoId: 'p2', pedidoNumero: 99, cliente: null, entregueEm: null, itens: [] },
  ]

  it('administrador registra sem fotos, validando motivos', async () => {
    let n = 0
    fake.quando('GET /devolucoes/pedidos', PEDIDOS)
    fake.quando('POST /devolucoes', () => (++n === 1 ? new ErroApi(400, ['pedido', 'antigo']) : {}))
    const fechar = vi.fn()
    renderTela(<RegistrarDevolucaoModal onFechar={fechar} />)
    expect(screen.getByText('Carregando...')).toBeTruthy()
    expect(await screen.findByText(/Mercado Vale Verde · Entregue/)).toBeTruthy()
    const buscar = screen.getByPlaceholderText('Buscar por número ou cliente')
    fireEvent.change(buscar, { target: { value: '99' } })
    expect(screen.queryByText(/Mercado Vale Verde/)).toBeNull()
    fireEvent.change(buscar, { target: { value: 'nada' } })
    expect(screen.getByText('Nenhum pedido entregue.')).toBeTruthy()
    fireEvent.change(buscar, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /#000099/ }))
    expect(screen.getByText('Cliente')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Trocar' }))
    fireEvent.change(buscar, { target: { value: 'vale' } })
    fireEvent.click(screen.getByRole('button', { name: /#000181/ }))

    const registrar = () =>
      fireEvent.click(screen.getByRole('button', { name: 'Registrar devolução' }))
    registrar()
    expect(await screen.findByText('Informe ao menos um item devolvido')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Caixas devolvidas de Morango B3'), {
      target: { value: '2' },
    })
    registrar()
    expect(await screen.findByText('Escolha o motivo da devolução de Morango B3')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Melado' }))
    fireEvent.click(screen.getByRole('button', { name: 'Refugo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Refugo' }))
    expect(screen.getByRole('button', { name: 'Melado' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Outros' }))
    registrar()
    expect(await screen.findByText('Escreva o motivo "Outros" de Morango B3')).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText('Escreva o motivo'), {
      target: { value: ' bicho ' },
    })
    fireEvent.change(screen.getByLabelText('Caixas devolvidas de Uva'), { target: { value: '1' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Estragado' })[1])
    fireEvent.change(campo('Observação (opcional)'), { target: { value: ' caiu ' } })
    expect(screen.queryByText('Fotos da caixa (3 fotos)')).toBeNull()
    registrar()
    expect(await screen.findByText('pedido antigo')).toBeTruthy()
    registrar()
    await waitFor(() => expect(fechar).toHaveBeenCalled())
    expect(fake.feitas('POST', '/devolucoes')[1].data).toEqual({
      pedidoId: 'p1',
      observacao: 'caiu',
      itens: [
        { produtoId: 'a', quantidade: 2, motivos: ['MELADO', 'OUTROS'], motivoOutro: 'bicho' },
        { produtoId: 'b', quantidade: 1, motivos: ['ESTRAGADO'] },
      ],
    })
  })

  it('supervisor precisa de 3 fotos', async () => {
    logar({ ...USUARIO, papel: 'SUPERVISOR' })
    let n = 0
    fake.quando('GET /devolucoes/pedidos', PEDIDOS)
    fake.quando('POST /devolucoes', () => (++n === 1 ? new ErroApi(500, '') : {}))
    renderTela(<RegistrarDevolucaoModal onFechar={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: /#000181/ }))
    fireEvent.change(screen.getByLabelText('Caixas devolvidas de Morango B3'), {
      target: { value: '1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Melado' }))
    const registrar = () =>
      fireEvent.click(screen.getByRole('button', { name: 'Registrar devolução' }))
    registrar()
    expect(await screen.findByText('Envie exatamente 3 fotos')).toBeTruthy()
    const fotos = [1, 2, 3].map((i) => new File(['x'], `${i}.jpg`, { type: 'image/jpeg' }))
    fireEvent.change(campo('Fotos da caixa (3 fotos)'), { target: { files: fotos } })
    registrar()
    expect(await screen.findByText('Não foi possível registrar')).toBeTruthy()
    registrar()
    await waitFor(() => expect(fake.feitas('POST', '/devolucoes')).toHaveLength(2))
    const enviado = fake.feitas('POST', '/devolucoes')[1].data
    expect(enviado.fotos).toHaveLength(3)
    expect(enviado.fotos[0]).toMatch(/^data:image\/jpeg;base64,/)
    expect(enviado.observacao).toBeUndefined()
  })

  it('lista que não é array', async () => {
    fake.quando('GET /devolucoes/pedidos', {})
    renderTela(<RegistrarDevolucaoModal onFechar={() => {}} />)
    expect(await screen.findByText('Nenhum pedido entregue.')).toBeTruthy()
  })
})
